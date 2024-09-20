import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import User from "../models/User";

// API Route & Login User Logic
export async function POST(req: Request) {
  const { username, password } = await req.json();

  // Connect to the database
  await connectToDatabase("users");

  try {
    // Find the user by username
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

    // Return a success response (you might want to include a token here)***
    return NextResponse.json({
      success: true,
      message: "Inicio de sesión exitoso",
    });
  } catch (error) {
    // Handle any errors
    return NextResponse.json({
      success: false,
      message: "Error al iniciar sesión: " + error.message,
    });
  }
}
