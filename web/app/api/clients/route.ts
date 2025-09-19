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
    await client.save();
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { message: "Failed to create client" },
      { status: 500 }
    );
  }
}