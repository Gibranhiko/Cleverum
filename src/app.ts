import "dotenv/config";
import express from "express";
import next from "next";
import { createBot, MemoryDB } from "@builderbot/bot";
import AIClass from "./chatbot/services/ai/index";
import flow from "./chatbot/flows";
import { provider } from "./chatbot/provider";

const PORT = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== "production";
const clientAdminApp = next({ dev, dir: "./src/client-admin" }); // Using the client-admin directory
const handle = clientAdminApp.getRequestHandler();

const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");

const main = async () => {
  await clientAdminApp.prepare();
  const app = express();

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

  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  httpServer(Number(PORT)+ 1);
};

main();
