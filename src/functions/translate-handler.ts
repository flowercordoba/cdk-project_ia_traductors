import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { APIGatewayProxyHandler } from "aws-lambda";

const translateClient = new TranslateClient({ region: process.env.AWS_REGION });


export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("[TranslateHandler] Evento recibido:", JSON.stringify(event));

  try {
    if (!event.body) {
      console.error("[TranslateHandler] Body requerido pero no encontrado");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Body requerido" }),
      };
    }

    let bodyParsed: { text?: string; sourceLang?: string; targetLang?: string };
    try {
      bodyParsed = JSON.parse(event.body);
    } catch (e) {
      console.error("[TranslateHandler] Body mal formado:", event.body);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Body JSON mal formado" }),
      };
    }

    const { text, sourceLang, targetLang } = bodyParsed;
    if (!text || !sourceLang || !targetLang) {
      console.error("[TranslateHandler] Faltan campos requeridos", { text, sourceLang, targetLang });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan campos: text, sourceLang, targetLang" }),
      };
    }

    const command = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLang,
      TargetLanguageCode: targetLang,
    });

    const response = await translateClient.send(command);

    console.log("[TranslateHandler] Traducción exitosa:", response);

    return {
      statusCode: 200,
      body: JSON.stringify({
        translatedText: response.TranslatedText,
      }),
    };
  } catch (err) {
    console.error("[TranslateHandler] Error inesperado:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno del servidor" }),
    };
  }
};
