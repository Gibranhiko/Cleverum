import { addKeyword, EVENTS } from "@builderbot/bot";
import { clearHistory, getHistoryParse, handleHistory } from "../utils/handleHistory";
import AIClass from "../services/ai";
import * as path from "path";
import fs from "fs";
import { validateOrder } from "../utils/order";
import { flowConfirmQty } from "./qty-confirm.flow";

const sellerDataPath = path.join("src/chatbot/prompts", "/prompt-seller.txt");
const sellerData = fs.readFileSync(sellerDataPath, "utf-8");

const PROMPT_SELLER = sellerData;

export const generatePromptSeller = (history: string) => {
  return PROMPT_SELLER.replace("{HISTORY}", history);
};

const validProducts = [
  { product: "pollo", type: "qty" },
  { product: "costillas", type: "weight" },
  { product: "carne asada", type: "weight" },
  { product: "alitas", type: "qty" },
  { product: "boneless", type: "qty" },
  { product: "nuggets", type: "qty" },
  { product: "tenders", type: "qty" },
  { product: "coca cola", type: "qty" },
  { product: "coca cola light", type: "qty" },
  { product: "agua de sabor", type: "qty" },
  { product: "paquete 1", type: "qty" },
  { product: "paquete 2", type: "qty" },
];

// Main flow handling the user's order
const flowSeller = addKeyword(EVENTS.ACTION).addAction(
  async (_, { extensions, state, flowDynamic, endFlow, gotoFlow }) => {
    const assiMsgOrder = "Claro, vamos a tomar tu pedido...";
    await flowDynamic(assiMsgOrder);
    await handleHistory({ content: assiMsgOrder, role: "assistant" }, state);

    const ai = extensions.ai as AIClass;
    const history = getHistoryParse(state);
    const promptInfo = generatePromptSeller(history);

    // AI model response for the order
    const { order } = await ai.determineOrderFn(
      [
        {
          role: "system",
          content: promptInfo,
        },
      ],
      "gpt-3.5-turbo"
    );

    console.log(order);

    // Validate if the order contains valid products
    if (!validateOrder(order, validProducts)) {
      const notGetOrderMsg =
        "Te sugiero los siguientes productos: pollo, costillas, carne asada, alitas, boneless, nuggets, tenders, coca cola, coca cola light, agua de sabor, paquete 1, paquete 2";
      await flowDynamic(notGetOrderMsg);
      await clearHistory(state);
      return endFlow();
    }

    // Store the incomplete order in the state
    await state.update({ pendingOrder: order });

    // Check if there are products missing quantity or weight
    for (const item of order) {
      const validProduct = validProducts.find(
        (p) => p.product.toLowerCase() === item.producto.toLowerCase()
      );

      if (validProduct) {
        if (validProduct.type === "qty") {
          // Set state and redirect to the confirmation flow for quantity
          await state.update({
            awaitingQtyFor: item.producto,
            pendingOrder: order,
          });
          return gotoFlow(flowConfirmQty); // Redirect to confirmation flow
        } else if (validProduct.type === "weight") {
          // Redirect to confirm weight (handled elsewhere)
          await state.update({
            awaitingWeightFor: item.producto,
            pendingOrder: order,
          });
          return gotoFlow(flowConfirmQty); // Assuming weight confirmation will also be handled here
        }
      }
    }
  }
);

export { flowSeller };
