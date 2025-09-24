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


    const requiredFields = ["name"];
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

    // Assign unique port (find max existing port + 1, default 4001 since 4000 is management server)
    const maxPortClient = await Client.findOne({ isActive: true, botPort: { $ne: null } })
      .sort({ botPort: -1 })
      .select('botPort');
    const nextPort = maxPortClient?.botPort ? maxPortClient.botPort + 1 : 4001;

    // Assign session name
    const sessionName = `session-${savedClient._id}`;

    // Update client with bot config
    savedClient.botPort = nextPort;
    savedClient.botSessionName = sessionName;
    await savedClient.save();

    // Start bot via chatbot API
    try {
      const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
      const response = await fetch(`${chatbotUrl}/start-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
        },
        body: JSON.stringify({
          id: savedClient._id.toString(),
          name: savedClient.name,
          port: nextPort,
          phone: savedClient.whatsappPhone,
          sessionName
        })
      });

      if (!response.ok) {
        console.error('Failed to start bot:', await response.text());
      }
    } catch (error) {
      console.error('Failed to start bot:', error);
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

    // Stop the bot if running
    if (client.botPort) {
      try {
        const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
        await fetch(`${chatbotUrl}/stop-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
          },
          body: JSON.stringify({ id })
        });
      } catch (error) {
        console.error('Failed to stop bot:', error);
        // Continue with deletion even if stop fails
      }
    }

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