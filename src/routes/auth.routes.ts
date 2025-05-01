import express from "express";
import {
  registerHandler,
  loginHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  mfaLoginHandler,
  mfaLoginBackupHandler,
  logoutHandler,
} from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { ensureAuthenticated } from "../middleware/auth.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyMfaLoginSchema,
  verifyMfaBackupSchema,
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

// MFA Login Verification route
// POST /api/auth/login/mfa
router.post("/login/mfa", validate(verifyMfaLoginSchema), mfaLoginHandler);

// MFA Backup Code Login route
// POST /api/auth/login/backup
router.post(
  "/login/backup",
  validate(verifyMfaBackupSchema),
  mfaLoginBackupHandler
);

// Logout route
// POST /api/auth/logout
// Requires user to be authenticated
router.post("/logout", ensureAuthenticated, logoutHandler);

// Route to get CSRF token
// GET /api/auth/csrf-token
// Needs to be accessed by authenticated or unauthenticated users depending on the form
// For simplicity, we won't protect it with ensureAuthenticated here.
router.get("/csrf-token", (req, res) => {
  const token = req.csrfToken();
  // --- DEBUG CSRF ---
  // console.log(`[CSRF DEBUG] GET /csrf-token`);
  // console.log(`             Session ID: ${req.session.id}`);
  // console.log(`             CSRF Secret in Session: ${req.session._csrf}`); // Default location where csurf stores the secret
  // console.log(`             Generated Token: ${token}`);
  // --- END DEBUG ---
  res.json({ csrfToken: token });
});

// TODO: Add Login route

export default router;
