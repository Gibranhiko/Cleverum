import bcrypt from "bcrypt";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import User from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const secret = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
  const { username, password } = await req.json();

  // Connect to the database
  await connectToDatabase();

  try {
    // Find the user by username only (not client-specific for login)
    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    // Check if the password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({
        success: false,
        message: "Contraseña incorrecta",
      });
    }

    // Generate JWT (token) using jose - clientId will be set when user selects a client
    const token = await new SignJWT({
      id: user._id.toString(),
      username: user.username,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);

    // Create a NextResponse object
    const response = NextResponse.json({
      success: true,
      message: "Inicio de sesión exitoso",
    });

    // Set the cookie with the token (httpOnly for security)
    response.cookies.set('token', token, {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60, // 1 hour
      path: '/',
      sameSite: 'lax', // Allow cross-site requests for development
    });

    console.log('🍪 Login successful - cookie set:', {
      tokenLength: token.length,
      cookieName: 'token',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600,
      path: '/',
      sameSite: 'lax'
    });

    return response;
  } catch (error) {
    // Handle any errors
    return NextResponse.json({
      success: false,
      message: "Error al iniciar sesión: " + error.message,
    });
  }
}
