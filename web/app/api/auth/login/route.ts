import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import User from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET_KEY;

export async function POST(req: Request) {
  const { clientId, username, password } = await req.json();

  if (!clientId) {
    return NextResponse.json({
      success: false,
      message: "clientId es requerido",
    });
  }

  // Connect to the database
  await connectToDatabase();

  try {
    // Find the user by clientId and username
    const user = await User.findOne({ clientId, username });
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

    // Generate JWT (token)
    const token = jwt.sign(
      {
        id: user._id,
        clientId: user.clientId,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Create a NextResponse object
    const response = NextResponse.json({
      success: true,
      message: "Inicio de sesión exitoso",
    });

    // Set the cookie with the token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: false, // Change on prod
      maxAge: 60 * 60,
      path: '/',
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
