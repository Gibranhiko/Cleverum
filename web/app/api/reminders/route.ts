import { NextRequest, NextResponse } from 'next/server';
import ReminderModel from './models/Reminder';
import connectToDatabase from '../utils/mongoose';

export async function GET() {
  try {
    await connectToDatabase();
    const reminders = await ReminderModel.find({});
    return NextResponse.json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, phoneNumbers, frequency, time } = body;

    if (!message || !phoneNumbers || !frequency || !time || typeof time.hour !== 'number' || typeof time.minute !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
    }

    if (time.hour < 8 || time.hour > 21 || (time.minute !== 0 && time.minute !== 30)) {
      return NextResponse.json({ error: 'Time must be between 8:00 and 21:30 in 30-minute intervals' }, { status: 400 });
    }

    await connectToDatabase();

    const newReminder = new ReminderModel({
      id: Date.now().toString(),
      message,
      phoneNumbers,
      frequency,
      time,
      active: true
    });

    await newReminder.save();

    return NextResponse.json(newReminder, { status: 201 });
  } catch (error) {
    console.error('Error creating reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}