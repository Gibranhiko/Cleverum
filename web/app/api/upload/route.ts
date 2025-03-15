import { NextRequest, NextResponse } from "next/server";
import { parseForm, fileExists, generateRandomId, s3, bucketName } from "./utils";

export async function POST(req: NextRequest) {
  try {
    const { fields, file } = await parseForm(req);

    let fileName: string;
    let folder: string;

    if (fields.isProfileForm === "true") {
      // Always use a fixed name for profile pictures
      folder = "uploads";
      fileName = "company-logo.png";
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

    // Upload the file
    const uploadResult = await s3
      .upload({
        Bucket: bucketName,
        Key: `${folder}/${fileName}`,
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
