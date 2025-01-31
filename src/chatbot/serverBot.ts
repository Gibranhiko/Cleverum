import express from "express";
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";

const app = express();
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
        printQRInTerminal: false,  // Disable printing QR code in the terminal
      });

      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
  if (qr) {
    fs.writeFileSync(`./qrs/bot_${userId}.png`, qr);
    console.log(`QR guardado en ./qrs/bot_${userId}.png`);
  }
  
  if (connection === "close") {
    // Check if lastDisconnect exists and if it has an error with output
    if (connection === "close") {
      const error = lastDisconnect?.error as { output?: { statusCode: number } }; // Type assertion
      if (error?.output?.statusCode !== undefined) {
        const shouldReconnect = error.output.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) initializeUserBot(userId);
        else deleteUserBot(userId);
      } else {
        console.error("Error: Disconnect reason does not contain output or statusCode.");
      }
    }
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
    res.status(200).send(userBot.qrData);  // Send the QR as base64 to the browser
  } else {
    res.status(404).send("QR no disponible o usuario no encontrado.");
  }
});

app.post("/start-bot/:userId", async (req, res) => {
  const { userId } = req.params;
  await initializeUserBot(userId);
  res.status(200).send(`Bot iniciado para usuario: ${userId}`);
});

app.delete("/delete-bot/:userId", (req, res) => {
  deleteUserBot(req.params.userId);
  res.status(200).send(`Bot eliminado para usuario: ${req.params.userId}`);
});

const apiPort = process.env.API_PORT || 3000;
app.listen(apiPort, () => console.log(`API corriendo en puerto ${apiPort}`));
