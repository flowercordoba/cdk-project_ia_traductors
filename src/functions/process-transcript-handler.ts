import { S3Handler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { Readable } from "stream";

const s3 = new S3Client({});
const translate = new TranslateClient({});
const polly = new PollyClient({});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export const handler: S3Handler = async (event) => {
  const record = event.Records?.[0];
  if (!record) return;
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  if (!key.endsWith(".json")) {
    console.log("Archivo no es JSON, omitiendo:", key);
    return;
  }

  const getObj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bodyStream = getObj.Body as Readable;
  const jsonContent = (await streamToBuffer(bodyStream)).toString("utf-8");
  const transcriptJson = JSON.parse(jsonContent);

  const transcript = transcriptJson.results?.transcripts?.[0]?.transcript;
  if (!transcript) {
    console.error("No se encontró transcript en el JSON.");
    return;
  }

  const translateCmd = new TranslateTextCommand({
    Text: transcript,
    SourceLanguageCode: "es",
    TargetLanguageCode: "en",
  });
  const translateRes = await translate.send(translateCmd);
  const translatedText = translateRes.TranslatedText || "";

  const pollyCmd = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    Text: translatedText,
    VoiceId: "Joanna",
    LanguageCode: "en-US",
  });
  const pollyRes = await polly.send(pollyCmd);

  const audioBuffer = await streamToBuffer(pollyRes.AudioStream as Readable);

  const audioKey = key.replace(".json", "-en.mp3");
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: audioKey,
    Body: audioBuffer,
    ContentType: "audio/mpeg",
  }));

  console.log("Audio generado y guardado en S3:", audioKey);
};
