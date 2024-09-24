import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
  console.log(req.body);

  // Clear the token cookie
  response.cookies.delete("token");

  return response;
}
