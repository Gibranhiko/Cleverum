import "dotenv/config";
import express from "express";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import AIClass from "./services/ai/index";
import flow from "./flows";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";

const PORT = process.env.BOT_PORT;
const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
  try {
    const app = express();

    app.use(
      cors({
        origin: process.env.WEB_PUBLIC_URL,
        methods: ["GET", "POST"], 
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    const adapterProvider = createProvider(Provider, {
      timeRelease: 10800000,
    });

    // Serve QR code image
    app.get("/getqr", (_, res) => {
      const qrImagePath = path.join(__dirname, "../bot.qr.png");
      fs.readFile(qrImagePath, (err, data) => {
        if (err) {
          console.log("Error reading the QR code image:", err);
          return res.status(500).send("Error reading the QR code image");
        }
        res.contentType("image/png");
        res.send(data);
      });
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

    // Start the server
    console.log(PORT, "Bot server is running");
    httpServer(Number(PORT));
  } catch (err) {
    console.log("App could not start: " + err);
  }
};

main();
