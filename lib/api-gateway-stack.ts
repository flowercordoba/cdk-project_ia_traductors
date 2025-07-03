import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { addCorsOptions } from "./cors-utils";

/**
 * Stack de API Gateway con recurso /translate protegido con CORS
 */
export class ApiGatewayStack extends cdk.Stack {
  constructor(scope: Construct, id: string, translateFn: lambda.IFunction, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, "VoiceTranslateApi", {
      restApiName: "Voice Translate Service",
      deployOptions: { stageName: "prod" },
    });

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
  }
}
