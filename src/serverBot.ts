import "dotenv/config";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import AIClass from "./chatbot/services/ai/index";
import flow from "./chatbot/flows";

const PORT = process.env.BOT_PORT || 3001;

const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");

const main = async () => {
  try {
    const adapterProvider = createProvider(Provider, {
      timeRelease: 10800000, // 3 horas en ms
    });

    const { httpServer } = await createBot(
      {
        database: new MemoryDB(),
        provider: adapterProvider,
        flow,
      },
      { extensions: { ai } }
    );

    // Iniciar servidor del bot en un puerto diferente
    httpServer(Number(PORT));
    console.log(`Bot server running on port ${PORT}`);

  } catch (err) {
    console.log("Bot server could not start: " + err);
  }
};

main();
