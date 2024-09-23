import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  // Exclude token validation for the /login page
  if (req.nextUrl.pathname === '/login') {
    console.log('return when login page');
    return NextResponse.next();
  }

  // Get the token from cookies
  const tokenCookie = req.cookies.get('token');
  const token = tokenCookie ? tokenCookie.value : null;

  if (!token) {
    console.log('no token');
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    // Call the validate-token API to check the token, and pass the token in the Authorization header
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/validate-token`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Token validation failed');
    }

    const { user } = await res.json();

    //console.log(user, 'token val success res');

    // Attach the decoded data to the req object (optional for further use)
    (req as NextRequest & { user: typeof user }).user = user;

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
