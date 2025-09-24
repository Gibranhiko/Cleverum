import express from "express";
import fs from "fs";
import path from "path";
import { createBotInstance, runningBots } from "../chatbotServer";

const router = express.Router();

// Authentication middleware
const authenticateSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = req.headers['x-chatbot-secret'] as string;
  if (!secret || secret !== process.env.CHATBOT_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Apply auth to all routes
router.use(authenticateSecret);

// API endpoint to start a bot
router.post('/start-bot', async (req, res) => {
  try {
    const config = req.body;
    if (runningBots.has(config.id)) {
      return res.status(400).json({ error: 'Bot already running for this client' });
    }

    await createBotInstance(config);
    res.json({ message: `Bot started for ${config.name}` });
  } catch (error) {
    console.error('Failed to start bot:', error);
    res.status(500).json({ error: 'Failed to start bot' });
  }
});

// API endpoint to stop a bot
router.post('/stop-bot', async (req, res) => {
  try {
    const { id } = req.body;
    if (!runningBots.has(id)) {
      return res.status(404).json({ error: 'Bot not running' });
    }

    const bot = runningBots.get(id);
    if (bot?.server) {
      // Close the HTTP server
      bot.server.close();
    }
    runningBots.delete(id);

    // Clean up session folder
    const sessionFolder = path.join(process.cwd(), `${bot.config.sessionName}_sessions`);
    if (fs.existsSync(sessionFolder)) {
      fs.rmSync(sessionFolder, { recursive: true, force: true });
    }

    // Clean up QR file
    const qrFile = path.join(process.cwd(), `${bot.config.sessionName}.qr.png`);
    if (fs.existsSync(qrFile)) {
      fs.unlinkSync(qrFile);
    }

    res.json({ message: `Bot stopped and cleaned up for ${bot.config.name}` });
  } catch (error) {
    console.error('Failed to stop bot:', error);
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

export default router;