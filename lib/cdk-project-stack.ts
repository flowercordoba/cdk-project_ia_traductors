import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { addCorsOptions } from "./cors-utils";

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

    audioBucket.grantRead(transcribeFn);
    outputBucket.grantWrite(transcribeFn);

    transcribeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["transcribe:StartTranscriptionJob"],
        resources: ["*"],
      })
    );

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

    translateFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["translate:TranslateText"],
        resources: ["*"],
      })
    );

    // Lambda que procesa automáticamente el JSON generado por Transcribe:
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

    outputBucket.grantReadWrite(processTranscriptFn);

    processTranscriptFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "translate:TranslateText",
          "polly:SynthesizeSpeech"
        ],
        resources: ["*"],
      })
    );

    outputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processTranscriptFn), {
      suffix: ".json"
    }
    );

    /**
     * Lambda para procesamiento de imágenes con Rekognition.
      * Esta Lambda se activa al subir imágenes al bucket de audio.
     */
    const rekognitionFn = new lambda.Function(this, "RekognitionFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "rekognition-handler.handler",
      environment: {
        BUCKET_NAME: audioBucket.bucketName, 
      },
    });

    // Permisos necesarios para que la Lambda use Rekognition y lea del bucket
    rekognitionFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "rekognition:DetectLabels",
          "rekognition:DetectFaces",
          "rekognition:DetectText",
          "rekognition:RecognizeCelebrities",
        ],
        resources: ["*"],
      })
    );
    audioBucket.grantRead(rekognitionFn);

    // Notificación automática al subir imagenes (ajusta EventType si quieres otro trigger)
    audioBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(rekognitionFn), { suffix: '.jpg' }
    );

    // API Gateway REST para el endpoint /translate (Lambda HTTP)
    const api = new apigateway.RestApi(this, "VoiceTranslateApi", {
      restApiName: "Voice Translate Service",
      deployOptions: { stageName: "prod" },
    });

    // Endpoint POST /translate con CORS habilitado
    const translateResource = api.root.addResource("translate");

    translateResource.addMethod("POST", new apigateway.LambdaIntegration(translateFn, {
      proxy: true,
      integrationResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Origin": "'*'",
          "method.response.header.Access-Control-Allow-Headers":
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers'",
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

    addCorsOptions(translateResource);

    new cdk.CfnOutput(this, "TranslateApiUrl", {
      value: `${api.url}translate`,
    });

    new cdk.CfnOutput(this, "VoiceTranslateApiEndpointPolly", {
      value: `${api.url}`,
    });
  }
}
