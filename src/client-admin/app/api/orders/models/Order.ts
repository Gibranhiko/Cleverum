import mongoose, { Document, Model, Schema } from 'mongoose';

interface IOrderItem {
  _id: string;
  category: string;
  name: string;
  description: string;
  type: string;
  options: {
    min: number;
    max?: number;
    price: number;
  }[];
  includes: string;
  quantity: number;
  totalCost: number;
}

export interface IOrder extends Document {
  _id: string;
  name: string;
  order: IOrderItem[];
  phone: string;
  date: Date; 
  deliveryType: string;
  total: number;
  status: boolean;
  address?: string | null;
  location?: string | null;
  paymentMethod?: string | null;
  clientPayment?: number | null;
}

const OrderItemSchema = new Schema<IOrderItem>({
  _id: { type: String, required: true },
  category: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true },
  options: [
    {
      min: { type: Number, required: true },
      max: { type: Number },
      price: { type: Number, required: true },
    },
  ],
  includes: { type: String, required: true },
  quantity: { type: Number, required: true },
  totalCost: { type: Number, required: true },
});

const OrderSchema = new Schema<IOrder>({
  name: { type: String, required: true },
  order: { type: [OrderItemSchema], required: true },
  phone: { type: String, required: true },
  date: { type: Date, required: true },
  deliveryType: { type: String, required: true },
  total: { type: Number, required: true },
  status: { type: Boolean, required: true },
  address: { type: String, default: null },
  location: { type: String, default: null },
  paymentMethod: { type: String, default: null },
  clientPayment: { type: Number, default: null },
});

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
