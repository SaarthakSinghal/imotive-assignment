import express from "express";
import {
  registerHandler,
  loginHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../utils/validators";

const router = express.Router();

// Register route
// POST /api/auth/register
router.post("/register", validate(registerSchema), registerHandler);

// Login route
// POST /api/auth/login
router.post("/login", validate(loginSchema), loginHandler);

// Verify Email route
// GET /api/auth/verify/:token
router.get("/verify/:token", verifyEmailHandler);

// Forgot Password route
// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPasswordHandler
);

// Reset Password route
// POST /api/auth/reset-password
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPasswordHandler
);

// TODO: Add Login route

export default router;
