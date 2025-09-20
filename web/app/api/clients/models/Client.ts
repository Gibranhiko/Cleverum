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
  // Profile fields
  adminName?: string;
  companyName?: string;
  companyType?: string;
  companyAddress?: string;
  companyEmail?: string;
  facebookLink?: string;
  instagramLink?: string;
  imageUrl?: string;
  useAi?: boolean;
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    whatsappPhone: { type: String, default: null },
    email: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    // Profile fields
    adminName: { type: String, default: null },
    companyName: { type: String, default: null },
    companyType: { type: String, default: null },
    companyAddress: { type: String, default: null },
    companyEmail: { type: String, default: null },
    facebookLink: { type: String, default: null },
    instagramLink: { type: String, default: null },
    imageUrl: { type: String, default: null },
    useAi: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);

export default Client;