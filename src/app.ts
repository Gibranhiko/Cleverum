import "dotenv/config";
import { createBot, MemoryDB } from "@builderbot/bot";
import AIClass from "./services/ai/index";
import flow from "./flows";
import { provider } from "./provider";

const PORT1 = process.env.BOT_PORT ?? 3001;

const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");

const main = async () => {

  const { httpServer } = await createBot({
    database: new MemoryDB(),
    provider,
    flow,
}, { extensions: { ai } })

  httpServer(+PORT1);
};

main();
