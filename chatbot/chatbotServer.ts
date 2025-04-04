import "dotenv/config";
import { io } from "socket.io-client";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import AIClass from "./services/ai/index";
import flow from "./flows";

const BOT_PORT = process.env.BOT_PORT;
const WEB_SOCKET_PORT = process.env.WEB_SOCKET_PORT;
const WEB_SOCKET_URL = process.env.WEB_SOCKET_URL;
const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-4o");


const socket = io(`${WEB_SOCKET_URL}:${WEB_SOCKET_PORT}/`, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 5000,
});

console.log(`Connecting to WebSocket server at: ${WEB_SOCKET_URL}:${WEB_SOCKET_PORT}`);

socket.on("connect", () => { 
  console.log("Connected to WebSocket server");
});

socket.on("disconnect", () => {
  console.log("Disconnected from WebSocket server");
});

// Log the reconnection attempts and errors
socket.on("reconnect_attempt", (attempt) => {
  console.log(`Reconnecting... Attempt ${attempt}`);
});

socket.on("connect_error", (error) => {
  console.error("WebSocket connection error:", error);
});

const main = async () => {
  try {
    // Log that we're initializing the bot
    console.log("Initializing the bot...");

    const adapterProvider = createProvider(Provider, {
      timeRelease: 10800000,
    });

    // Bot server and provide configuration
    const { httpServer } = await createBot(
      {
        database: new MemoryDB(),
        provider: adapterProvider,
        flow,
      },
      { extensions: { ai } }
    );

    console.log("Bot server started, listening on port:", BOT_PORT);

    // Start the HTTP server
    httpServer(Number(BOT_PORT));
  } catch (err) {
    // Log any errors that occur during initialization
    console.error("App could not start: " + err);
  }
};

main();
