import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

// Define schema for environment variables
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET must be defined"),
  PORT: z.coerce.number().int().positive().optional().default(3000), // Coerce to number, default 3000
});

// Validate environment variables
let config: z.infer<typeof envSchema>;
try {
  config = envSchema.parse(process.env);
  console.log("[config]: Environment variables validated successfully.");
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("[config]: Environment variable validation failed:");
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join(".")}: ${err.message}`);
    });
  }
  console.error("[config]: Exiting due to invalid environment variables.");
  process.exit(1); // Exit if validation fails
}

export default config;
