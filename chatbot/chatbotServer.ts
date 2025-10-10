import "dotenv/config";
import express from "express";
import { createBot, createProvider } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import flow from "./flows";
import AIClass from "./services/ai";
import ReminderService from "./services/reminder.service";
import botRoutes from "./routes/botRoutes";

const app = express();
app.use(express.json());
app.use('/', botRoutes);

// Track running bots
export const runningBots = new Map(); 

// Initialize reminder service
const reminderService = new ReminderService();
await reminderService.init();

// Function to create and start a bot
export const createBotInstance = async (config: { id: string; name: string; port: number; sessionName: string }) => {
  try {
    console.log(`🚀 Starting ${config.name}`);

    const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-4o");

    const { httpServer, provider } = await createBot(
      {
        database: new Database(),
        provider: createProvider(Provider, {
          name: config.sessionName,
        }),
        flow: flow,
      },
      { extensions: { ai, clientId: config.id } }
    );

    // Set provider for reminder service
    reminderService.setProvider(provider);

    const server = httpServer(config.port);
    console.log(`✅ ${config.name} client running at port ${config.port}`);

    runningBots.set(config.id, { server, provider, config });
    return { server, provider };
  } catch (err) {
    console.error(`❌ ${config.name} could not start:`, err);
    throw err;
  }
};



// Start the server
const PORT = process.env.CHATBOT_PORT || 4000;
app.listen(PORT, async () => {
  console.log(`🤖 Cleverum Chatbot management server running on port ${PORT}`);
});
