import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'your-secret-key';
const secret = new TextEncoder().encode(JWT_SECRET);

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    // Also support Authorization header for backward compatibility
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const finalToken = token || headerToken;

    console.log('Validate Token Debug:', {
      hasToken: !!finalToken,
      tokenPreview: finalToken ? finalToken.substring(0, 20) + '...' : 'no token',
      jwtSecret: JWT_SECRET ? 'JWT_SECRET is set' : 'JWT_SECRET is NOT set',
      source: token ? 'body' : headerToken ? 'header' : 'none'
    });

    if (!finalToken) {
      return NextResponse.json(
        { valid: false, message: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify the JWT token using jose
    const { payload: decoded } = await jwtVerify(finalToken, secret);

    console.log('Token validation successful:', {
      userId: decoded.id,
      username: decoded.username,
      clientId: decoded.clientId
    });

    return NextResponse.json({
      valid: true,
      user: decoded,
      message: 'Token is valid'
    });

  } catch (error) {
    console.error('Token validation error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.substring(0, 200)
    });

    // Jose uses different error types
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.log('❌ Token has expired');
      return NextResponse.json(
        { valid: false, message: 'Token has expired' },
        { status: 401 }
      );
    }

    if (error.code === 'ERR_JWS_INVALID') {
      console.log('❌ Token signature is invalid');
      return NextResponse.json(
        { valid: false, message: 'Invalid token signature' },
        { status: 401 }
      );
    }

    console.log('❌ Token validation failed with unknown error');
    return NextResponse.json(
      { valid: false, message: 'Invalid token' },
      { status: 401 }
    );
  }
}
