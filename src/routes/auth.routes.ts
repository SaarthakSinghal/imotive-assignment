import express from "express";
import {
  registerHandler,
  loginHandler,
  verifyEmailHandler,
} from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema } from "../utils/validators";

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

// TODO: Add Login route

export default router;
