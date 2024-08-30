import { getHistoryParse, handleHistory } from "../utils/handleHistory";
import AIClass from "../services/ai";
import * as path from "path";
import fs from "fs";
import { readSheet } from "src/chatbot/services/sheets/sheets";
import { transformMenu } from "src/chatbot/utils/sheetUtils";
import { addKeyword, EVENTS } from "@builderbot/bot";
import { flowConfirm } from "./confirm.flow";

// const sellerDataPath = path.join("src/chatbot/prompts", "/prompt-seller.txt");
// const sellerData = fs.readFileSync(sellerDataPath, "utf-8");

// const PROMPT_SELLER = sellerData;

// export const generatePromptSeller = (history: string, menuData: string) => {
//   return PROMPT_SELLER.replace("{HISTORY}", history).replace(
//     "{MENUDATA}",
//     menuData
//   );
// };

const flowLocation = addKeyword(EVENTS.ACTION)
  .addAction(async (_, { extensions, state, flowDynamic }) => {
    await flowDynamic("Flujo de ubicación...");
  //   const ai = extensions.ai as AIClass;
  //   const history = getHistoryParse(state);
  //   const menuDataRaw = await readSheet("Hoja 3!A:D");
  //   const menuData = transformMenu(menuDataRaw);
  //   const promptInfo = generatePromptSeller(history, menuData);

  //   const { order } = await ai.determineOrderFn(
  //     [
  //       {
  //         role: "system",
  //         content: promptInfo,
  //       },
  //     ],
  //     "gpt-3.5-turbo"
  //   );

  //   const formattedOrder = order
  //     .map((item) => `${item.cantidad ?? item.peso} ${item.producto}`)
  //     .join(", ");
    
  //   await handleHistory({ content: formattedOrder, role: 'assistant' }, state);
  //   await state.update({ order: formattedOrder });
  //   await flowDynamic(
  //     `¿Es correcta tu orden de: ${formattedOrder} ? *si* o *no*`
  //   );
  // })
  // .addAction(
  //   { capture: true },
  //   async ({ body }, { gotoFlow, flowDynamic }) => {
  //     if (body.toLowerCase().includes("si")) {
  //       return gotoFlow(flowConfirm);
  //     } else {
  //       await flowDynamic("Ok, ¿qué más te gustaría pedir?");
  //     }
    }
  );

export { flowLocation };
