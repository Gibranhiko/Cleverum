import express from "express";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import fs from "fs";
import qrcode from "qrcode";
import { Boom } from "@hapi/boom";
import cors from "cors";

const app = express();
app.use(cors({ origin: "http://localhost:4000" }));
const userBots = new Map();
const usedPorts = new Set();

const getNextAvailablePort = () => {
  let port = 8000;
  while (usedPorts.has(port)) {
    port++;
  }
  usedPorts.add(port);
  return port;
};

const initializeUserBot = async (userId) => {
  if (!userBots.has(userId)) {
    try {
      const userPort = getNextAvailablePort();
      const authDir = `./sessions/${userId}`;
      if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const sock = makeWASocket({
        auth: state,
      });

      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          const qrImage = await qrcode.toDataURL(qr);
          userBots.set(userId, { sock, port: userPort, qrData: qrImage });
        }

        if (connection === "close") {
          const error = lastDisconnect?.error;
          const shouldReconnect = error instanceof Boom && error.output?.statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect) initializeUserBot(userId);
          else deleteUserBot(userId);
        }
      });

      userBots.set(userId, { sock, port: userPort });
      console.log(`Bot iniciado para usuario: ${userId}`);
    } catch (err) {
      console.error(`Error iniciando bot para usuario ${userId}:`, err);
    }
  }
};

const getUserBot = (userId) => userBots.get(userId);

const deleteUserBot = (userId) => {
  if (userBots.has(userId)) {
    const { sock, port } = userBots.get(userId);
    sock.end();
    usedPorts.delete(port);
    userBots.delete(userId);
    fs.rmSync(`./sessions/${userId}`, { recursive: true, force: true });
    console.log(`Bot eliminado para usuario: ${userId}`);
  }
};

app.get("/get-qr/:userId", (req, res) => {
  const userId = req.params.userId;
  const userBot = getUserBot(userId);
  if (userBot && userBot.qrData) {
    res.status(200).json({ qr: userBot.qrData });
  } else {
    res.status(404).json({ error: "QR no disponible o usuario no encontrado." });
  }
});

app.post("/start-bot/:userId", async (req, res) => {
  const { userId } = req.params;
  await initializeUserBot(userId);
  res.status(200).json({ message: `Bot iniciado para usuario: ${userId}` });
});

app.delete("/delete-bot/:userId", (req, res) => {
  deleteUserBot(req.params.userId);
  res.status(200).json({ message: `Bot eliminado para usuario: ${req.params.userId}` });
});

const apiPort = process.env.API_PORT || 3000;
app.listen(apiPort, () => console.log(`API corriendo en puerto ${apiPort}`));
