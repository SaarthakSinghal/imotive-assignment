import { PrismaClient, User } from "../generated/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { RegisterInput, LoginInput } from "../utils/validators";
import config from "../config"; // Import centralized config

const prisma = new PrismaClient();
const saltRounds = 10;

export const registerUser = async (input: RegisterInput) => {
  const { email, password } = input;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("Email already in use"); // Consider a more specific error type later
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
    // Select only necessary fields to return
    select: {
      id: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
};

export const loginUser = async (input: LoginInput): Promise<string | null> => {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null; // User not found
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return null; // Invalid password
  }

  // Password is valid, generate JWT
  // Use validated JWT_SECRET from config
  // No need to check if secret exists, Zod validation already did
  const secret = config.JWT_SECRET;

  // Create payload for the token (customize as needed)
  const payload = {
    id: user.id,
    email: user.email,
    // Add roles or other relevant info if needed later
  };

  // Sign the token (expires in 1 hour - adjust as needed)
  const token = jwt.sign(payload, secret, { expiresIn: "1h" });

  return token; // Return the generated token
};
