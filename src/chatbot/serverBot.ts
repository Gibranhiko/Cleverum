import "dotenv/config";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import AIClass from "./services/ai/index";
import flow from "./flows";
import express from "express";

// Mapa para almacenar las sesiones de bots por usuario
const userBots = new Map();
const usedPorts = new Set();  // Set to track used ports
const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");

// Function to get the next available port
const getNextAvailablePort = () => {
  let port = 8000;
  while (usedPorts.has(port)) {
    port++;  // Increment port number until an available one is found
  }
  usedPorts.add(port);
  return port;
};

const initializeUserBot = async (userId: string) => {
  if (!userBots.has(userId)) {
    try {
      // Get a unique port for this user
      const userPort = getNextAvailablePort();

      const userBot = await createBot(
        {
          database: new MemoryDB(),
          provider: createProvider(Provider, {
            timeRelease: 10800000, // 3 horas en ms
          }),
          flow,
        },
        { extensions: { ai } }
      );

      userBots.set(userId, { userBot, port: userPort });
      console.log(`Bot initialized for user: ${userId} on port ${userPort}`);

      // Start the HTTP server for the bot (this will serve the QR code) on the unique port
      const { httpServer } = userBot;
      httpServer(userPort); // Start server on the unique port for this user

      console.log(`Bot HTTP server running on port ${userPort}`);

    } catch (err) {
      console.error("Error initializing bot for user", userId, err);
    }
  } else {
    console.log(`Bot already exists for user: ${userId}`);
  }
};

// Obtener un bot para un usuario
const getUserBot = (userId: string) => userBots.get(userId);

// Manejar el cierre de sesión y eliminación del bot
const deleteUserBot = (userId: string) => {
  if (userBots.has(userId)) {
    const { userBot, port } = userBots.get(userId);
    userBot.stop(); // Detenemos el bot si tiene un método para esto
    usedPorts.delete(port); // Release the port when the bot is deleted
    userBots.delete(userId);
    console.log(`Bot session removed for user: ${userId} on port ${port}`);
  }
};

const main = async () => {
  try {
    const app = express();

    // API endpoint para inicializar un bot por usuario
    app.post("/start-bot/:userId", async (req, res) => {
      console.log("Starting bot for user:", req);
      const { userId } = req.params;

      await initializeUserBot(userId);

      const userBotData = userBots.get(userId);
      if (userBotData) {
        const { port } = userBotData;
        res.status(200).send(`Bot initialized for user: ${userId}. QR code available at http://localhost:${port}`);
      } else {
        res.status(500).send("Error initializing bot.");
      }
    });

    // API endpoint para obtener el bot de un usuario
    app.get("/get-bot/:userId", (req, res) => {
      const { userId } = req.params;
      const userBot = getUserBot(userId);

      if (userBot) {
        res.status(200).send(`Bot found for user: ${userId}`);
      } else {
        res.status(404).send(`No bot found for user: ${userId}`);
      }
    });

    // API endpoint para eliminar el bot de un usuario
    app.delete("/delete-bot/:userId", (req, res) => {
      const { userId } = req.params;
      deleteUserBot(userId);
      res.status(200).send(`Bot session removed for user: ${userId}`);
    });

    const apiPort = process.env.API_PORT || 3000;
    app.listen(apiPort, () => {
      console.log(`API server running on port ${apiPort}`);
    });

  } catch (err) {
    console.error("Error initializing the API:", err);
  }
};

main();
