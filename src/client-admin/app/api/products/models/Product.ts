import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOptions {
  min: number;
  max?: number;
  price: number;
}

export interface IProduct {
  _id: string;
  name: string;
  category: string;
  description: string;
  type: string;
  options: { min: number; max?: number; price: number }[];
  includes: string;
}

const OptionSchema = new Schema<IOptions>({
  min: { type: Number, required: true },
  max: { type: Number },
  price: { type: Number, required: true },
});

const ProductSchema = new Schema<IProduct>({
  category: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true },
  options: { type: [OptionSchema], required: true },
  includes: { type: String, required: true },
});

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
