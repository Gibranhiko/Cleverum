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

console.log("WebSocket server CORS origins:", [`${PUBLIC_URL}:${WEB_PORT}`, `${PUBLIC_URL}:${BOT_PORT}`, `${PUBLIC_URL}:${WEB_SOCKET_PORT}`]);

io.on("connection", (socket) => {
  console.log("New WebSocket connection:", socket.id);

  socket.on("new-order", (data) => {
    const { clientId, order } = data;
    console.log(`New order received for client ${clientId}:`, order);

    // Emit to all clients with the same clientId
    io.emit(`new-order-${clientId}`, order);

    // Also emit to general channel for backward compatibility
    io.emit("new-order", order);
  });

  socket.on("join-client", (clientId) => {
    console.log(`Socket ${socket.id} joined client room: ${clientId}`);
    socket.join(`client-${clientId}`);
  });

  socket.on("leave-client", (clientId) => {
    console.log(`Socket ${socket.id} left client room: ${clientId}`);
    socket.leave(`client-${clientId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

httpWebSocketServer.listen(WEB_SOCKET_PORT, () => {
  console.log(`🧠 WebSocket server running on port ${WEB_SOCKET_PORT}`);
});
