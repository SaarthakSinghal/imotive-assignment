import { Request, Response } from "express";
import { Session, SessionData } from "express-session";
import {
  registerUser,
  loginUser,
  verifyEmailToken,
  requestPasswordReset,
  resetPassword,
} from "../services/auth.service";
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyMfaLoginInput,
  VerifyMfaBackupInput,
} from "../utils/validators";
import { verifyLoginMfa, verifyBackupCode } from "../services/mfa.service";
import { PrismaClient } from "../generated/prisma";
import jwt from "jsonwebtoken";
import config from "../config";

const prisma = new PrismaClient();

// --- Type Augmentation for Express Session ---
declare module "express-session" {
  interface SessionData {
    userId?: string; // Add userId property to session data
    _csrf?: string; // Add _csrf property for csurf secret
  }
}
// --- End Type Augmentation ---

export const registerHandler = async (
  // Explicitly type req.body using RegisterInput
  req: Request<{}, {}, RegisterInput>,
  res: Response
) => {
  try {
    // Call the updated registerUser service
    const result = await registerUser(req.body);

    // Return the message from the service
    res.status(201).json({
      status: "success",
      message: result.message, // Use the message from the result
      // Optionally include userId if needed by the frontend: data: { userId: result.userId }
    });
  } catch (error: any) {
    if (error.message === "Email already in use") {
      res.status(409).json({
        status: "fail",
        message: "Email already exists",
      });
      return;
    }
    // Generic error handler
    console.error("Registration Error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
    return;
  }
};

// Updated Login Handler
export const loginHandler = async (
  req: Request<{}, {}, LoginInput>,
  res: Response
) => {
  try {
    // loginUser now returns LoginResult | null
    const result = await loginUser(req.body);

    if (!result) {
      // Service returns null for invalid credentials/unverified user
      res.status(401).json({
        status: "fail",
        message: "Invalid credentials or account not verified.", // Updated message
      });
      return;
    }

    // Check the status from the service result
    if (result.status === "success") {
      // MFA not enabled, establish session
      req.session.userId = result.userId; // Store userId in session
      // Optionally save explicitly, though usually automatic on response end
      // req.session.save();

      res.status(200).json({
        status: "success",
        message: "Login successful", // Simple success message
        // No token returned
      });
    } else if (result.status === "mfa_required") {
      // MFA is required, send back status and MFA pending token
      res.status(200).json({
        // Still 200 OK, but indicates next step
        status: "mfa_required",
        mfaToken: result.mfaToken,
      });
    } else {
      // Should not happen based on LoginResult type, but handle defensively
      console.error(
        "[Login Handler] Unexpected result status from loginUser service"
      );
      res
        .status(500)
        .json({ status: "error", message: "Internal Server Error" });
    }
    return; // Ensure explicit return after handling response
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal Server Error",
    });
    return;
  }
};

