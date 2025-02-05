import { BotContext, BotMethods } from "@builderbot/bot/dist/types";
import { getHistoryParse } from "../utils/handleHistory";
import AIClass from "../services/ai";
import * as path from "path";
import fs from "fs";
import { flowTalker } from "../flows/ia/talker.flow";
import { flowSeller } from "../flows/ia/seller.flow";

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
  if (intent.includes('hablar')) return gotoFlow(flowTalker);  
};