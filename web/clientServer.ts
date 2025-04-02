import "dotenv/config";
import next from "next";
import { createServer } from "http";
import connectToDatabase from "./app/api/utils/mongoose";
import { Server } from "socket.io";

const PORT = process.env.WEB_PORT || 3000;
const WS_PORT = process.env.WEB_SOCKET_PORT || 5000;
const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL;
const BOT_PUBLIC_URL = process.env.BOT_PUBLIC_URL;

const dev = process.env.NODE_ENV !== "production";
const clientAdminApp = next({ dev, dir: "./" });
const handle = clientAdminApp.getRequestHandler();

const main = async () => {
  try {
    await clientAdminApp.prepare();

    // Start Next.js HTTP Server
    const httpWebServer = createServer((req, res) => handle(req, res));
    httpWebServer.listen(PORT, () => {
      console.log(`Web server running on ${WEB_PUBLIC_URL}`);
    });

    // Start WebSocket Server on a separate port
    const httpWebSocketServer = createServer();
    const io = new Server(httpWebSocketServer, {
      cors: {
        origin: [WEB_PUBLIC_URL, BOT_PUBLIC_URL],
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

    httpWebSocketServer.listen(WS_PORT, () => {
      console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
    });

    // Connect to MongoDB
    await connectToDatabase();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log("App could not start: " + err);
  }
};

main();
