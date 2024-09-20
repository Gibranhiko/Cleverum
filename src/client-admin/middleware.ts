import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

interface DecodedToken {
  id: string;
  username: string;
  iat: number;  
  exp: number;  
}

const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET_KEY);

// Middleware function
export async function middleware(req: NextRequest) {
  // Get the token from cookies
  const tokenCookie = req.cookies.get('token');
  const token = tokenCookie ? tokenCookie.value : null;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    // Verify the token
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY) as { payload: DecodedToken };

    // Attach the decoded data to the req object
    (req as NextRequest & { user: DecodedToken }).user = payload;

    // Continue to the next handler
    return NextResponse.next();
  } catch (error) {
    console.log('Invalid token, redirecting user to login:', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

// Configuration to specify which routes the middleware should apply to
export const config = {
  matcher: ['/', '/home', '/pedidos', '/productos', '/promociones', '/chatbot'],
};
