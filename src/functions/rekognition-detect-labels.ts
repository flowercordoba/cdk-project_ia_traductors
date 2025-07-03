// src/functions/rekognition-detect-labels.ts

import { S3Handler } from "aws-lambda";
import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const rekognition = new RekognitionClient({});
const s3 = new S3Client({});

// Handler que se dispara al subir imagen al bucket de entrada
export const handler: S3Handler = async (event) => {
  const record = event.Records?.[0];
  if (!record) return;
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  // Detectar etiquetas/objetos con Rekognition usando la referencia S3
  const detectLabelsCommand = new DetectLabelsCommand({
    Image: {
      S3Object: { Bucket: bucket, Name: key }
    },
    MaxLabels: 10,
    MinConfidence: 70
  });

  const response = await rekognition.send(detectLabelsCommand);

  // Guardar el resultado como archivo JSON en el bucket de salida
  const outputKey = key.replace(/\.[^.]+$/, "") + "-labels.json";
  await s3.send(new PutObjectCommand({
    Bucket: process.env.OUTPUT_BUCKET!,
    Key: outputKey,
    Body: JSON.stringify(response.Labels, null, 2),
    ContentType: "application/json"
  }));

  console.log("Etiquetas detectadas y guardadas en:", outputKey);
};
