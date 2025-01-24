import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import busboy from "busboy";
import { Readable } from "stream";

// Convert a Web ReadableStream to a Node.js Readable stream
function readableStreamToNodeStream(stream: ReadableStream): Readable {
  const reader = stream.getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(value);
      }
    },
  });
}

// Helper function to parse the form
async function parseForm(req: NextRequest): Promise<{ fields: any; file: Buffer; }> {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: Object.fromEntries(req.headers) });
    const fields: any = {};
    let fileBuffer: Buffer | null = null;

    bb.on("file", (_, file, info) => {
      const chunks: Buffer[] = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => (fileBuffer = Buffer.concat(chunks)));
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("finish", () => {
      if (!fileBuffer) {
        reject(new Error("No file uploaded"));
      } else {
        resolve({ fields, file: fileBuffer });
      }
    });

    bb.on("error", (err: any) => reject(err));

    // Convert Web Streams API ReadableStream to Node.js Readable and pipe it
    readableStreamToNodeStream(req.body as ReadableStream).pipe(bb);
  });
}

// Export the POST method for handling file uploads
export async function POST(req: NextRequest) {
  try {
    const { file } = await parseForm(req);

    // Save the file to the server
    const uploadsDir = path.join(process.cwd(), "src/client-admin/public/uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, 'logo-company.png');
    fs.writeFileSync(filePath, file);

    // Respond with the file URL
    const fileUrl = `uploads/logo-company.png`;
    return NextResponse.json({ fileUrl });
  } catch (error) {
    console.error("File upload error:", error);
    return new NextResponse("Failed to upload file", { status: 500 });
  }
}