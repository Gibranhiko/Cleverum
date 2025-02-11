import { addKeyword, EVENTS } from "@builderbot/bot";
import { generateTimer } from "../../utils/generateTimer";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import AIClass from "../../services/ai";
import * as path from "path";
import fs from "fs";
import { formatPrice } from "../../utils/order";

const talkerDataPath = path.join("src/chatbot/prompts", "/prompt-talker.txt");
const talkerData = fs.readFileSync(talkerDataPath, "utf-8");
const PROMPT_TALKER = talkerData;

export const generatePromptSeller = (
  history,
  businessdata,
  currentProducts
) => {
  return PROMPT_TALKER.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessdata.companyName)
    .replace("{BUSINESSDATA.companyAddress}", businessdata.companyAddress)
    .replace("{BUSINESSDATA.companyEmail}", businessdata.companyEmail)
    .replace("{BUSINESSDATA.facebookLink}", businessdata.facebookLink)
    .replace("{BUSINESSDATA.instagramLink}", businessdata.instagramLink)
    .replace("{PRODUCTS}", currentProducts);
};

const flowTalker = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai as AIClass;
      const businessData = state.get("currentProfile");
      const currentProducts = state.get("currentProducts");
      const formattedProducts = currentProducts.map(
        (p) =>
          `${p.name}: ${p.description}, incluye: ${
            p.includes
          }, costo: ${formatPrice(p.options)}\n`
      );
      const history = getHistoryParse(state);
      const promptInfo = generatePromptSeller(
        history,
        businessData,
        formattedProducts
      );

      const response = await ai.createChat(
        [
          {
            role: "system",
            content: promptInfo,
          },
        ],
        "gpt-4-turbo"
      );

      await handleHistory({ content: response, role: "assistant" }, state);
      const chunks = response.split(/(?<!\d)\.\s+/g);
      for (const chunk of chunks) {
        await flowDynamic([
          { body: chunk.trim(), delay: generateTimer(150, 250) },
        ]);
      }
    } catch (err) {
      console.log(`[ERROR]:`, err);
      return;
    }
  }
);

export { flowTalker };
