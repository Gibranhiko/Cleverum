import "dotenv/config";
import { createBot, createProvider } from "@builderbot/bot";
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import flow from "./flows";
import { provider } from "./provider";

const BOT_PORT = process.env.BOT_PORT;
const PHONE_NUMBER = process.env.PHONE_NUMBER

const main = async () => {
  try {
    console.log("🚀 Starting Bot... with phone ", PHONE_NUMBER);
    const { httpServer } = await createBot(
      {
        database: new Database(),
        provider: createProvider(Provider),
        flow: flow,
      }
    );
    console.log("Provider started, waiting for pairing code...", provider);

    httpServer(Number(BOT_PORT));
    console.log("🚀 Bot server running at port " + BOT_PORT);
  } catch (err) {
    console.error("❌ App could not start:", err);
  }
};

main();
