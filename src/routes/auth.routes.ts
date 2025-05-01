import express from "express";
import { registerHandler, loginHandler } from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema } from "../utils/validators";

const router = express.Router();

// Register route
// POST /api/auth/register
router.post("/register", validate(registerSchema), registerHandler);

// Login route
// POST /api/auth/login
router.post("/login", validate(loginSchema), loginHandler);

// TODO: Add Login route

export default router;
