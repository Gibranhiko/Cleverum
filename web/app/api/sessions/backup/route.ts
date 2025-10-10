import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import Client from "../../clients/models/Client";
import SessionBackup from "../models/SessionBackup";
import fs from "fs";
import path from "path";

// Helper function to read session files from chatbot container
async function readSessionFiles(sessionFolderName: string): Promise<any> {
  try {
    const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
    
    // Call chatbot API to get session data
    const response = await fetch(`${chatbotUrl}/get-session-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
      },
      body: JSON.stringify({ sessionFolderName })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session data: ${response.statusText}`);
    }

    const sessionData = await response.json();
    return sessionData;
  } catch (error) {
    console.error('Error reading session files:', error);
    throw error;
  }
}

// POST: Backup WhatsApp session data to MongoDB
export async function POST(request: Request) {
  try {
    const { clientId } = await request.json();

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

    if (!client.botSessionName) {
      return NextResponse.json(
        { message: "Client does not have an active bot session" },
        { status: 400 }
      );
    }

    // Find the actual session folder name (dynamic format)
    let sessionFolderName: string;
    try {
      const chatbotUrl = process.env.BOT_URL || 'http://localhost:4000';
      const listResponse = await fetch(`${chatbotUrl}/list-sessions`, {
        method: 'GET',
        headers: {
          'x-chatbot-secret': process.env.CHATBOT_SECRET_KEY || ''
        }
      });

      if (!listResponse.ok) {
        throw new Error('Failed to list sessions');
      }

      const { sessions } = await listResponse.json();
      
      // Find session folder that matches this client
      const matchingSession = sessions.find((session: any) => 
        session.name.includes(clientId.slice(-8)) || 
        session.name.includes(client.botSessionName)
      );

      if (!matchingSession) {
        return NextResponse.json(
          { message: "No active session found for this client. Please ensure WhatsApp is connected." },
          { status: 404 }
        );
      }

      sessionFolderName = matchingSession.name;
    } catch (error) {
      console.error('Error finding session folder:', error);
      return NextResponse.json(
        { message: "Failed to locate session folder" },
        { status: 500 }
      );
    }

    // Read session data from the chatbot container
    let sessionData: any;
    try {
      sessionData = await readSessionFiles(sessionFolderName);
    } catch (error) {
      console.error('Error reading session data:', error);
      return NextResponse.json(
        { message: "Failed to read session data. Ensure WhatsApp is properly connected." },
        { status: 500 }
      );
    }

    // Check if backup already exists
    const existingBackup = await SessionBackup.findOne({ 
      clientId, 
      isActive: true 
    });

    if (existingBackup) {
      // Update existing backup
      existingBackup.sessionFolderName = sessionFolderName;
      existingBackup.sessionData = sessionData;
      existingBackup.backupDate = new Date();
      await existingBackup.save();

      return NextResponse.json({
        message: "Session backup updated successfully",
        backup: {
          id: existingBackup._id,
          clientId: existingBackup.clientId,
          sessionFolderName: existingBackup.sessionFolderName,
          backupDate: existingBackup.backupDate
        }
      }, { status: 200 });
    } else {
      // Create new backup
      const newBackup = new SessionBackup({
        clientId,
        sessionFolderName,
        sessionData,
        backupDate: new Date(),
        isActive: true
      });

      const savedBackup = await newBackup.save();

      return NextResponse.json({
        message: "Session backup created successfully",
        backup: {
          id: savedBackup._id,
          clientId: savedBackup.clientId,
          sessionFolderName: savedBackup.sessionFolderName,
          backupDate: savedBackup.backupDate
        }
      }, { status: 201 });
    }

  } catch (error) {
    console.error("Failed to backup session:", error);
    return NextResponse.json(
      { 
        message: "Failed to backup session",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// GET: Get backup status for a client
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

    const backup = await SessionBackup.findOne({ 
      clientId, 
      isActive: true 
    }).sort({ backupDate: -1 });

    if (!backup) {
      return NextResponse.json({
        hasBackup: false,
        message: "No backup found for this client"
      }, { status: 200 });
    }

    return NextResponse.json({
      hasBackup: true,
      backup: {
        id: backup._id,
        clientId: backup.clientId,
        sessionFolderName: backup.sessionFolderName,
        backupDate: backup.backupDate,
        restoredAt: backup.restoredAt,
        dataSize: JSON.stringify(backup.sessionData).length
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Failed to get backup status:", error);
    return NextResponse.json(
      { message: "Failed to get backup status" },
      { status: 500 }
    );
  }
}