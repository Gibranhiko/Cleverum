export async function POST(req: Request, { params }: { params: { userId: string } }) {
  try {
    const { userId } = params;
    const response = await fetch(`http://localhost:3000/start-bot/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(await req.json()),
    });

    console.log('Response Status:', response.status); // Log response status
    const responseBody = await response.text(); // Read the response as text first
    console.log('Response Body:', responseBody); // Log the raw response body

    // Try parsing the response body only if it's valid
    let parsedResponse = {};
    try {
      parsedResponse = JSON.parse(responseBody); // Try parsing as JSON
    } catch (err) {
      console.error('Error parsing JSON:', err);
    }

    if (!response.ok) {
      throw new Error('Failed to start bot');
    }

    return new Response(JSON.stringify({ message: 'Bot started successfully' }), {
      status: 200,
    });
  } catch (error) {
    console.error('Error starting bot:', error);
    return new Response(JSON.stringify({ error: 'Failed to start bot' }), {
      status: 500,
    });
  }
}
