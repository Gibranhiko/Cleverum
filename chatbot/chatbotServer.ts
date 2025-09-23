import "dotenv/config";
import { createBot, createProvider } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import flow from "./flows";
import AIClass from "./services/ai";
import ReminderService from "./services/reminder.service";

const BOT_PORT_1 = process.env.BOT_PORT || "4000";
const BOT_PORT_2 = process.env.BOT_PORT_2 || "4001";
const PHONE_NUMBER_1 = process.env.PHONE_NUMBER_1 || process.env.PHONE_NUMBER;
const PHONE_NUMBER_2 = process.env.PHONE_NUMBER_2;

// Bot configuration
const botConfigs = [
  {
    id: "68cdc85e5eb788f7dcce041f",
    name: "Bot 1",
    port: BOT_PORT_1,
    phone: PHONE_NUMBER_1,
    sessionName: "bot-session-1"
  },
  {
    id: "68cdc9a35eb788f7dcce042d",
    name: "Bot 2",
    port: BOT_PORT_2,
    phone: PHONE_NUMBER_2,
    sessionName: "bot-session-2"
  }
];

// Initialize reminder service
const reminderService = new ReminderService();
await reminderService.init();

// Function to create and start a bot
const createBotInstance = async (config: typeof botConfigs[0]) => {
  try {
    console.log(`🚀 Starting ${config.name}... with phone ${config.phone}`);

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

    httpServer(Number(config.port));
    console.log(`✅ ${config.name} running at port ${config.port}`);

    return { httpServer, ai };
  } catch (err) {
    console.error(`❌ ${config.name} could not start:`, err);
    throw err;
  }
};

// Main server setup
const main = async () => {
  try {
    console.log("🤖 Starting Cleverum Chatbot Server...");
    console.log("📱 Creating 2 bot instances with QR codes\n");

    // Create both bots sequentially
    for (const config of botConfigs) {
      await createBotInstance(config);
    }

    console.log("\n🎉 All bots started successfully!");
    console.log("📋 Active bots: client-a, client-b");
    console.log("🔗 Scan the QR codes in your terminal to connect WhatsApp");

  } catch (err) {
    console.error("❌ Server could not start:", err);
    process.exit(1);
  }
};

main();
