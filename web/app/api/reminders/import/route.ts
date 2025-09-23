import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    const content = Buffer.from(buffer).toString('utf-8');

    const phoneNumbers: string[] = [];

    // Parse CSV
    const lines = content.split('\n');
    for (const line of lines) {
      const phone = line.trim();
      if (phone && /^\+?\d+$/.test(phone)) {
        phoneNumbers.push(phone);
      }
    }

    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error importing phones:', error);
    return NextResponse.json({ error: 'Failed to import phone numbers' }, { status: 500 });
  }
}