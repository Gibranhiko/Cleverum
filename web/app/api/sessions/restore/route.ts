import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import Client from "../../clients/models/Client";
import SessionBackup from "../models/SessionBackup";

// Helper function to restore session files to chatbot container
async function restoreSessionFiles(sessionFolderName: string, sessionData: any): Promise<boolean> {
  try {
    const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
    
    // Call chatbot API to restore session data
    const response = await fetch(`${chatbotUrl}/restore-session-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
      },
      body: JSON.stringify({ 
        sessionFolderName,
        sessionData 
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to restore session data: ${response.statusText}`);
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error restoring session files:', error);
    throw error;
  }
}

// POST: Restore WhatsApp session data from MongoDB backup
export async function POST(request: Request) {
  try {
    const { clientId, forceRestore = false } = await request.json();

    if (!clientId) {
      return NextResponse.json(
        { message: "Client ID is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get client information
    const client = await Client.findById(clientId);
    if (!client || !client.isActive) {
      return NextResponse.json(
        { message: "Client not found or inactive" },
        { status: 404 }
      );
    }

    // Find the most recent backup for this client
    const backup = await SessionBackup.findOne({ 
      clientId, 
      isActive: true 
    }).sort({ backupDate: -1 });

    if (!backup) {
      return NextResponse.json(
        { message: "No backup found for this client" },
        { status: 404 }
      );
    }

    // Check if backup has valid session data
    if (!backup.sessionData || Object.keys(backup.sessionData).length === 0) {
      return NextResponse.json(
        { message: "Backup contains no session data" },
        { status: 400 }
      );
    }

    // Check if there's already an active session (unless force restore)
    if (!forceRestore) {
      try {
        const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
        const listResponse = await fetch(`${chatbotUrl}/list-sessions`, {
          method: 'GET',
          headers: {
            'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
          }
        });

        if (listResponse.ok) {
          const { sessions } = await listResponse.json();
          const existingSession = sessions.find((session: any) => 
            session.name.includes(clientId.slice(-8)) || 
            session.name.includes(client.botSessionName)
          );

          if (existingSession && !existingSession.isBackup) {
            return NextResponse.json(
              { 
                message: "Active session already exists. Use forceRestore=true to overwrite.",
                existingSession: existingSession.name
              },
              { status: 409 }
            );
          }
        }
      } catch (error) {
        console.warn('Could not check for existing sessions:', error);
        // Continue with restore anyway
      }
    }

    // Generate new session folder name if needed
    const newSessionFolderName = backup.sessionFolderName || `session-${clientId}_sessions`;

    // Restore session files to chatbot container
    try {
      const restoreSuccess = await restoreSessionFiles(newSessionFolderName, backup.sessionData);
      
      if (!restoreSuccess) {
        return NextResponse.json(
          { message: "Failed to restore session files to chatbot container" },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Error during session restore:', error);
      return NextResponse.json(
        { 
          message: "Failed to restore session files",
          error: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }

    // Update backup record to mark as restored
    backup.restoredAt = new Date();
    await backup.save();

    // Update client session name if needed
    if (client.botSessionName !== newSessionFolderName.replace('_sessions', '')) {
      client.botSessionName = newSessionFolderName.replace('_sessions', '');
      await client.save();
    }

    // Try to restart the bot with restored session
    try {
      const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
      
      // Stop existing bot if running
      await fetch(`${chatbotUrl}/stop-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
        },
        body: JSON.stringify({ id: clientId })
      });

      // Start bot with restored session
      const startResponse = await fetch(`${chatbotUrl}/start-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
        },
        body: JSON.stringify({
          id: clientId,
          name: client.companyName,
          port: client.botPort,
          phone: client.whatsappPhone,
          sessionName: client.botSessionName
        })
      });

      if (!startResponse.ok) {
        console.warn('Failed to restart bot after restore:', await startResponse.text());
      }
    } catch (error) {
      console.warn('Failed to restart bot after restore:', error);
      // Don't fail the restore operation if bot restart fails
    }

    return NextResponse.json({
      message: "Session restored successfully",
      restore: {
        clientId,
        sessionFolderName: newSessionFolderName,
        backupDate: backup.backupDate,
        restoredAt: backup.restoredAt,
        filesRestored: Object.keys(backup.sessionData).length
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Failed to restore session:", error);
    return NextResponse.json(
      { 
        message: "Failed to restore session",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// GET: Get restore history for a client
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { message: "Client ID is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const restoreHistory = await SessionBackup.find({ 
      clientId, 
      isActive: true,
      restoredAt: { $ne: null }
    })
    .sort({ restoredAt: -1 })
    .limit(10)
    .select('sessionFolderName backupDate restoredAt');

    return NextResponse.json({
      clientId,
      restoreHistory: restoreHistory.map(backup => ({
        sessionFolderName: backup.sessionFolderName,
        backupDate: backup.backupDate,
        restoredAt: backup.restoredAt
      })),
      totalRestores: restoreHistory.length
    }, { status: 200 });

  } catch (error) {
    console.error("Failed to get restore history:", error);
    return NextResponse.json(
      { message: "Failed to get restore history" },
      { status: 500 }
    );
  }
}