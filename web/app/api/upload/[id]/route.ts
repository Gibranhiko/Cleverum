import { NextRequest, NextResponse } from "next/server";
import { parseForm, s3, bucketName } from "../utils";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { message: "Product ID is required" },
        { status: 400 }
      );
    }

    // Construct the S3 key for the image
    const key = `products/product-${id}.png`;


    // Check if the file exists
    const exists = await s3
      .headObject({ Bucket: bucketName, Key: key })
      .promise()
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return NextResponse.json(
        { message: "Image not found" },
        { status: 404 }
      );
    }

    // Delete the image from S3
    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: key,
      })
      .promise();

    return NextResponse.json(
      { message: "Image deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { message: "Failed to delete image" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { file } = await parseForm(req);

    if (!id) {
      return NextResponse.json(
        { message: "Product ID is required" },
        { status: 400 }
      );
    }

    // Construct the S3 key for the image
    const key = `products/product-${id}.png`;

    // Upload the new file (overwriting the existing one)
    const uploadResult = await s3
      .upload({
        Bucket: bucketName,
        Key: key,
        Body: file,
        ACL: "public-read",
        ContentType: "image/png",
      })
      .promise();

    return NextResponse.json({ fileUrl: uploadResult.Location });
  } catch (error) {
    console.error("Error updating image:", error);
    return NextResponse.json(
      { message: "Failed to update image" },
      { status: 500 }
    );
  }
}