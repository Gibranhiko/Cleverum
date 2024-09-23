import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET_KEY);

export async function GET(req: NextRequest) {
  try {
    // Extract token from the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    // Verify the token
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    // Return the verified user data
    return NextResponse.json({ user: payload });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Token verification failed" },
      { status: 401 }
    );
  }
}
