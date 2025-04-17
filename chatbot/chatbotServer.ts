import "dotenv/config";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import AIClass from "./services/ai/index";
import flow from "./flows";

const BOT_PORT = process.env.BOT_PORT || 4000;
const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-4o");

const main = async () => {
  try {
    console.log("👉 Initializing BuilderBot with Baileys provider...");

    const adapterProvider = createProvider(Provider);

    console.log("✅ Provider created.");

    // This initializes the internal express server required by Baileys
    adapterProvider.initHttpServer(Number(BOT_PORT));
    console.log("✅ Provider HTTP server initialized on port:", BOT_PORT);

    const { httpServer } = await createBot(
      {
        database: new MemoryDB(),
        provider: adapterProvider,
        flow,
      },
      { extensions: { ai } }
    );

    console.log("✅ Bot instance created.");

    httpServer(Number(BOT_PORT));
    console.log("🚀 Bot server running at http://localhost:" + BOT_PORT);
  } catch (err) {
    console.error("❌ App could not start:", err);
  }
};

main();
