import { NextResponse } from 'next/server';
import connectToDatabase from '../../utils/mongoose';
import Order, { IOrder } from '../../models/Order';

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
