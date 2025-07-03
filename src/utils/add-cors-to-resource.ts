import * as apigateway from "aws-cdk-lib/aws-apigateway";

/**
 * Agrega integración CORS completa (todas las cabeceras y métodos comunes) a un recurso API Gateway.
 * @param resource apigateway.Resource
 */
export function addCorsOptions(resource: apigateway.Resource) {
  resource.addMethod('OPTIONS', new apigateway.MockIntegration({
    integrationResponses: [{
      statusCode: "200",
      responseParameters: {
        "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "method.response.header.Access-Control-Allow-Origin": "'*'",
        "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
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
}
