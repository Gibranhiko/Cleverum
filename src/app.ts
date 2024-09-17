import "dotenv/config";
import express from "express";
import next from "next";
import { createServer } from "http";
import { createBot, MemoryDB } from "@builderbot/bot";
import AIClass from "./chatbot/services/ai/index";
import flow from "./chatbot/flows";
import { provider } from "./chatbot/provider";
import connectToDatabase from "./client-admin/app/utils/mongoose";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== "production";
const clientAdminApp = next({ dev, dir: "./src/client-admin" });
const handle = clientAdminApp.getRequestHandler();

const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");

const main = async () => {
  await clientAdminApp.prepare();
  const app = express();

  // Create an HTTP server instance from Express
  const httpWebServer = createServer(app);

  // Connect to MongoDB
  await connectToDatabase("orders");
  console.log("Connected to MongoDB");

  // Handle Next.js app router requests
  app.all("*", (req, res) => {
    return handle(req, res);
  });

  // Bot routes or middleware
  const { httpServer } = await createBot(
    {
      database: new MemoryDB(),
      provider,
      flow,
    },
    { extensions: { ai } }
  );

  // Initialize Socket.IO
  const io = new Server(httpWebServer, {
    cors: {
      origin: "*", // Handle specific origin request on PROD
      methods: ["GET", "POST"],
    },
  });

  global.io = io;

  // Handle WebSocket connections
  io.on("connection", (socket) => {
    console.log("New WebSocket connection:", socket.id);

    socket.on("new-order", (order) => {
      console.log("New order received:", order);

      io.emit("new-order", order);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Start the server
  httpWebServer.listen(PORT, () => {
    console.log(`Web server running on http://localhost:${PORT}`);
  });

  httpServer(Number(PORT) + 1);
};

main();
