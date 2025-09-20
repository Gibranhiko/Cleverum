import { BotContext, BotMethods } from "@builderbot/bot/dist/types";
import { getHistoryParse } from "../utils/handleHistory";
import AIClass from "../services/ai";
import * as path from "path";
import fs from "fs";
import { flowTalker } from "../flows/ia/talker.flow";
import { appointment } from "../flows/ia/appointment.flow";
import { products } from "../flows/ia/products.flow";

const discriminatorDataPath = path.join(
  "prompts",
  "/prompt-discriminator.txt"
);
const discriminatorData = fs.readFileSync(discriminatorDataPath, "utf-8");

const PROMPT_DISCRIMINATOR = discriminatorData;

export default async (
  _: BotContext,
  { state, gotoFlow, extensions }: BotMethods
) => {
  const ai = extensions.ai as AIClass;
  const history = getHistoryParse(state);
  const prompt = PROMPT_DISCRIMINATOR;


  const { intent } = await ai.determineIntentFn(
    [
      {
        role: "system",
        content: prompt.replace("{HISTORY}", history),
      },
    ]
  );


  if (intent.includes("agendar_cita")) gotoFlow(appointment);
  if (intent.includes("hablar")) gotoFlow(flowTalker);
  if (intent.includes("consultar_servicios")) gotoFlow(products);  
};
