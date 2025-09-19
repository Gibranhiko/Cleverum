import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Order, { IOrder } from "./models/Order";

// Fetch all orders for a specific client
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    await connectToDatabase();

    // If no clientId provided, return empty array (user hasn't selected a client yet)
    if (!clientId) {
      return NextResponse.json([], { status: 200 });
    }

    const orders: IOrder[] = await Order.find({ clientId });
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
      clientId,
      name,
      order,
      description,
      phone,
      date,
      plannedDate,
      deliveryType,
      total,
      status,
      address,
      location,
      paymentMethod,
      clientPayment,
    } = await req.json();

    if (!name || !phone || !date) {
      return NextResponse.json(
        { message: "Missing required fields: name, phone, date" },
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
      clientId,
      name,
      order,
      description,
      phone,
      plannedDate,
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
      global.io.emit("new-order", { clientId, order: newOrder });
      global.io.emit(`new-order-${clientId}`, newOrder);
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
