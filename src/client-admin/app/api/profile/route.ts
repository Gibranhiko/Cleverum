import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Profile from "./models/Profile";

// GET: Fetch profile data
export async function GET(_: Request) {
  try {
    await connectToDatabase("profiles");
    const profile = await Profile.findOne();

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT: Update profile data
export async function PUT(request: Request) {
  try {
    await connectToDatabase("profiles");
    const updatedProfileData = await request.json();

    const requiredFields = [
      "adminName",
      "companyName",
      "companyEmail",
      "whatsappPhone",
      "companyAddress",
      "facebookLink",
      "instagramLink",
      "logoUrl",
    ];

    // Validate required fields
    for (const field of requiredFields) {
      if (
        !updatedProfileData[field] ||
        updatedProfileData[field].trim() === ""
      ) {
        return NextResponse.json(
          { message: `${field} is required` },
          { status: 400 }
        );
      }
    }

    if (
      typeof updatedProfileData.logoUrl !== "string" &&
      updatedProfileData.logoUrl !== null
    ) {
      updatedProfileData.logoUrl = null;
    }

    // Perform the database update
    let profile = await Profile.findOneAndUpdate(
      {}, // Match the first (and only) document
      updatedProfileData,
      { new: true, upsert: true } // Create the profile if it doesn't exist
    );

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500 }
    );
  }
}

// DELETE: Delete profile data (optional)
export async function DELETE(_: Request) {
  try {
    await connectToDatabase("profiles");
    const deletedProfile = await Profile.findOneAndDelete();

    if (!deletedProfile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Profile deleted successfully", profile: deletedProfile },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete profile:", error);
    return NextResponse.json(
      { message: "Failed to delete profile" },
      { status: 500 }
    );
  }
}
