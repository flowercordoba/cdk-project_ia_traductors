import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";

/**
 * Stack encargado de la síntesis de voz con AWS Polly.
 * Expone la función Lambda pollyFn.
 */
export class PollyStack extends cdk.Stack {
  public readonly pollyFn: lambda.Function;

  constructor(scope: Construct, id: string, outputBucket: s3.Bucket, props?: cdk.StackProps) {
    super(scope, id, props);

    this.pollyFn = new lambda.Function(this, "PollyFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "polly-handler.handler",
      environment: {
        OUTPUT_BUCKET: outputBucket.bucketName,
      },
    });

    outputBucket.grantWrite(this.pollyFn);

    this.pollyFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["polly:SynthesizeSpeech"],
        resources: ["*"],
      })
    );

    new cdk.CfnOutput(this, "PollyFunctionName", {
      value: this.pollyFn.functionName,
    });
  }
}
