import "dotenv/config";
import { io } from "socket.io-client";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import AIClass from "./services/ai/index";
import flow from "./flows";

const PORT = process.env.BOT_PORT;
const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL;
const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-4o");

const socket = io(WEB_PUBLIC_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 5000,
});

socket.on("connect", () => { 
  console.log("Connected to WebSocket server");
});

socket.on("disconnect", () => {
  console.log("Disconnected from WebSocket server");
});

const main = async () => {
  try {
    const adapterProvider = createProvider(Provider, {
      timeRelease: 10800000
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
    
    httpServer(Number(PORT));
  } catch (err) {
    console.log("App could not start: " + err);
  }
};

main();