// --- Verification Handler ---
export const verifyEmailHandler = async (req: Request, res: Response) => {
  // Token will be in URL parameters (e.g., /verify/:token)
  const { token } = req.params;

  // Basic check if token exists in params
  if (!token) {
    res
      .status(400)
      .json({ status: "fail", message: "Verification token is required." });
    return; // Explicitly return void
  }

  try {
    const success = await verifyEmailToken(token);

    if (success) {
      // Consider redirecting to a frontend page e.g., res.redirect('/login?verified=true');
      res
        .status(200)
        .json({ status: "success", message: "Email verified successfully." });
      return; // Explicitly return void
    } else {
      // Token invalid, expired, or already used
      res.status(400).json({
        status: "fail",
        message: "Invalid or expired verification token.",
      });
      return; // Explicitly return void
    }
  } catch (error) {
    console.error("Email Verification Error:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
    return; // Explicitly return void
  }
};

// --- Forgot Password Handler ---
export const forgotPasswordHandler = async (
  // Use ForgotPasswordInput for validation
  req: Request<{}, {}, ForgotPasswordInput>,
  res: Response
) => {
  try {
    await requestPasswordReset(req.body);

    // Always return a generic success response
    res.status(200).json({
      status: "success",
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    // Log unexpected errors but still return generic success to user
    console.error("Forgot Password Error:", error);
    res.status(200).json({
      // Still 200 OK
      status: "success",
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }
};

// --- Reset Password Handler ---
export const resetPasswordHandler = async (
  // Use ResetPasswordInput for validation
  req: Request<{}, {}, ResetPasswordInput>,
  res: Response
) => {
  try {
    const success = await resetPassword(req.body);

    if (success) {
      res
        .status(200)
        .json({ status: "success", message: "Password reset successfully." });
    } else {
      // Token invalid, expired, or DB error during transaction
      res.status(400).json({
        status: "fail",
        message: "Invalid or expired password reset token.",
      });
    }
    return; // Explicitly return void
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
    return; // Explicitly return void
  }
};

// --- MFA Login Verification Handler ---
interface MfaPendingJwtPayload {
  id: string;
  purpose: "mfa-pending";
  iat: number;
  exp: number;
}

export const mfaLoginHandler = async (
  // Use VerifyMfaLoginInput for validation
  req: Request<{}, {}, VerifyMfaLoginInput>,
  res: Response
) => {
  const { mfaToken, totpCode } = req.body;

  try {
    // 1. Verify the MFA pending token
    let payload: MfaPendingJwtPayload;
    try {
      payload = jwt.verify(mfaToken, config.JWT_SECRET) as MfaPendingJwtPayload;
      if (payload.purpose !== "mfa-pending") {
        throw new Error("Invalid token purpose");
      }
    } catch (err) {
      console.warn("[MFA Login] Invalid or expired MFA pending token:", err);
      res
        .status(401)
        .json({ status: "fail", message: "Invalid or expired MFA session." });
      return; // Explicit return
    }

    const userId = payload.id;

    // 2. Verify the TOTP code using the MFA service
    // Service now returns userId on success, null on failure
    const verifiedUserId = await verifyLoginMfa(userId, totpCode);

    // if (!isTotpValid) {
    if (!verifiedUserId) {
      res.status(401).json({ status: "fail", message: "Invalid MFA code." });
      return; // Explicit return
    }

    // 3. Code is valid, establish session
    req.session.userId = verifiedUserId; // Set user ID in session

    /* Remove final JWT generation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      console.error(
        `[MFA Login] User ${userId} not found after valid MFA pending token.`
      );
      res
        .status(500)
        .json({ status: "error", message: "Internal Server Error" });
      return; // Explicit return
    }

    const finalJwtSecret = config.JWT_SECRET;
    const finalPayload = { id: userId, email: user.email };
    const finalToken = jwt.sign(finalPayload, finalJwtSecret, {
      expiresIn: "1h",
    });
    */

    // 4. Send success response
    res.status(200).json({
      status: "success",
      message: "Login successful",
      // token: finalToken,
    });
    return; // Explicit return
  } catch (error) {
    console.error("MFA Login Verification Error:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
    return; // Explicit return
  }
};

// --- MFA Login with Backup Code Handler ---
export const mfaLoginBackupHandler = async (
  req: Request<{}, {}, VerifyMfaBackupInput>,
  res: Response
) => {
  const { mfaToken, backupCode } = req.body;

  try {
    // 1. Verify the MFA pending token
    let payload: MfaPendingJwtPayload;
    try {
      payload = jwt.verify(mfaToken, config.JWT_SECRET) as MfaPendingJwtPayload;
      if (payload.purpose !== "mfa-pending") {
        throw new Error("Invalid token purpose");
      }
    } catch (err) {
      console.warn(
        "[MFA Login Backup] Invalid or expired MFA pending token:",
        err
      );
      res
        .status(401)
        .json({ status: "fail", message: "Invalid or expired MFA session." });
      return; // Add explicit return
    }

    const userId = payload.id;

    // 2. Verify the Backup Code
    // Service now returns userId on success, null on failure
    const verifiedUserId = await verifyBackupCode(userId, backupCode);

    // if (!isBackupCodeValid) {
    if (!verifiedUserId) {
      res.status(401).json({ status: "fail", message: "Invalid backup code." });
      return; // Add explicit return
    }

    // 3. Backup code is valid, establish session
    req.session.userId = verifiedUserId; // Set user ID in session

    /* Remove final JWT generation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      console.error(
        `[MFA Login Backup] User ${userId} not found after valid MFA pending token.`
      );
      res
        .status(500)
        .json({ status: "error", message: "Internal Server Error" });
      return; // Add explicit return
    }

    const finalJwtSecret = config.JWT_SECRET;
    const finalPayload = { id: userId, email: user.email };
    const finalToken = jwt.sign(finalPayload, finalJwtSecret, {
      expiresIn: "1h",
    });
    */

    // 4. Send success response
    res.status(200).json({
      status: "success",
      message: "Login successful",
      // token: finalToken,
    });
    return; // Add explicit return
  } catch (error) {
    console.error("MFA Backup Code Login Error:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
    return; // Add explicit return
  }
};

// --- Logout Handler ---
export const logoutHandler = (req: Request, res: Response) => {
  // ensureAuthenticated middleware already confirmed user is logged in
  const sessionId = req.session.id; // For logging purposes
  const userId = req.session.userId; // For logging purposes

  req.session.destroy((err) => {
    if (err) {
      console.error(
        `[Logout Handler] Session destruction error for user ${userId} (Session ID: ${sessionId}):`,
        err
      );
      // Even if destruction fails, proceed to clear cookie and respond
      // Optionally return 500, but usually client just needs to know logout was attempted
    }

    // Clear the session cookie on the client side
    // Use the same name as configured in sessionOptions (default is 'connect.sid')
    res.clearCookie("connect.sid"); // TODO: Make cookie name configurable if needed

    console.log(
      `[Logout Handler] User ${userId} logged out successfully (Session ID: ${sessionId}).`
    );
    res.status(200).json({ status: "success", message: "Logout successful" });
  });
  // No return needed here as destroy is async with callback
};
