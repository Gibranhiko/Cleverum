import mongoose from "mongoose";
import fs from "fs";
import path from "path";

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