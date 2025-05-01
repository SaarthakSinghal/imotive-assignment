import { PrismaClient, User } from "../generated/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto"; // Import crypto for token generation
import { RegisterInput, LoginInput } from "../utils/validators";
import config from "../config"; // Import centralized config

const prisma = new PrismaClient();
const saltRounds = 10;

// Define return type for registration (user info + needs verification message)
// We are not returning the full user object anymore to avoid confusion
interface RegisterResult {
  message: string;
  userId: string; // Useful for potential resend logic later
}

// Updated registerUser function
export const registerUser = async (
  input: RegisterInput
): Promise<RegisterResult> => {
  const { email, password } = input;

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // To prevent email enumeration, consider returning a generic success message
    // even if the email exists, but still send the verification email only if new.
    // For now, we'll keep the explicit error.
    throw new Error("Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user (now defaults to isVerified: false)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // Token expires in 24 hours

  // Store verification token in the database
  await prisma.verificationToken.create({
    data: {
      token: verificationToken,
      expiresAt: tokenExpiry,
      userId: user.id,
    },
  });

  // TODO: Send verification email with the token
  console.log(`Verification Token for ${email}: ${verificationToken}`); // Placeholder

  // Return a message indicating verification is needed
  return {
    message:
      "Registration successful. Please check your email to verify your account.",
    userId: user.id,
  };
};

// --- Login Logic Update ---
// We should prevent login if the user is not verified.
export const loginUser = async (input: LoginInput): Promise<string | null> => {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Check if user exists AND is verified
  if (!user || !user.isVerified) {
    // Combine user not found and not verified for security (prevents revealing if an email is registered but unverified)
    return null; // Invalid credentials or account not verified
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return null; // Invalid password
  }

  // User is verified and password is valid, proceed with JWT generation
  const secret = config.JWT_SECRET;
  const payload = { id: user.id, email: user.email };
  const token = jwt.sign(payload, secret, { expiresIn: "1h" });

  return token;
};

// --- Email Verification Logic ---

export const verifyEmailToken = async (token: string): Promise<boolean> => {
  // Find the token in the database
  const verificationRecord = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true }, // Include user data to check if already verified
  });

  // Check if token exists and is not expired
  if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
    // Token not found or expired
    return false;
  }

  // Check if user is already verified
  if (verificationRecord.user.isVerified) {
    // Optionally delete the token now, as it's redundant
    await prisma.verificationToken.delete({
      where: { id: verificationRecord.id },
    });
    return true; // Already verified
  }

  // Token is valid, user exists and is not verified. Mark user as verified.
  // Use a transaction to ensure atomicity
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update user status
      await tx.user.update({
        where: { id: verificationRecord.userId },
        data: { isVerified: true },
      });

      // 2. Delete the used token
      await tx.verificationToken.delete({
        where: { id: verificationRecord.id },
      });
    });
    return true; // Verification successful
  } catch (error) {
    console.error("Error during email verification transaction:", error);
    return false; // Transaction failed
  }
};
