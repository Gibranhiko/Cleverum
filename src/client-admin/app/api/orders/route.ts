import { NextResponse } from 'next/server';
import connectToDatabase from '../utils/mongoose';
import Order, { IOrder } from './models/Order';

export async function GET() {
  try {
    await connectToDatabase('orders');

    const orders: IOrder[] = await Order.find({});

    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json(
      { message: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { nombre, orden, telefono, fecha, status } = await req.json();

    if (!nombre || !orden || !telefono || !fecha || typeof status !== 'boolean') {
      return NextResponse.json(
        { message: 'Missing required fields or invalid data' },
        { status: 400 }
      );
    }

    await connectToDatabase('orders');

    const newOrder: IOrder = new Order({
      nombre,
      orden,
      telefono,
      fecha,
      status,
    });

    await newOrder.save();
     if (global.io) {
      global.io.emit('new-order', newOrder);
    } else {
      console.warn("Socket.IO server is not initialized.");
    }

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error('Failed to create order:', error);
    return NextResponse.json(
      { message: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { message: 'Order ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase('orders');

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status: true }, 
      { new: true } 
    );

    if (!updatedOrder) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error) {
    console.error('Failed to update order status:', error);
    return NextResponse.json(
      { message: 'Failed to update order status' },
      { status: 500 }
    );
  }
}
