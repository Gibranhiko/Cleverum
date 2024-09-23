import { NextResponse } from "next/server";

export async function POST(_: Request) {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear the token cookie
  response.cookies.delete("token");

  return response;
}
