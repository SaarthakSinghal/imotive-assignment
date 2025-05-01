import express from "express";
import {
  enableMfaSetupHandler,
  verifyMfaSetupHandler,
} from "../controllers/mfa.controller";
// Import the actual authentication middleware
import { ensureAuthenticated } from "../middleware/auth.middleware";

const router = express.Router();

// Apply proper authentication middleware to all MFA routes
router.use(ensureAuthenticated);

/* Remove Placeholder Middleware
router.use((req, res, next) => {
  // --- PLACEHOLDER ---
  // In real app, verify JWT from Authorization header
  // Decode JWT, find user, attach user info (id, email) to req obj
  // If invalid/expired token, return 401
  // Example pseudo-code:
  // const user = authenticateToken(req.headers.authorization);
  // if (!user) return res.sendStatus(401);
  // (req as any).userId = user.id;
  // (req as any).userEmail = user.email;

  // --- TEMPORARY WORKAROUND FOR TESTING (REMOVE IN PRODUCTION) ---
  // This is highly insecure and only for demonstrating flow without auth middleware yet.
  // We'll manually add placeholder ID/email to the request.
  // Replace these with actual values from a test user you registered.
  // (req as any).userId = "clw1y74d2000078pyw4v53739"; // <<< REPLACE WITH ACTUAL TEST USER ID
  // (req as any).userEmail = "argonuser@example.com"; // <<< REPLACE WITH ACTUAL TEST USER EMAIL
  // console.warn(
  //   "[MFA Routes] Using temporary insecure user ID/email injection for testing!"
  // );
  // --- END TEMPORARY WORKAROUND ---
  next();
});
*/

// Route to initiate MFA setup (generates secret, returns QR code data)
// POST /api/mfa/setup
router.post("/setup", enableMfaSetupHandler);

// Route to verify the TOTP code and enable MFA
// POST /api/mfa/verify
router.post("/verify", verifyMfaSetupHandler);

// TODO: Add routes for disabling MFA, viewing status, backup codes etc.

export default router;
