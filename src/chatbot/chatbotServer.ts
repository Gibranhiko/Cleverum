import "dotenv/config";
import express, { Request, Response } from "express";
import { createBot, createProvider, MemoryDB } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import AIClass from "./services/ai/index";
import flow from "./flows";
import net from "net";

const app = express();
const PORT = process.env.BOT_PORT;

app.use(express.json());

const ai = new AIClass(process.env.OPEN_API_KEY, "gpt-3.5-turbo");
const activeBots: Record<string, number> = {};
let nextPort = Number(PORT) + 1;

/**
 * Valida si un número de WhatsApp es válido en formato internacional.
 */
const isValidPhoneNumber = (phoneNumber: string): boolean => {
  const phoneRegex = /^\d{10,15}$/; // Solo números, entre 10 y 15 dígitos.
  return phoneRegex.test(phoneNumber);
};

/**
 * Verifica si un puerto está en uso.
 */
const isPortInUse = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer().listen(port, () => {
      server.close();
      resolve(false); // Puerto libre
    });
    server.on("error", () => resolve(true)); // Puerto en uso
  });
};

/**
 * API para iniciar un chatbot con un número de WhatsApp validado.
 */
app.post("/start-bot", async (req: Request, res: Response) => {
  try {
    let { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ error: "Phone number is required." });
    }

    // Normalize phone number
    phoneNumber = phoneNumber.replace(/\D/g, "");

    if (!isValidPhoneNumber(phoneNumber)) {
      res.status(400).json({ error: "Invalid phone number." });
    }

    if (activeBots[phoneNumber]) {
      res.status(400).json({ error: "This number is already paired." });
    }

    // Buscar un puerto disponible
    let port = nextPort;
    while (await isPortInUse(port)) {
      port++;
    }

    const adapterProvider = createProvider(Provider, {
      timeRelease: 10800000,
      usePairingCode: true,
      phoneNumber,
    });

    const { httpServer } = await createBot(
      {
        database: new MemoryDB(),
        provider: adapterProvider,
        flow,
      },
      { extensions: { ai } }
    );

    httpServer(port);
    activeBots[phoneNumber] = port;
    console.log(`Bot started for ${phoneNumber} on port ${port}`);

    res.json({ message: "Bot pairing request sent", phoneNumber, port });
  } catch (err) {
    console.error("Error sending pairing request:", err);
    res.status(500).json({ error: "Pairing request could not be sent" });
  }
});

/**
 * API para detener un chatbot
 */
app.post("/stop-bot", (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber || !activeBots[phoneNumber]) {
    res.status(400).json({ error: "No paired bot with this number." });
  }

  console.log(`Bot stoped for ${phoneNumber}`);
  delete activeBots[phoneNumber];

  res.json({ message: "Bot stoped", phoneNumber });
});

/**
 * API para listar los bots en ejecución
 */
app.get("/active-bots", (req, res) => {
  res.json(activeBots);
});

// Iniciar el servidor Express
app.listen(PORT, () => {
  console.log(`Bot server control running on http://localhost:${PORT}`);
});
