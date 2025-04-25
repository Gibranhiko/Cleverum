export async function GET(req: Request) {
  const CHATBOT_INTERNAL_URL = process.env.CHATBOT_INTERNAL_URL;

  try {
    // Fetch the QR code image from the chatbot server
    const response = await fetch(`${CHATBOT_INTERNAL_URL}`, {
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
