import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

/**
 * Stack encargado de la traducción de texto con AWS Translate.
 * Expone la función Lambda translateFn.
 */
export class TranslateStack extends cdk.Stack {
  public readonly translateFn: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.translateFn = new lambda.Function(this, "TranslateFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../src/functions")),
      handler: "translate-handler.handler",
    });

    this.translateFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["translate:TranslateText"],
        resources: ["*"],
      })
    );

    new cdk.CfnOutput(this, "TranslateFunctionName", {
      value: this.translateFn.functionName,
    });
  }
}
