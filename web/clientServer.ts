import "dotenv/config";
import next from "next";
import { createServer } from "http";
import connectToDatabase from "./app/api/utils/mongoose";
import { Server } from "socket.io";

const PORT = process.env.WEB_PORT;
const URL = process.env.WEB_PUBLIC_URL;
const dev = process.env.NODE_ENV !== "production";
const clientAdminApp = next({ dev, dir: "./src/client-admin" });
const handle = clientAdminApp.getRequestHandler();

const main = async () => {
  try {
    await clientAdminApp.prepare();
    const httpWebServer = createServer((req, res) => {
      return handle(req, res);
    });

    // Connect to MongoDB
    await connectToDatabase(process.env.DB_NAME);
    console.log("Connected to MongoDB");

    // Initialize Socket.IO
    const io = new Server(httpWebServer, {
      cors: {
        origin: URL,
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
      console.log(`Web server running on ${URL}`);
    });
  } catch (err) {
    console.log("App could not start" + err);
  }
};

main();
