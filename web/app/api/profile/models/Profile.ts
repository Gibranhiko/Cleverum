import mongoose, { Document, Model, Schema } from "mongoose";

export interface IProfile extends Document {
  clientId: string;
  adminName: string;
  companyName: string;
  companyType: string;
  companyAddress?: string;
  companyEmail: string;
  whatsappPhone?: string;
  facebookLink?: string;
  instagramLink?: string;
  imageUrl?: string;
  useAi?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    clientId: { type: String, required: true },
    adminName: { type: String, required: true },
    companyName: { type: String, required: true },
    companyType: { type: String, required: true },
    companyAddress: { type: String, default: null },
    companyEmail: { type: String, required: true },
    whatsappPhone: { type: String, default: null },
    facebookLink: { type: String, default: null },
    instagramLink: { type: String, default: null },
    imageUrl: { type: String, default: null },
    useAi: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Profile: Model<IProfile> =
  mongoose.models.Profile || mongoose.model<IProfile>("Profile", ProfileSchema);

export default Profile;
