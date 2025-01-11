import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOrder extends Document {
  _id: string;
  name: string;
  order: string[];
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

const OrderSchema = new Schema<IOrder>({
  name: { type: String, required: true },
  order: { type: [String], required: true },
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
