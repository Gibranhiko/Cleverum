import { NextResponse } from "next/server";
import connectToDatabase from "../../utils/mongoose";
import User from "../models/User";

// API Route & Register User Logic
export async function POST(req: Request) {
  const { username, password } = await req.json();

  // Connect to the database
  await connectToDatabase("users");

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: "El usuario ya existe",
      });
    }

    // Create a new user
    const newUser = new User({
      username,
      password,
    });

    // Save the new user to the database
    await newUser.save();

    // Return a success response
    return NextResponse.json({
      success: true,
      message: "User registered successfully",
    });
  } catch (error) {
    // Handle any errors
    return NextResponse.json({
      success: false,
      message: "Error registering user: " + error.message,
    });
  }
}
