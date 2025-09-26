import connectToDatabase from "../utils/mongoose";
import Client from "../clients/models/Client";

export async function GET(req: Request) {
   const url = new URL(req.url);
   const server = url.searchParams.get('server');

   if (!server) {
     return new Response("Server parameter required", { status: 400 });
   }

   try {
     await connectToDatabase();
     const client = await Client.findById(server);
     if (!client || !client.botPort) {
       return new Response("Client or bot port not found", { status: 404 });
     }

     const BOT_URL = `http://localhost:${client.botPort}`;

     // Fetch the QR code image from the chatbot server
     const response = await fetch(`${BOT_URL}`, {
       cache: "no-store",
     });
     if (!response.ok) {
       throw new Error("Failed to fetch QR code");
     }

     // Convertimos la imagen a buffer
     const imageBuffer = await response.arrayBuffer();

     return new Response(imageBuffer, {
       status: 200,
       headers: {
         "Content-Type": "image/png",
         "Cache-Control":
           "no-store, no-cache, must-revalidate, proxy-revalidate",
         Pragma: "no-cache",
         Expires: "0",
       },
     });
   } catch (error) {
     console.error("Error fetching QR code:", error);
     return new Response("Error fetching QR code", { status: 500 });
   }
}
