import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISessionBackup extends Document {
  _id: string;
  clientId: string;
  sessionFolderName: string; // e.g., "session-68e7f6384eb3f031419492cf_sessions"
  sessionData: {
    creds?: any;
    keys?: any;
    sessionInfo?: any;
    [key: string]: any; // Allow for additional session files
  };
  backupDate: Date;
  isActive: boolean;
  restoredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionBackupSchema = new Schema<ISessionBackup>(
  {
    clientId: {
      type: String,
      required: true,
      ref: 'Client'
    },
    sessionFolderName: {
      type: String,
      required: true,
      unique: true // Ensure one backup per session folder
    },
    sessionData: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    backupDate: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    },
    restoredAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Add indexes for better query performance
SessionBackupSchema.index({ clientId: 1 });
SessionBackupSchema.index({ sessionFolderName: 1 });
SessionBackupSchema.index({ isActive: 1 });
SessionBackupSchema.index({ backupDate: -1 });
SessionBackupSchema.index({ clientId: 1, isActive: 1 }); // Compound index for efficient queries

const SessionBackup: Model<ISessionBackup> =
  mongoose.models.SessionBackup || mongoose.model<ISessionBackup>("SessionBackup", SessionBackupSchema);

export default SessionBackup;