import { PrismaClient, User } from "../generated/prisma";
import bcrypt from "bcrypt";
import argon2 from "argon2"; // Import argon2
import jwt from "jsonwebtoken";
import crypto from "crypto"; // Import crypto for token generation
import { RegisterInput, LoginInput } from "../utils/validators";
import config from "../config"; // Import centralized config

const prisma = new PrismaClient();
// const saltRounds = 10; // No longer needed for bcrypt

// Define return type for registration (user info + needs verification message)
// We are not returning the full user object anymore to avoid confusion
interface RegisterResult {
  message: string;
  userId: string; // Useful for potential resend logic later
}

// Updated registerUser function to use Argon2
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

  // Hash password using Argon2id (default)
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id, // Specify Argon2id explicitly
    // Adjust memoryCost, timeCost, parallelism based on security needs and server resources
    memoryCost: 2 ** 16, // 65536 KiB
    timeCost: 3,
    parallelism: 1,
  });

  // Create user with passwordHash and default hashingAlgorithm ('argon2')
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash, // Store Argon2 hash
      // hashingAlgorithm defaults to 'argon2' in schema
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

// Updated loginUser function for dual hashing support
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

  let isPasswordValid = false;
  let needsRehash = false;

  // Check which algorithm was used
  if (user.hashingAlgorithm === "argon2") {
    isPasswordValid = await argon2.verify(user.passwordHash, password);
  } else {
    // Assume bcrypt for users created before the switch (or if field is missing/null)
    isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (isPasswordValid) {
      // Password is valid, but uses old hashing. Mark for rehash.
      needsRehash = true;
    }
  }

  if (!isPasswordValid) {
    return null; // Invalid password
  }

  // Rehash with Argon2 if needed (after successful bcrypt login)
  if (needsRehash) {
    try {
      const newPasswordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash: newPasswordHash,
          hashingAlgorithm: "argon2",
        },
      });
      console.log(`[Auth Service]: User ${email} password rehashed to Argon2.`);
    } catch (rehashError) {
      // Log error but allow login to proceed, rehashing can retry next time
      console.error(
        `[Auth Service]: Failed to rehash password for user ${email}:`,
        rehashError
      );
    }
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
