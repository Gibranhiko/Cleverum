import { addKeyword, EVENTS } from "@builderbot/bot";
import { generateTimer } from "../../utils/generateTimer";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import AIClass from "../../services/ai";
import * as path from "path";
import fs from "fs";

const talkerDataPath = path.join("prompts", "/prompt-talker.txt");
const talkerData = fs.readFileSync(talkerDataPath, "utf-8");
const PROMPT_TALKER = talkerData;

export const generatePromptSeller = (
  history,
  businessdata,
) => {
  return PROMPT_TALKER.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessdata.companyName)
    .replace("{BUSINESSDATA.whatsappPhone}", businessdata.whatsappPhone)
    .replace("{BUSINESSDATA.companyAddress}", businessdata.companyAddress)
    .replace("{BUSINESSDATA.companyEmail}", businessdata.companyEmail)
    .replace("{BUSINESSDATA.facebookLink}", businessdata.facebookLink)
    .replace("{BUSINESSDATA.instagramLink}", businessdata.instagramLink)
};

const flowTalker = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai as AIClass;
      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);
      const promptInfo = generatePromptSeller(
        history,
        businessData,
      );

      console.log("Prompt Info Talker Flow: ", promptInfo);

      const response = await ai.createChat(
        [
          {
            role: "system",
            content: promptInfo,
          },
        ]
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
