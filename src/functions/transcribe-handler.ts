import { TranscribeClient, StartTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Handler } from "aws-lambda";

// Instancia del cliente Transcribe. La región la define AWS automáticamente.
const transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION });

/**
 * Handler Lambda para iniciar transcripción automática al subir un archivo a S3.
 * Valida que el formato sea compatible con Amazon Transcribe.
 * Soporta: amr, flac, m4a, mp3, mp4, ogg, wav, webm.
 */
export const handler: S3Handler = async (event) => {
  // Logging de entrada
  console.log("[TranscribeHandler] Evento recibido:", JSON.stringify(event));

  // Procesamos solo el primer record por simplicidad (puedes hacer loop si quieres todos)
  const record = event.Records?.[0];
  if (!record) {
    console.error("[TranscribeHandler] No hay records en el evento S3.");
    return;
  }

  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  // Lista de formatos válidos para AWS Transcribe
  const validFormats = [
    "amr", "flac", "m4a", "mp3", "mp4", "ogg", "wav", "webm"
  ];

  // Detecta el formato de audio desde la extensión
  const formatMatch = key.match(/\.([a-zA-Z0-9]+)$/);
  let mediaFormat = "mp3"; // Por defecto

  if (formatMatch) {
    const ext = formatMatch[1].toLowerCase();
    if (validFormats.includes(ext)) {
      mediaFormat = ext;
    } else {
      console.error(`[TranscribeHandler] Formato no soportado: "${ext}". Formatos permitidos: ${validFormats.join(", ")}`);
      // Si prefieres abortar el proceso, puedes retornar aquí:
      // return;
      // O seguir con "mp3" por defecto (pero no recomendable en producción)
    }
  } else {
    console.warn("[TranscribeHandler] No se detectó extensión de archivo. Usando 'mp3' por defecto.");
  }

  // Parámetros del job de transcripción
  const jobName = `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const mediaUri = `s3://${bucket}/${key}`;
  const languageCode = "es-ES"; // Ajusta si lo deseas parametrizable
  const outputBucket = process.env.OUTPUT_BUCKET;

  if (!outputBucket) {
    console.error("[TranscribeHandler] Falta la variable OUTPUT_BUCKET.");
    return;
  }

  const command = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: languageCode,
    MediaFormat: mediaFormat as any, // AWS SDK espera solo valores válidos, ya validados arriba
    Media: { MediaFileUri: mediaUri },
    OutputBucketName: outputBucket,
  });

  try {
    // Envía el comando a AWS Transcribe
    const res = await transcribeClient.send(command);
    console.log("[TranscribeHandler] ✅ Transcription started:", res.TranscriptionJob?.TranscriptionJobName);
  } catch (error) {
    // Logging del error para CloudWatch
    console.error("[TranscribeHandler] ❌ Error:", error);
    throw error;
  }
};
