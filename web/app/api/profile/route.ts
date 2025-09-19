import { NextResponse } from "next/server";
import connectToDatabase from "../utils/mongoose";
import Profile from "./models/Profile";

// GET: Fetch profile data for a specific client
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    await connectToDatabase();

    // If no clientId provided, return empty object (user hasn't selected a client yet)
    if (!clientId) {
      return NextResponse.json({}, { status: 200 });
    }

    const profile = await Profile.findOne({ clientId });

    return NextResponse.json(profile || {}, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT: Update profile data for a specific client
export async function PUT(request: Request) {
  try {
    await connectToDatabase();
    const updatedProfileData = await request.json();

    const { clientId } = updatedProfileData;

    // clientId is now optional - will be set when user selects a client
    // If not provided, we'll allow creation but it won't be associated with any client yet

    const requiredFields = [
      "adminName",
      "companyName",
      "companyType",
      "companyEmail",
      "whatsappPhone",
      "companyAddress",
      "facebookLink",
      "instagramLink",
      "imageUrl",
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
      typeof updatedProfileData.imageUrl !== "string" &&
      updatedProfileData.imageUrl !== null
    ) {
      updatedProfileData.imageUrl = null;
    }

    // Perform the database update
    let profile = await Profile.findOneAndUpdate(
      { clientId }, // Match by clientId
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

// DELETE: Delete profile data for a specific client (optional)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    await connectToDatabase();

    // If no clientId provided, return error
    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required for deletion" },
        { status: 400 }
      );
    }

    const deletedProfile = await Profile.findOneAndDelete({ clientId });

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
