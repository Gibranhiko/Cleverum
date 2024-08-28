import { BotContext, BotMethods } from "@builderbot/bot/dist/types";
import { getHistoryParse } from "../utils/handleHistory";
import AIClass from "../services/ai";
import { flowSeller } from "../flows/seller.flow";
import { flowTalker } from "../flows/talker.flow";
import * as path from "path";
import fs from "fs";

const discriminatorDataPath = path.join("prompts", "/prompt-discriminator.txt");
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

  console.log(intent);

  if (intent.includes('hacer_pedido')) return gotoFlow(flowSeller);
  // if (prediction.includes('COMPRAR')) return gotoFlow(flowSeller)
};
