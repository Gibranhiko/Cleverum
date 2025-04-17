import "dotenv/config";
import { createBot, createProvider } from "@builderbot/bot";
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import flow from "./flows";

const BOT_PORT = process.env.BOT_PORT || 4000;

const main = async () => {
  try {
    console.log("🚀 Starting Bot...");
    const { httpServer } = await createBot(
      {
        database: new Database(),
        provider: createProvider(Provider, {usePairingCode: true}),
        flow: flow,
      }
    );

    httpServer(Number(BOT_PORT));
    console.log("🚀 Bot server running at port " + BOT_PORT);
  } catch (err) {
    console.error("❌ App could not start:", err);
  }
};

main();
