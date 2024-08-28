import { addKeyword, EVENTS } from "@builderbot/bot";
import { generateTimer } from "../utils/generateTimer";
import { getHistoryParse, handleHistory } from "../utils/handleHistory";
import AIClass from "../services/ai";
import { getFullCurrentDate } from "src/utils/currentDate";
import * as path from "path";
import fs from "fs";

const businessDataPath = path.join("prompts", "/base-data.txt");
const businessData = fs.readFileSync(businessDataPath, "utf-8");

const talkerDataPath = path.join("prompts", "/prompt-talker.txt");
const talkerData = fs.readFileSync(talkerDataPath, "utf-8");

const PROMPT_TALKER = talkerData;

export const generatePromptSeller = (history: string, businessdata:string) => {
    const nowDate = getFullCurrentDate()
    return PROMPT_TALKER
        .replace('{HISTORY}', history)
        .replace('{CURRENT_DAY}', nowDate)
        .replace('{BUSINESSDATA}', businessdata)
};

const flowTalker = addKeyword(EVENTS.ACTION)
    .addAction(async (_, { state, flowDynamic, extensions }) => {
        try {
            console.log('*** Talker Flow ***');

            const ai = extensions.ai as AIClass
            const history = getHistoryParse(state)

            const promptInfo = generatePromptSeller(history, businessData)

            console.log(promptInfo, 'talker prompt info')

            const response = await ai.createChat([
                {
                    role: 'system',
                    content: promptInfo
                }
            ])

            console.log(response, 'talker response')

            await handleHistory({ content: response, role: 'assistant' }, state)
            const chunks = response.split(/(?<!\d)\.\s+/g);
            for (const chunk of chunks) {
                await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }]);
            }
        } catch (err) {
            console.log(`[ERROR]:`, err)
            return
        }
    })

export { flowTalker }