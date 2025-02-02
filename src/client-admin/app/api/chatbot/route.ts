export async function GET(req) {
  const qrCodeUrl = process.env.BOT_PUBLIC_URL;

  try {
    // Fetch the QR code image from the chatbot server
    const response = await fetch(`${qrCodeUrl}`);
    if (!response.ok) {
      throw new Error('Failed to fetch QR code');
    }

    // Set the appropriate content type for the image
    const imageBuffer = await response.arrayBuffer();
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } catch (error) {
    console.error('Error fetching QR code:', error);
    return new Response('Error fetching QR code', { status: 500 });
  }
}
