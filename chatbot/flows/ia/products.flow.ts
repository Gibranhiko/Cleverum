import { addKeyword, EVENTS } from "@builderbot/bot";
import { generateTimer } from "../../utils/generateTimer";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import AIClass from "../../services/ai";
import * as path from "path";
import fs from "fs";
import { formatPrice } from "../../utils/order";

const talkerDataPath = path.join("prompts", "/prompt-products.txt");
const talkerData = fs.readFileSync(talkerDataPath, "utf-8");
const PROMPT_TALKER = talkerData;

export const generatePromptSeller = (
  history,
  businessdata,
  currentProducts
) => {
  return PROMPT_TALKER.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessdata.companyName)
    .replace("{PRODUCTS}", currentProducts);
};

const products = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai as AIClass;
      const businessData = state.get("currentProfile");
      const currentProducts = state.get("currentProducts");
      const formattedProducts = currentProducts.map(
        (p) =>
          `${p.name}: ${p.description}, incluye: ${
            p.includes
          }, costo: ${formatPrice(p.options)}, url: ${p.imageUrl}`
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
        ]
      );

      await handleHistory({ content: response, role: "assistant" }, state);

      const imageMatch = response.match(/IMAGEN_SOLICITADA:\s*(.+)/);
      const requestedProductName = imageMatch ? imageMatch[1].trim() : null;

      const cleanResponse = response.replace(/IMAGEN_SOLICITADA:.*/, "").trim();
      const chunks = cleanResponse.split(/(?<!\d)\.\s+/g);
      for (const chunk of chunks) {
        await flowDynamic([
          { body: chunk.trim(), delay: generateTimer(150, 250) },
        ]);
      }
      if (requestedProductName) {
        const product = currentProducts.find(
          (p) => p.name.toLowerCase() === requestedProductName.toLowerCase()
        );
        if (product && product.imageUrl) {
          await flowDynamic([{ media: product.imageUrl }]);
        }
      }
    } catch (err) {
      console.log(`[ERROR]:`, err);
      return;
    }
  }
);

export { products };
