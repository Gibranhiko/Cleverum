import express from "express";
import { createBotInstance, runningBots } from "../chatbotServer";
import { cleanupBotSession } from "../services/botService";

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
      bot.server.close(() => {
        console.log(`Server closed for bot ${id}`);
      });
    }
    runningBots.delete(id);

    // Clean up session files
    cleanupBotSession(bot.config.sessionName);

    res.json({ message: `Bot stopped and cleaned up for ${bot.config.name}` });
  } catch (error) {
    console.error('Failed to stop bot:', error);
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

// API endpoint to get status of all bots
router.get('/status', (req, res) => {
  const bots = Array.from(runningBots.entries()).map(([id, bot]) => ({
    id,
    name: bot.config.name,
    port: bot.config.port,
    phone: bot.config.phone,
    sessionName: bot.config.sessionName
  }));
  res.json({ bots, total: bots.length });
});

// API endpoint to cleanup session files
router.post('/cleanup-session', async (req, res) => {
  try {
    const { sessionName } = req.body;
    if (!sessionName) {
      return res.status(400).json({ error: 'Session name required' });
    }

    cleanupBotSession(sessionName);
    res.json({ message: `Session cleaned up for ${sessionName}` });
  } catch (error) {
    console.error('Failed to cleanup session:', error);
    res.status(500).json({ error: 'Failed to cleanup session' });
  }
});

// API endpoint to check if a port is available
router.post('/check-port', async (req, res) => {
  const { port } = req.body;
  if (!port || typeof port !== 'number') {
    return res.status(400).json({ error: 'Port number required' });
  }

  const net = await import('net');
  const server = net.createServer();

  server.listen(port, () => {
    server.close(() => {
      res.json({ available: true });
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      res.json({ available: false });
    } else {
      res.status(500).json({ error: 'Port check failed' });
    }
  });
});

export default router;