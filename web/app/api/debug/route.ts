import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force Node.js runtime for consistency
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const jwtSecret = process.env.JWT_SECRET_KEY;
  const nodeEnv = process.env.NODE_ENV;

  // Check for token in cookies using the new cookies() function
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  // Also check request cookies for comparison
  const requestCookies = request.headers.get('cookie');
  const hasTokenInHeader = requestCookies?.includes('token=') || false;

  console.log('🔍 Debug endpoint called:', {
    hasToken: !!token,
    hasTokenInHeader,
    tokenLength: token?.length || 0,
    cookieString: requestCookies?.substring(0, 100) + '...' || 'no cookies'
  });

  return NextResponse.json({
    environment: {
      NODE_ENV: nodeEnv,
      JWT_SECRET_SET: !!jwtSecret,
      JWT_SECRET_LENGTH: jwtSecret?.length || 0,
    },
    cookies: {
      hasToken: !!token,
      hasTokenInHeader,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : null,
    },
    request: {
      url: request.url,
      method: request.method,
      headers: {
        cookie: requestCookies?.substring(0, 100) + '...' || null,
        userAgent: request.headers.get('user-agent')?.substring(0, 50)
      }
    },
    timestamp: new Date().toISOString(),
  });
}