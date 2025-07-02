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

    // Buckets
    const audioBucket = new s3.Bucket(this, "AudioBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const outputBucket = new s3.Bucket(this, "OutputBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // // Lambda de transcripción
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

    // Lambda de traducción
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

    const api = new apigateway.RestApi(this, "VoiceTranslateApi", {
      restApiName: "Voice Translate Service",
      deployOptions: { stageName: "prod" },
    });

    const translateResource = api.root.addResource("translate");
    translateResource.addMethod("POST", new apigateway.LambdaIntegration(translateFn));

    new cdk.CfnOutput(this, "TranslateApiUrl", {
      value: `${api.url}translate`,
    });
  }
}
