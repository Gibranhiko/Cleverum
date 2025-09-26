import mongoose, { Schema, Model } from "mongoose";
import fs from "fs";
import path from "path";

interface IClient {
  _id: string;
  name: string;
  whatsappPhone?: string;
  isActive: boolean;
  botPort?: number;
  botSessionName?: string;
}

const ClientSchema = new Schema<IClient>({
  name: { type: String, required: true },
  whatsappPhone: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  botPort: { type: Number, default: null },
  botSessionName: { type: String, default: null },
});

const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);

// Utility function to clean up bot session files
export const cleanupBotSession = (sessionName: string) => {
  try {
    // Clean up session folder
    const sessionFolder = path.join(process.cwd(), `${sessionName}_sessions`);
    if (fs.existsSync(sessionFolder)) {
      fs.rmSync(sessionFolder, { recursive: true, force: true });
      console.log(`Cleaned up session folder: ${sessionFolder}`);
    }

    // Clean up QR file
    const qrFile = path.join(process.cwd(), `${sessionName}.qr.png`);
    if (fs.existsSync(qrFile)) {
      fs.unlinkSync(qrFile);
      console.log(`Cleaned up QR file: ${qrFile}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup session for ${sessionName}:`, error);
  }
};

// Function to load and start existing bots
export const loadExistingBots = async (createBotInstance: (config: { id: string; name: string; port: number; phone: string; sessionName: string }) => Promise<any>) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const clients = await Client.find({ isActive: true, botPort: { $ne: null } });
    for (const client of clients) {
      const config = {
        id: client._id.toString(),
        name: client.name,
        port: client.botPort!,
        phone: client.whatsappPhone,
        sessionName: client.botSessionName!
      };
      try {
        await createBotInstance(config);
        console.log(`Loaded existing bot for ${client.name}`);
      } catch (error) {
        console.error(`Failed to load bot for ${client.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to load existing bots:', error);
  }
};