import { addKeyword, EVENTS } from "@builderbot/bot";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import * as path from "path";
import fs from "fs";
import { generateTimer } from "../../utils/generateTimer";

const orderPromptPath = path.join("prompts", "/prompt-order.txt");
const orderPromptData = fs.readFileSync(orderPromptPath, "utf-8");
const PROMPT_ORDER = orderPromptData;

export const generatePromptOrder = (history: string, businessData: { companyName: string }) => {
  return PROMPT_ORDER.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessData.companyName);
};

const project = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      // Get AI instance from extensions (Assuming ai is directly available)
      const ai = extensions.ai;

      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);

      // Generate prompt for AI
      const promptInfo = generatePromptOrder(history, businessData);
      
      // AI Chat completion request (returns a string)
      const response = await ai.createChat(
        [{ role: "system", content: promptInfo }],
        "gpt-4-turbo"
      );

      // Store AI response in history
      await handleHistory({ content: response, role: "assistant" }, state);

      // Split response into chunks by sentences
      const chunks = response.split(/(?<!\d)\.\s+/g); // Split on periods, ignoring numerical values

      // Send each chunk with delay
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
