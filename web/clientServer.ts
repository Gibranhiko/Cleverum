import "dotenv/config";
import next from "next";
import { createServer } from "http";
import connectToDatabase from "./app/api/utils/mongoose";
import { Server } from "socket.io";

const WEB_PORT = process.env.WEB_PORT;
const BOT_PORT = process.env.BOT_PORT;
const WEB_SOCKET_PORT = process.env.WEB_SOCKET_PORT;
const PUBLIC_URL = process.env.PUBLIC_URL;

const dev = process.env.NODE_ENV !== "production";
const clientAdminApp = next({ dev, dir: "./" });
const handle = clientAdminApp.getRequestHandler();

const main = async () => {
  try {
    await clientAdminApp.prepare();

    // Start Next.js HTTP Server
    const httpWebServer = createServer((req, res) => handle(req, res));
    httpWebServer.listen(WEB_PORT, () => {
      console.log(`Web server running on port ${WEB_PORT}`);
    });

    // Start WebSocket Server on a separate port
    const httpWebSocketServer = createServer();
    const io = new Server(httpWebSocketServer, {
      cors: {
        origin: [`${PUBLIC_URL}:${WEB_PORT}`, `${PUBLIC_URL}:${BOT_PORT}`, `${PUBLIC_URL}:${WEB_SOCKET_PORT}`],
        methods: ["GET", "POST"],
      },
    });

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

    httpWebSocketServer.listen(WEB_SOCKET_PORT, () => {
      console.log(`WebSocket server running on port ${WEB_SOCKET_PORT}`);
    });

    // Connect to MongoDB
    await connectToDatabase();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log("App could not start: " + err);
  }
};

main();
