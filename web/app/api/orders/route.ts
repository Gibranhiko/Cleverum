import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Order, { IOrder } from "./models/Order";

// Fetch all orders
export async function GET() {
  try {
    await connectToDatabase();
    const orders: IOrder[] = await Order.find({});
    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { message: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// Create a new order
export async function POST(req: Request) {
  try {
    const {
      name,
      order,
      phone,
      date,
      deliveryType,
      total,
      status,
      address,
      location,
      paymentMethod,
      clientPayment,
    } = await req.json();

    if (!name || !order || !phone || !date || !deliveryType || !total) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (deliveryType === "domicilio" && (!address || !paymentMethod)) {
      return NextResponse.json(
        { message: "Address and payment type are required for delivery" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const newOrder: IOrder = new Order({
      name,
      order,
      phone,
      date,
      deliveryType,
      total,
      status,
      address: deliveryType === "domicilio" ? address : null,
      location: deliveryType === "domicilio" ? location : null,
      paymentMethod: deliveryType === "domicilio" ? paymentMethod : null,
      clientPayment: deliveryType === "domicilio" ? clientPayment : null,
    });

    await newOrder.save();

    if (global.io) {
      global.io.emit("new-order", newOrder);
    }

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 }
    );
  }
}
