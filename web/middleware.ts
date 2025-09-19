import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api");
  const isAuthApiRoute = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";
  const isHomePage = pathname === "/";
  const chatbotSecret = process.env.CHATBOT_SECRET_KEY;
  const requestSecret = req.headers.get("x-chatbot-secret");

  // Get token from cookies
  const token = req.cookies.get("token")?.value;

  // Force log with timestamp to avoid caching
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔒 Middleware Security Check:`, {
    pathname,
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'no token',
    isHomePage,
    isApiRoute,
    isAuthApiRoute,
    cacheBuster: Math.random() // Prevent log caching
  });

  // Always allow login page and auth API routes
  if (isLoginPage || isAuthApiRoute) {
    return NextResponse.next();
  }

  // Allow chatbot requests with valid secret
  if (requestSecret === chatbotSecret) {
    return NextResponse.next();
  }

  // Special handling for home page with valid token - redirect to admin panel
  if (isHomePage && token) {
    try {
      console.log('🔍 Validating token for home page redirect...');
      const res = await fetch(`${req.nextUrl.origin}/api/auth/validate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const { valid } = await res.json();
        if (valid) {
          console.log('✅ Token valid - redirecting to /clientes');
          const response = NextResponse.redirect(new URL('/clientes', req.url));
          response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
          response.headers.set("Pragma", "no-cache");
          response.headers.set("Expires", "0");
          return response;
        }
      }
      console.log('⚠️ Token validation failed or returned invalid');
    } catch (error) {
      console.log('❌ Token validation error:', error.message);
    }
    // If token validation fails, continue to home page
    return NextResponse.next();
  }

  // For protected routes (non-home pages), require authentication
  if (!isHomePage && !token) {
    console.log('🚫 No token found - redirecting to home page');
    const response = isApiRoute
      ? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/", req.url));

    response.headers.set("X-Authenticated", "false");
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  // For protected routes with token, validate it
  if (!isHomePage && token) {
    try {
      console.log('🔍 Validating token for protected route...');
      const res = await fetch(`${req.nextUrl.origin}/api/auth/validate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { valid, user } = await res.json();
      if (!valid) throw new Error("Token invalid");

      console.log('✅ Token validated successfully');
      const response = NextResponse.next();
      response.headers.set("X-User-Data", JSON.stringify(user));
      response.headers.set("X-Authenticated", "true");
      response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    } catch (error) {
      console.log("❌ Token validation failed:", error.message);
      const response = isApiRoute
        ? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/", req.url));

      response.headers.set("X-Authenticated", "false");
      response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      // Clear invalid cookie
      response.cookies.delete('token');
      return response;
    }
  }

  // For home page without token or any other case, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/clientes",
    "/pedidos",
    "/productos",
    "/promociones",
    "/chatbot",
    "/perfil",
    "/api/:path*",
  ],
};
