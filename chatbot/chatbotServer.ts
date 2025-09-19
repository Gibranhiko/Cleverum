import "dotenv/config";
import { createBot, createProvider } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import flow from "./flows";
import AIClass from "./services/ai";

const BOT_PORT = process.env.BOT_PORT;
const PHONE_NUMBER = process.env.PHONE_NUMBER;

// Store active bot instances
const activeBots = new Map<string, any>();

// Function to create a bot instance for a specific client
const createClientBot = async (clientId: string, phoneNumber?: string) => {
  try {
    console.log(`🚀 Starting Bot for client ${clientId}... with phone ${phoneNumber || PHONE_NUMBER}`);

    const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-4o");

    const { httpServer } = await createBot(
      {
        database: new Database(),
        provider: createProvider(Provider, {
          name: `bot-${clientId}`, // Unique session name per client
        }),
        flow: flow,
      },
      { extensions: { ai, clientId } } // Pass clientId in extensions
    );

    activeBots.set(clientId, { httpServer, ai, clientId });
    console.log(`🚀 Bot for client ${clientId} running at port ${BOT_PORT}`);
    return { httpServer, ai };
  } catch (err) {
    console.error(`❌ Bot for client ${clientId} could not start:`, err);
    throw err;
  }
};

// Function to stop a client bot
const stopClientBot = async (clientId: string) => {
  const botInstance = activeBots.get(clientId);
  if (botInstance) {
    // Close the HTTP server
    if (botInstance.httpServer && botInstance.httpServer.close) {
      botInstance.httpServer.close();
    }
    activeBots.delete(clientId);
    console.log(`🛑 Bot for client ${clientId} stopped`);
  }
};

// Main server setup
const main = async () => {
  try {
    // Start with a default bot instance (for backward compatibility)
    if (!activeBots.has('default')) {
      await createClientBot('default', PHONE_NUMBER);
    }

    console.log(`🚀 Chatbot management server running`);
    console.log(`📋 Active bots: ${Array.from(activeBots.keys()).join(', ')}`);

  } catch (err) {
    console.error("❌ App could not start:", err);
  }
};

main();

// Export functions for external use
export { createClientBot, stopClientBot, activeBots };
