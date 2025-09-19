import mongoose, { Document, Model, Schema } from "mongoose";

export interface IClient extends Document {
  _id: string;
  name: string;
  description?: string;
  whatsappPhone?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    whatsappPhone: { type: String, default: null },
    email: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);

export default Client;