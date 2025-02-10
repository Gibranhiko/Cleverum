import { Readable } from "stream";
import busboy from "busboy";
import { NextRequest } from "next/server";
import AWS from "aws-sdk";
import crypto from "crypto";

// Initialize S3 client
const spacesEndpoint = new AWS.Endpoint(process.env.DO_ENDPOINT);
export const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_ACCESS_KEY_ID,
  secretAccessKey: process.env.DO_SECRET_ACCESS_KEY,
});

export const bucketName = process.env.DO_BUCKET_NAME;

// Convert a Web ReadableStream to a Node.js Readable stream
export function readableStreamToNodeStream(stream: ReadableStream): Readable {
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
export async function parseForm(req: NextRequest): Promise<{ fields: any; file: Buffer }> {
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

// Check if a file exists in S3
export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3.headObject({ Bucket: bucketName, Key: key }).promise();
    return true; // File exists
  } catch (error: any) {
    if (error.code === "NotFound") {
      return false; // File does not exist
    }
    throw error; // Other errors
  }
}

// Generate a random ID
export function generateRandomId(length: number = 10): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length); // Generate random bytes and convert to hex
}