import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class CdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Bucket S3 donde el usuario sube audios para transcribir (entrada)
    const audioBucket = new s3.Bucket(this, "AudioBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Bucket S3 donde Transcribe escribe los JSONs de resultados (salida de transcripción)
    const outputBucket = new s3.Bucket(this, "OutputBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Lambda para lanzar jobs de transcripción al subir audio
    const transcribeFn = new lambda.Function(this, "TranscribeFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "transcribe-handler.handler",
      environment: {
        OUTPUT_BUCKET: outputBucket.bucketName,
      },
    });

    // Permisos: leer del bucket de entrada, escribir al bucket de salida
    audioBucket.grantRead(transcribeFn);
    outputBucket.grantWrite(transcribeFn);

    // Permiso IAM para Transcribe API
    transcribeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["transcribe:StartTranscriptionJob"],
        resources: ["*"],
      })
    );

    // Trigger Lambda: cuando se sube un archivo al bucket de entrada
    audioBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(transcribeFn)
    );

    // Lambda expuesta como endpoint para traducción directa (POST /translate)
    const translateFn = new lambda.Function(this, "TranslateFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "translate-handler.handler",
    });

    // Permiso IAM para Translate API
    translateFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["translate:TranslateText"],
        resources: ["*"],
      })
    );

    // Lambda que procesa automáticamente el JSON generado por Transcribe: [TODO: REVISAR LOS PERSMISOS DE TU CUENTA AWS]
    // - Extrae el texto
    // - Traduce el texto
    // - Sintetiza audio con Polly
    // - Guarda el resultado de Polly (audio) en el mismo bucket de salida
    const processTranscriptFn = new lambda.Function(this, "ProcessTranscriptFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "process-transcript-handler.handler",
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        OUTPUT_BUCKET: outputBucket.bucketName,
      },
    });

    // Permisos S3 (leer el JSON y escribir el audio)
    outputBucket.grantReadWrite(processTranscriptFn);

    // Permisos IAM para Translate y Polly en esta Lambda
    processTranscriptFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "translate:TranslateText",
          "polly:SynthesizeSpeech"
        ],
        resources: ["*"],
      })
    );

    // Trigger Lambda: al crear JSON en outputBucket, dispara processTranscriptFn (solo para archivos .json)
    outputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processTranscriptFn), {
        suffix: ".json"
      }
    );

    // API Gateway REST para el endpoint /translate (Lambda HTTP)
    const api = new apigateway.RestApi(this, "VoiceTranslateApi", {
      restApiName: "Voice Translate Service",
      deployOptions: { stageName: "prod" },
    });

    // Endpoint POST /translate con CORS habilitado
    const translateResource = api.root.addResource("translate");

    // Método POST con CORS headers en la integración
    translateResource.addMethod("POST", new apigateway.LambdaIntegration(translateFn, {
      proxy: true,
      integrationResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Origin": "'*'",
          "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
          "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,POST,GET'",
        },
      }],
    }), {
      methodResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Origin": true,
          "method.response.header.Access-Control-Allow-Headers": true,
          "method.response.header.Access-Control-Allow-Methods": true,
        },
      }]
    });

    // Método OPTIONS (CORS preflight)
    translateResource.addMethod("OPTIONS", new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
          "method.response.header.Access-Control-Allow-Origin": "'*'",
          "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,POST,GET'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": "{\"statusCode\":200}"
      }
    }), {
      methodResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": true,
          "method.response.header.Access-Control-Allow-Origin": true,
          "method.response.header.Access-Control-Allow-Methods": true,
        },
      }]
    });

    // Salida de consola: endpoint de traducción
    new cdk.CfnOutput(this, "TranslateApiUrl", {
      value: `${api.url}translate`,
    });

    // Salida de consola: endpoint base (por si quieres exponer más adelante otros recursos)
    new cdk.CfnOutput(this, "VoiceTranslateApiEndpointPolly", {
      value: `${api.url}`,
    });
  }
}
