export async function GET(req: Request) {
   const url = new URL(req.url);
   const server = url.searchParams.get('server');

   let BOT_URL;
   if (server === '68cdc85e5eb788f7dcce041f') {
     BOT_URL = 'http://localhost:4000';
   } else if (server === '68cdc9a35eb788f7dcce042d') {
     BOT_URL = 'http://localhost:4001';
   } else {
     BOT_URL = process.env.BOT_URL || 'http://localhost:4000';
   }

   try {
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
