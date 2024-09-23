import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const tokenCookie = req.headers.get('cookie')?.split('; ').find(row => row.startsWith('token='));
  const token = tokenCookie ? tokenCookie.split('=')[1] : null;

  if (!token) {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 });
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/validate-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({ isAuthenticated: true }, { status: 200 });
    } else {
      return NextResponse.json({ isAuthenticated: false }, { status: 401 });
    }
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json({ isAuthenticated: false }, { status: 500 });
  }
}
