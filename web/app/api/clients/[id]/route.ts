import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import Client from "../models/Client";

// GET: Fetch a specific client by ObjectId
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const client = await Client.findById(params.id);

    if (!client || !client.isActive) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(client, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch client:", error);
    return NextResponse.json(
      { message: "Failed to fetch client" },
      { status: 500 }
    );
  }
}