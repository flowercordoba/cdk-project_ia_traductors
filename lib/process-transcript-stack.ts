import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

/**
 * Stack que conecta la salida de Transcribe con Translate y Polly automáticamente.
 */
export class ProcessTranscriptStack extends cdk.Stack {
  public readonly processTranscriptFn: lambda.Function;

  constructor(scope: Construct, id: string, outputBucket: s3.Bucket, props?: cdk.StackProps) {
    super(scope, id, props);

    this.processTranscriptFn = new lambda.Function(this, "ProcessTranscriptFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "process-transcript-handler.handler",
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        OUTPUT_BUCKET: outputBucket.bucketName,
      },
    });

    outputBucket.grantReadWrite(this.processTranscriptFn);

    this.processTranscriptFn.addToRolePolicy(
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
      new s3n.LambdaDestination(this.processTranscriptFn), {
        suffix: ".json"
      }
    );

    new cdk.CfnOutput(this, "ProcessTranscriptFunctionName", {
      value: this.processTranscriptFn.functionName,
    });
  }
}
