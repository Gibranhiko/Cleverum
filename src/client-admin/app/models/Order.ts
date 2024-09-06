import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOrder extends Document {
  Nombre: string;
  Orden: string;
  Telefono: string;
  Fecha: string;
  Status: boolean;
}

const OrderSchema: Schema<IOrder> = new Schema({
  Nombre: { type: String, required: true },
  Orden: { type: String, required: true },
  Telefono: { type: String, required: true },
  Fecha: { type: String, required: true },
  Status: { type: Boolean, required: true },
});

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
