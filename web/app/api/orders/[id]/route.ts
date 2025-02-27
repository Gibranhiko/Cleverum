import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import Order from "../models/Order";

// Fetch an order by ID
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase("orders");
    const order = await Order.findById(params.id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json(
      { message: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// Update an order by ID (e.g., update the status)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();

    if (status === undefined) {
      return NextResponse.json(
        { message: "Status is required for update" },
        { status: 400 }
      );
    }

    await connectToDatabase("orders");

    const updatedOrder = await Order.findByIdAndUpdate(
      params.id,
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      { message: "Failed to update order" },
      { status: 500 }
    );
  }
}

// Delete an order by ID
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase("orders");
    const deletedOrder = await Order.findByIdAndDelete(params.id);

    if (!deletedOrder) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Order deleted successfully", order: deletedOrder },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { message: "Failed to delete order" },
      { status: 500 }
    );
  }
}
