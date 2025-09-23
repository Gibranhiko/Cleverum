import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReminder extends Document {
  id: string;
  message: string;
  phoneNumbers: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  time: { hour: number; minute: number };
  active: boolean;
  createdAt: Date;
  lastSent?: Date;
}

const ReminderSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  message: { type: String, required: true },
  phoneNumbers: { type: [String], required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  time: {
    hour: { type: Number, required: true, min: 8, max: 21 },
    minute: { type: Number, required: true, enum: [0, 30] }
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastSent: { type: Date }
});

const ReminderModel: Model<IReminder> = mongoose.models.WebReminder || mongoose.model<IReminder>('WebReminder', ReminderSchema);

export default ReminderModel;