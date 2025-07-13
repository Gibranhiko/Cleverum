import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api");
  const isAuthApiRoute = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";
  const chatbotSecret = process.env.CHATBOT_SECRET_KEY;
  const requestSecret = req.headers.get("x-chatbot-secret");

  if (isLoginPage || isAuthApiRoute || requestSecret === chatbotSecret) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;

  if (!token) {
    const response = isApiRoute
      ? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/", req.url)); // Redirige a home page pública

    response.headers.set("X-Authenticated", "false");
    return response;
  }

  try {
    const res = await fetch(`${req.nextUrl.origin}/api/auth/validate-token`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Token validation failed");

    const { user } = await res.json();
    const response = NextResponse.next();

    response.headers.set("X-User-Data", JSON.stringify(user));
    response.headers.set("X-Authenticated", "true");

    return response;
  } catch (error) {
    console.log("Token inválido, redirigiendo:", error);
    const response = isApiRoute
      ? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));

    response.headers.set("X-Authenticated", "false");
    return response;
  }
}

export const config = {
  matcher: [
    "/pedidos",
    "/productos",
    "/promociones",
    "/chatbot",
    "/perfil",
    "/api/:path*",
  ],
};
