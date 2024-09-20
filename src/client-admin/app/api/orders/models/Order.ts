import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOrder extends Document {
  nombre: string;
  orden: string;
  telefono: string;
  fecha: string;
  status: boolean;
}

const OrderSchema: Schema<IOrder> = new Schema({
  nombre: { type: String, required: true },
  orden: { type: String, required: true },
  telefono: { type: String, required: true },
  fecha: { type: String, required: true },
  status: { type: Boolean, required: true },
});

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
