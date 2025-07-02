import { TranscribeClient, StartTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Handler } from "aws-lambda";
import * as dotenv from "dotenv";

dotenv.config();

const transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION });

export const handler: S3Handler = async (event) => {
  const record = event.Records?.[0];
  if (!record) return;

  const bucket = record.s3.bucket.name;
  const key = record.s3.object.key;

  const jobName = `job-${Date.now()}`;
  const mediaUri = `s3://${bucket}/${key}`;

  const command = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: "es-ES",
    MediaFormat: "mp3",
    Media: { MediaFileUri: mediaUri },
    OutputBucketName: process.env.OUTPUT_BUCKET,
  });

  try {
    const res = await transcribeClient.send(command);
    console.log("✅ Transcription started:", res.TranscriptionJob?.TranscriptionJobName);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
};
