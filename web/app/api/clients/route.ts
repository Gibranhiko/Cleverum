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

// DELETE: Deactivate a client (soft delete)
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

    // Soft delete by setting isActive to false
    const deletedClient = await Client.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!deletedClient) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Client deactivated successfully", client: deletedClient },
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