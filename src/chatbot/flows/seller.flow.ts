import { clearHistory, getHistoryParse, handleHistory } from "../utils/handleHistory";
import AIClass from "../services/ai";
import * as path from "path";
import fs from "fs";
import { addKeyword, EVENTS } from "@builderbot/bot";
import { flowConfirm } from "./confirm.flow";
import { validateOrder } from "../utils/order";

const sellerDataPath = path.join("src/chatbot/prompts", "/prompt-seller.txt");
const sellerData = fs.readFileSync(sellerDataPath, "utf-8");

const PROMPT_SELLER = sellerData;

export const generatePromptSeller = (history: string) => {
  return PROMPT_SELLER.replace("{HISTORY}", history);
};

const validProducts = [
  "pollo",
  "costillas",
  "carne asada",
  "alitas",
  "boneless",
  "nuggets",
  "tenders",
  "coca cola",
  "coca cola light",
  "agua de sabor",
  "paquete 1",
  "paquete 2"
];

const flowSeller = addKeyword(EVENTS.ACTION)
  .addAction(async (_, { extensions, state, flowDynamic, endFlow }) => {
    const assiMsgOrder = "Claro, vamos a tomar tu pedido...";
    await flowDynamic(assiMsgOrder);
    await handleHistory({ content: assiMsgOrder, role: "assistant" }, state);
    const ai = extensions.ai as AIClass;
    const history = getHistoryParse(state);
    const promptInfo = generatePromptSeller(history);

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

    if (!validateOrder(order, validProducts)) {
      const notGetOrderMsg = "Lo siento, no he podido entender tu pedido o no contamos con ese producto ahora, ¿Podrías repetirlo?";
      await flowDynamic(notGetOrderMsg);
      await clearHistory(state);
      return endFlow();
    }

    const formattedOrder = order
      .map((item) => `${item.cantidad ?? item.peso} ${item.producto}`)
      .join(", ");

    await state.update({ order: formattedOrder });
    const formattedOrderMsg = `¿Es correcta tu orden de: ${formattedOrder} ? *si* o *no*`;
    await flowDynamic(formattedOrderMsg);
    await handleHistory(
      { content: formattedOrderMsg, role: "assistant" },
      state
    );
  })
  .addAction({ capture: true }, async ({ body }, { gotoFlow, flowDynamic, state, endFlow }) => {
    if (body.toLowerCase().includes("si")) {
      return gotoFlow(flowConfirm);
    } else {
      await flowDynamic("Ok, ¿Qué te gustaría pedir?");
      await clearHistory(state);
      return endFlow();
    }
  });

export { flowSeller };
