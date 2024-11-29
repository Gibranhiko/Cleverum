import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOrder extends Document {
  nombre: string;
  orden: string[];
  telefono: string;
  fecha: Date; 
  tipoEntrega: string;
  total: number;
  status: boolean;
  direccion?: string | null;
  ubicacion?: string | null;
  metodoPago?: string | null;
  pagoCliente?: number | null;
}

const OrderSchema = new Schema<IOrder>({
  nombre: { type: String, required: true },
  orden: { type: [String], required: true },
  telefono: { type: String, required: true },
  fecha: { type: Date, required: true },
  tipoEntrega: { type: String, required: true },
  total: { type: Number, required: true },
  status: { type: Boolean, required: true },
  direccion: { type: String, default: null },
  ubicacion: { type: String, default: null },
  metodoPago: { type: String, default: null },
  pagoCliente: { type: Number, default: null },
});

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
