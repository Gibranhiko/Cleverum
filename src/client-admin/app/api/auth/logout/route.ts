import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log(req);
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear the token cookie
  response.cookies.delete("token");

  return response;
}
