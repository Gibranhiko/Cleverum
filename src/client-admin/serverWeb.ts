import "dotenv/config";
import express from "express";
import next from "next";
import { createServer } from "http";
import { Server } from "socket.io";
import connectToDatabase from "./app/api/utils/mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const PORT = process.env.WEB_PORT;
const dev = process.env.NODE_ENV !== "production";
const clientAdminApp = next({ dev, dir: "./src/client-admin" });
const handle = clientAdminApp.getRequestHandler();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
  try {
    await clientAdminApp.prepare();
    const app = express();
    const httpWebServer = createServer(app);

    await connectToDatabase("orders");
    console.log("Connected to MongoDB");

    app.get("/getqr", (req, res) => {
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

    // Next.js handler
    app.all("*", (req, res) => {
      return handle(req, res);
    });

    // WebSockets
    const io = new Server(httpWebServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    global.io = io;

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

    httpWebServer.listen(PORT, () => {
      console.log(`Web server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.log("Web server could not start: " + err);
  }
};

main();
