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

// API endpoint to proxy QR code requests to per-bot servers
router.get('/qr', async (req, res) => {
  const port = Number(req.query.port);
  if (!port) {
    return res.status(400).json({ error: 'Port query required' });
  }

  const http = await import('http');

  const options = {
    hostname: '127.0.0.1', // inside chatbot container, bots bind to 0.0.0.0/127.0.0.1
    port,
    path: '/', // path the per-bot exposes
    method: 'GET'
  };

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Error proxying QR request to bot:', err);
    res.status(502).json({ error: 'Failed to retrieve QR from bot' });
  });

  proxyReq.end();
});

// API endpoint to get session data for backup
router.post('/get-session-data', async (req, res) => {
  try {
    const { sessionFolderName } = req.body;
    if (!sessionFolderName) {
      return res.status(400).json({ error: 'Session folder name required' });
    }

    const fs = await import('fs');
    const path = await import('path');
    const sessionPath = path.join(process.cwd(), sessionFolderName);

    if (!fs.existsSync(sessionPath)) {
      return res.status(404).json({ error: 'Session folder not found' });
    }

    const sessionData: any = {};

    // Read all JSON files in the session folder
    const files = fs.readdirSync(sessionPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(sessionPath, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const fileName = file.replace('.json', '');
          sessionData[fileName] = JSON.parse(fileContent);
        } catch (error) {
          console.error(`Error reading ${file}:`, error);
          // Continue with other files even if one fails
        }
      }
    }

    // Also include any other important files (non-JSON)
    const importantFiles = ['app-state-sync-version.json', 'session-info.json'];
    for (const file of importantFiles) {
      if (files.includes(file)) {
        try {
          const filePath = path.join(sessionPath, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const fileName = file.replace('.json', '');
          sessionData[fileName] = JSON.parse(fileContent);
        } catch (error) {
          console.error(`Error reading ${file}:`, error);
        }
      }
    }

    console.log(`📦 Session data collected for ${sessionFolderName}: ${Object.keys(sessionData).length} files`);

    res.json({
      sessionFolderName,
      sessionData,
      fileCount: Object.keys(sessionData).length,
      collectedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get session data:', error);
    res.status(500).json({ error: 'Failed to get session data' });
  }
});

// API endpoint to restore session data from backup
router.post('/restore-session-data', async (req, res) => {
  try {
    const { sessionFolderName, sessionData } = req.body;
    if (!sessionFolderName || !sessionData) {
      return res.status(400).json({ error: 'Session folder name and session data required' });
    }

    const fs = await import('fs');
    const path = await import('path');
    const sessionPath = path.join(process.cwd(), sessionFolderName);

    // Create session folder if it doesn't exist
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Write each file from sessionData.sessionData
    let filesRestored = 0;
    for (const [fileName, fileContent] of Object.entries(sessionData.sessionData)) {
      try {
        const filePath = path.join(sessionPath, `${fileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2), 'utf8');
        filesRestored++;
      } catch (error) {
        console.error(`Error writing ${fileName}:`, error);
        // Continue with other files even if one fails
      }
    }

    console.log(`📦 Session data restored for ${sessionFolderName}: ${filesRestored} files`);

    res.json({
      success: true,
      sessionFolderName,
      filesRestored,
      restoredAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to restore session data:', error);
    res.status(500).json({ error: 'Failed to restore session data' });
  }
});

// API endpoint to list all session folders (for debugging)
router.get('/list-sessions', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const sessionsDir = process.cwd();
    
    if (!fs.existsSync(sessionsDir)) {
      return res.json({
        message: 'Sessions directory not found',
        sessions: [],
        total: 0
      });
    }
    
    const allItems = fs.readdirSync(sessionsDir, { withFileTypes: true });
    const sessionFolders = allItems
      .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('session-'))
      .map(dirent => ({
        name: dirent.name,
        path: path.join(sessionsDir, dirent.name),
        isBackup: dirent.name.includes('_backup_')
      }));
    
    console.log(`📁 Found ${sessionFolders.length} session folders:`);
    sessionFolders.forEach(folder => {
      console.log(`  ${folder.isBackup ? '💾' : '📱'} ${folder.name}`);
    });
    
    res.json({
      message: 'Session folders listed successfully',
      sessions: sessionFolders,
      total: sessionFolders.length
    });
  } catch (error) {
    console.error('Failed to list session folders:', error);
    res.status(500).json({ error: 'Failed to list session folders' });
  }
});

export default router;
