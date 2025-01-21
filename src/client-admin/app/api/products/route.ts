import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Product from "./models/Product";

export async function GET() {
  try {
    await connectToDatabase("orders");
    const products = await Product.find({});
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ message: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase("orders");
    const newProduct = await request.json();

    const requiredFields = ["category", "name", "description", "type", "options", "includes"];
    for (const field of requiredFields) {
      if (!newProduct[field]) {
        return NextResponse.json({ message: `Field '${field}' is required` }, { status: 400 });
      }
    }

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
