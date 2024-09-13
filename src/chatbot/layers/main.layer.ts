import { BotContext, BotMethods } from "@builderbot/bot/dist/types";
import { getHistoryParse } from "../utils/handleHistory";
import AIClass from "../services/ai";
import { flowSeller } from "../flows/seller.flow";
import * as path from "path";
import fs from "fs";
import { flowLocation } from "../flows/location.flow";
import { flowService } from "../flows/service.flow";
import { flowMenu } from "../flows/menu.flow";
import { flowHello } from "../flows/hello.flow";

const discriminatorDataPath = path.join("src/chatbot/prompts", "/prompt-discriminator.txt");
const discriminatorData = fs.readFileSync(discriminatorDataPath, "utf-8");

const PROMPT_DISCRIMINATOR = discriminatorData;

export default async (
  _: BotContext,
  { state, gotoFlow, extensions }: BotMethods
) => {
  const ai = extensions.ai as AIClass;
  const history = getHistoryParse(state);
  const prompt = PROMPT_DISCRIMINATOR;

  console.log(history);

  const { intent } = await ai.determineIntentFn(
    [
      {
        role: "system",
        content: prompt.replace("{HISTORY}", history),
      },
    ],
    "gpt-3.5-turbo"
  );

  console.log(intent + '** IA intent');

  if (intent.includes('hacer_pedido')) return gotoFlow(flowSeller);
  if (intent.includes('preguntar_ubicacion')) return gotoFlow(flowLocation);
  if (intent.includes('consultar_horarios')) return gotoFlow(flowService);
  if (intent.includes('ver_menu')) return gotoFlow(flowMenu);
  if (intent.includes('saludar')) return gotoFlow(flowHello);
  
};