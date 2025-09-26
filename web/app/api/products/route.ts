import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Product from "./models/Product";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    await connectToDatabase();

    // If no clientId provided, return empty array (user hasn't selected a client yet)
    if (!clientId) {
      return NextResponse.json([], { status: 200 });
    }

    const products = await Product.find({ clientId });
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ message: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const newProduct = await request.json();

    const requiredFields = ["category", "name", "description", "type", "options", "includes"];
    for (const field of requiredFields) {
      if (!newProduct[field]) {
        return NextResponse.json({ message: `Field '${field}' is required` }, { status: 400 });
      }
    }

    // clientId is now optional - will be set when user selects a client
    // If not provided, we'll allow creation but it won't be associated with any client yet

    if (
      !Array.isArray(newProduct.options) ||
      newProduct.options.some(
        (option: any) =>
          typeof option.min !== "number" ||
          (option.max !== undefined && typeof option.max !== "number") ||
          typeof option.price !== "number"
      )
    ) {
      return NextResponse.json(
        { message: "Invalid 'options' format. Each option must include 'min', optional 'max', and 'price' as numbers." },
        { status: 400 }
      );
    }

    const product = new Product(newProduct);
    await product.save();
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ message: "Failed to create product" }, { status: 500 });
  }
}
