import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { AudioStack } from "./audio-stack";
import { TranslateStack } from "./translate-stack";
import { PollyStack } from "./polly-stack";
import { ProcessTranscriptStack } from "./process-transcript-stack";
import { ApiGatewayStack } from "./api-gateway-stack";
import { RekognitionStack } from "./rekognition-stack";

/**
 * Stack principal: instancia y conecta todos los stacks por separado.
 */
export class CdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Audio, Transcribe
    const audioStack = new AudioStack(this, "AudioStack");

    // // Translate
    // const translateStack = new TranslateStack(this, "TranslateStack");

    // // Polly (usa el output bucket del audioStack)
    // const pollyStack = new PollyStack(this, "PollyStack", audioStack.outputBucket);

    // // Automatiza el procesamiento del JSON de transcribe (translate + polly)
    // const processTranscriptStack = new ProcessTranscriptStack(this, "ProcessTranscriptStack", audioStack.outputBucket);

    // // API Gateway (expone /translate por HTTP)
    // new ApiGatewayStack(this, "ApiGatewayStack", translateStack.translateFn);
    // const rekognitionStack = new RekognitionStack(this, "RekognitionStack", {
    // });
  }
}
