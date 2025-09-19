import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

interface IUser extends Document {
  clientId: string;
  username: string;
  password: string;
  comparePassword: (password: string) => Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema({
  clientId: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
});

// Create a compound index for clientId + username to ensure uniqueness within each client
UserSchema.index({ clientId: 1, username: 1 }, { unique: true });

// Pre-save hook to hash the password
UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const hashedPassword = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare the password
UserSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.password);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
