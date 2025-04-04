import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";

const WEB_SOCKET_PORT = process.env.WEB_SOCKET_PORT;
const WEB_PORT = process.env.WEB_PORT;
const BOT_PORT = process.env.BOT_PORT;
const PUBLIC_URL = process.env.PUBLIC_URL;

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
  console.log(`🧠 WebSocket server running on port ${WEB_SOCKET_PORT}`);
});
