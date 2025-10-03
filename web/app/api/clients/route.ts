import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Client from "./models/Client";

// GET: Fetch all clients
export async function GET() {
  try {
    await connectToDatabase();
    const clients = await Client.find({ isActive: true });
    return NextResponse.json(clients, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return NextResponse.json(
      { message: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST: Create a new client
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const newClient = await request.json();


    const requiredFields = ["companyName"];
    for (const field of requiredFields) {
      if (!newClient[field]) {
        return NextResponse.json(
          { message: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    const client = new Client(newClient);
    const savedClient = await client.save();

    // Assign unique port (find the next available port starting from 4001)
    const activeClients = await Client.find({ isActive: true, botPort: { $ne: null } })
      .select('botPort')
      .sort({ botPort: 1 });
    const usedPorts = activeClients.map(c => c.botPort);
    let nextPort = 4001;
    const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
    console.log('DEBUG: chatbotUrl for port check:', chatbotUrl);

    // Find a port that's not used by clients and not currently bound
    let portCheckRetries = 0;
    const maxPortCheckRetries = 10; // Prevent infinite loop
    while (portCheckRetries < maxPortCheckRetries) {
      if (!usedPorts.includes(nextPort)) {
        // Check if port is actually available
        try {
          const checkUrl = `${chatbotUrl}/check-port`;
          console.log('DEBUG: Fetching port check URL:', checkUrl, 'for port:', nextPort);
          const checkResponse = await fetch(checkUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
            },
            body: JSON.stringify({ port: nextPort })
          });
          console.log('DEBUG: Port check response status:', checkResponse.status);
          console.log('DEBUG: Port check response content-type:', checkResponse.headers.get('content-type'));

          if (!checkResponse.ok) {
            console.error('DEBUG: Port check response not ok, text:', await checkResponse.text());
            // Assume port in use if not ok
          } else {
            try {
              const checkData = await checkResponse.json();
              console.log('DEBUG: Port check data:', checkData);
              if (checkData.available) {
                break; // Port is available
              }
            } catch (jsonError) {
              console.error('DEBUG: Failed to parse JSON from port check response:', jsonError);
              const responseText = await checkResponse.text();
              console.error('DEBUG: Port check response text:', responseText);
              // Assume port in use if JSON parse fails
            }
          }
        } catch (error) {
          console.error('DEBUG: Port check fetch failed:', error);
          // If check fails, assume port is in use to be safe
        }
      }
      nextPort++;
      portCheckRetries++;
    }

    if (portCheckRetries >= maxPortCheckRetries) {
      throw new Error('Unable to find an available port after maximum retries');
    }

    // Assign session name
    const sessionName = `session-${savedClient._id}`;

    // Update client with bot config
    savedClient.botPort = nextPort;
    savedClient.botSessionName = sessionName;
    await savedClient.save();

    // Start bot via chatbot API
    try {
      const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
      const startBotUrl = `${chatbotUrl}/start-bot`;
      console.log('DEBUG: Starting bot with URL:', startBotUrl);
      const response = await fetch(startBotUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
        },
        body: JSON.stringify({
          id: savedClient._id.toString(),
          name: savedClient.companyName,
          port: nextPort,
          phone: savedClient.whatsappPhone,
          sessionName
        })
      });

      console.log('DEBUG: Start bot response status:', response.status);
      console.log('DEBUG: Start bot response content-type:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG: Failed to start bot, response text:', errorText);
      } else {
        console.log('DEBUG: Bot started successfully');
      }
    } catch (error) {
      console.error('DEBUG: Failed to start bot fetch:', error);
      // Note: Client is still created, bot can be started manually later
    }

    return NextResponse.json(savedClient, { status: 201 });
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { message: "Failed to create client" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing client
export async function PUT(request: Request) {
  try {
    await connectToDatabase();
    const { id, ...updateData } = await request.json();


    if (!id) {
      return NextResponse.json(
        { message: "Client ID is required" },
        { status: 400 }
      );
    }

    const updatedClient = await Client.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedClient) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedClient, { status: 200 });
  } catch (error) {
    console.error("Failed to update client:", error);
    return NextResponse.json(
      { message: "Failed to update client" },
      { status: 500 }
    );
  }
}

// DELETE: Permanently delete a client
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: "Client ID is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    // Stop the bot and cleanup resources asynchronously
    setImmediate(async () => {
      try {
        const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';

        // Stop the bot first
        if (client.botPort) {
          try {
            await fetch(`${chatbotUrl}/stop-bot`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
              },
              body: JSON.stringify({ id })
            });
          } catch (error) {
            console.error('Failed to stop bot via API:', error);
            // Continue with manual cleanup even if API call fails
          }
        }

        // Always perform cleanup of session files as backup
        // This ensures files are cleaned up even if the bot stop API fails
        if (client.botSessionName) {
          try {
            await fetch(`${chatbotUrl}/cleanup-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
              },
              body: JSON.stringify({ sessionName: client.botSessionName })
            });
          } catch (error) {
            console.error('Failed to cleanup session via API:', error);
          }
        }
      } catch (error) {
        console.error('Failed to cleanup resources:', error);
        // Continue with deletion even if cleanup fails
      }
    });

    // Hard delete the client
    await Client.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "Client deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete client:", error);
    return NextResponse.json(
      { message: "Failed to delete client" },
      { status: 500 }
    );
  }
}