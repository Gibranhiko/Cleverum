import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Helper to resolve file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle GET request
export async function GET() {
  try {
    const qrImagePath = path.join(__dirname, "../../../../../bot.qr.png");

    // Check if the file exists
    if (!fs.existsSync(qrImagePath)) {
      return NextResponse.json(
        { message: "QR code image not found" },
        { status: 404 }
      );
    }

    // Read the file
    const qrImage = fs.readFileSync(qrImagePath);

    // Return the image as a response
    return new NextResponse(qrImage, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    console.error("Error fetching QR code image:", error);
    return NextResponse.json(
      { message: "Failed to fetch QR code image" },
      { status: 500 }
    );
  }
}
