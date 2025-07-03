import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

/**
 * Stack para detección de objetos con Rekognition.
 */
export class RekognitionStack extends cdk.Stack {
  public readonly inputBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.inputBucket = new s3.Bucket(this, "ImageInputBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.outputBucket = new s3.Bucket(this, "ImageOutputBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const rekognitionFn = new lambda.Function(this, "RekognitionDetectLabelsFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "rekognition-detect-labels.handler",
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        OUTPUT_BUCKET: this.outputBucket.bucketName,
      },
    });

    this.inputBucket.grantRead(rekognitionFn);
    this.outputBucket.grantWrite(rekognitionFn);

    rekognitionFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["rekognition:DetectLabels"],
      resources: ["*"],
    }));

    this.inputBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(rekognitionFn)
    );

    new cdk.CfnOutput(this, "ImageInputBucketName", {
      value: this.inputBucket.bucketName,
    });
    new cdk.CfnOutput(this, "ImageOutputBucketName", {
      value: this.outputBucket.bucketName,
    });
  }
}
