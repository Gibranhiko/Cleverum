import { addKeyword, EVENTS } from "@builderbot/bot";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import * as path from "path";
import fs from "fs";
import { generateTimer } from "../../utils/generateTimer";

const orderPromptPath = path.join("prompts", "/prompt-order.txt");
const orderPromptData = fs.readFileSync(orderPromptPath, "utf-8");
const PROMPT_ORDER = orderPromptData;

export const generatePromptOrder = (
  history: string, 
  businessData: { companyName: string }, 
  products: string
) => {
  return PROMPT_ORDER.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessData.companyName)
    .replace("{PRODUCTS}", products);
};

const project = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai;
      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);

      // Obtener lista de productos de la empresa
      const products = state.get("currentProducts");

      // Generar prompt para la IA
      const promptInfo = generatePromptOrder(history, businessData, products);

      // Solicitud a la IA
      const response = await ai.createChat(
        [{ role: "system", content: promptInfo }],
        "gpt-4-turbo"
      );

      // Guardar respuesta en el historial
      await handleHistory({ content: response, role: "assistant" }, state);

      // Enviar la respuesta en partes con delay
      const chunks = response.split(/(?<!\d)\.\s+/g);
      for (const chunk of chunks) {
        await flowDynamic([
          { body: chunk.trim(), delay: generateTimer(150, 250) },
        ]);
      }
    } catch (err) {
      console.error("[ERROR]:", err);
      await flowDynamic("Hubo un problema procesando tu orden. Inténtalo de nuevo.");
    }
  }
);

export { project };
