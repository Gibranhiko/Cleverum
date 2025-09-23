import { NextRequest, NextResponse } from 'next/server';
import ReminderModel from '../models/Reminder';
import connectToDatabase from '../../utils/mongoose';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await connectToDatabase();

    const deletedReminder = await ReminderModel.findOneAndDelete({ id });
    if (!deletedReminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}