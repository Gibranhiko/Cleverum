import { NextRequest, NextResponse } from "next/server";
import { parseForm, fileExists, generateRandomId, s3, bucketName } from "./utils";

export async function POST(req: NextRequest) {
  try {
    const { fields, file } = await parseForm(req);

    let fileName: string;
    let folder: string;

    if (fields.isClientForm === "true") {
      // Generate unique filename for each client's profile picture
      folder = "uploads";
      const clientId = fields.clientId || "unknown";
      fileName = `company-logo-${clientId}.png`;
    } else if (fields.isGoogleCalendarKey === "true") {
      // Handle Google Calendar service account key files
      folder = "google-calendar-keys";
      const clientId = fields.clientId || "unknown";
      fileName = `client-${clientId}-calendar-key.json`;
    } else if (fields.isProductForm === "true") {
      folder = "products";
      const providedProductId = fields.productId && fields.productId !== "null" ? fields.productId : null;

      if (providedProductId) {
        // Use the provided product ID
        fileName = `product-${providedProductId}.png`;
      } else {
        // Generate a unique product ID if none is provided
        let productId: string;
        let isUnique = false;

        while (!isUnique) {
          productId = generateRandomId();
          const key = `products/product-${productId}.png`;
          isUnique = !(await fileExists(key));
        }

        fileName = `product-${productId}.png`;
      }
    } else {
      return NextResponse.json({ message: "Invalid request: Missing form type" }, { status: 400 });
    }

    // Determine content type based on file type
    let contentType = "image/png";
    if (fields.isGoogleCalendarKey === "true") {
      contentType = "application/json";
    }

    // Upload the file
    const uploadResult = await s3
      .upload({
        Bucket: bucketName,
        Key: `${folder}/${fileName}`,
        Body: file,
        ACL: "public-read",
        ContentType: contentType,
      })
      .promise();

    return NextResponse.json({ fileUrl: uploadResult.Location });
  } catch (error) {
    console.error("Error uploading to Spaces:", error);
    return new NextResponse("Failed to upload file", { status: 500 });
  }
}
