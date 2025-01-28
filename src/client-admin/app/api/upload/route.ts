import { NextRequest, NextResponse } from "next/server";
import busboy from "busboy";
import { Readable } from "stream";
import AWS from "aws-sdk";

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

export async function POST(req: NextRequest) {
  try {
    const { fields, file } = await parseForm(req);

    const spacesEndpoint = new AWS.Endpoint(process.env.DO_ENDPOINT);
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_ACCESS_KEY_ID,
      secretAccessKey: process.env.DO_SECRET_ACCESS_KEY,
    });

    const bucketName = process.env.DO_BUCKET_NAME;

    // Upload the file
    const uploadResult = await s3
      .upload({
        Bucket: bucketName,
        Key: `uploads/${fields.fileName || "logo-company.png"}`,
        Body: file,
        ACL: "public-read",
        ContentType: "image/png",
      })
      .promise();

    return NextResponse.json({ fileUrl: uploadResult.Location });
  } catch (error) {
    console.error("Error uploading to Spaces:", error);
    return new NextResponse("Failed to upload file", { status: 500 });
  }
}