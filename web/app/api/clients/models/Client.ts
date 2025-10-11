import mongoose, { Document, Model, Schema } from "mongoose";

export interface IClient extends Document {
  _id: string;
  whatsappPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Profile fields
  adminName?: string;
  companyName: string;
  companyType?: string;
  companyAddress?: string;
  companyEmail?: string;
  facebookLink?: string;
  instagramLink?: string;
  imageUrl?: string;
  useAi?: boolean;
  // Bot configuration
  botPort?: number;
  botSessionName?: string;
  // Google Calendar integration
  googleCalendarKeyFileUrl?: string;
  googleCalendarId?: string;
}

const ClientSchema = new Schema<IClient>(
  {
    whatsappPhone: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    // Profile fields
    adminName: { type: String, default: null },
    companyName: { type: String, required: true },
    companyType: { type: String, default: null },
    companyAddress: { type: String, default: null },
    companyEmail: { type: String, default: null },
    facebookLink: { type: String, default: null },
    instagramLink: { type: String, default: null },
    imageUrl: { type: String, default: null },
    useAi: { type: Boolean, default: false },
    // Bot configuration
    botPort: { type: Number, default: null },
    botSessionName: { type: String, default: null },
    // Google Calendar integration
    googleCalendarKeyFileUrl: { type: String, default: null },
    googleCalendarId: { type: String, default: null },
  },
  { timestamps: true }
);

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);

export default Client;