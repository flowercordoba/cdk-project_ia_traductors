import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

/**
 * Stack encargado de manejar el procesamiento de audio con AWS Transcribe.
 * Expone los buckets de entrada y salida y la función Lambda transcribeFn.
 */
export class AudioStack extends cdk.Stack {
  public readonly audioBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly transcribeFn: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.audioBucket = new s3.Bucket(this, "AudioBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.outputBucket = new s3.Bucket(this, "OutputBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.transcribeFn = new lambda.Function(this, "TranscribeFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "transcribe-handler.handler",
      environment: {
        OUTPUT_BUCKET: this.outputBucket.bucketName,
      },
    });

    this.audioBucket.grantRead(this.transcribeFn);
    this.outputBucket.grantWrite(this.transcribeFn);

    this.transcribeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["transcribe:StartTranscriptionJob"],
        resources: ["*"],
      })
    );

    this.audioBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.transcribeFn)
    );

    new cdk.CfnOutput(this, "AudioInputBucket", {
      value: this.audioBucket.bucketName,
    });
    new cdk.CfnOutput(this, "AudioOutputBucket", {
      value: this.outputBucket.bucketName,
    });
  }
}
