import { Request, Response } from "express";
import qrcode from "qrcode";
import { generateMfaSetup, verifyMfaSetup } from "../services/mfa.service";

// Placeholder for extracting authenticated user ID (replace with actual middleware logic)
const getUserIdFromRequest = (req: Request): string | null => {
  // Example: return req.user?.id;
  // For now, returning a hardcoded ID for testing is problematic.
  // Let's assume middleware adds it, but throw if missing.
  if ((req as any).userId) {
    return (req as any).userId as string;
  }
  // In a real app, middleware should reject unauthenticated requests before reaching here.
  console.error(
    "[MFA Controller] User ID missing from request. Auth middleware not run or failed?"
  );
  return null;
};

// Placeholder for extracting user email (needed for OTP label)
const getUserEmailFromRequest = (req: Request): string | null => {
  // Example: return req.user?.email;
  if ((req as any).userEmail) {
    return (req as any).userEmail as string;
  }
  console.error("[MFA Controller] User email missing from request.");
  return null;
};

export const enableMfaSetupHandler = async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const email = getUserEmailFromRequest(req); // Needed for otpauth URL label

  if (!userId || !email) {
    res
      .status(401)
      .json({ status: "fail", message: "Authentication required." });
    return;
  }

  try {
    const { otpAuthUrl } = await generateMfaSetup(userId, email);

    // Generate QR code from the otpauth:// URL
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    res.status(200).json({
      status: "success",
      data: {
        // Send the QR code data URL to the frontend to display
        qrCodeDataUrl,
        // DO NOT send the raw secret or the otpAuthUrl directly
      },
    });
    return;
  } catch (error) {
    console.error(
      `[MFA Controller] Error generating MFA setup for user ${userId}:`,
      error
    );
    res
      .status(500)
      .json({ status: "error", message: "Failed to initiate MFA setup." });
    return;
  }
};

export const verifyMfaSetupHandler = async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const { token } = req.body; // Get TOTP token from request body

  if (!userId) {
    res
      .status(401)
      .json({ status: "fail", message: "Authentication required." });
    return;
  }

  if (!token || typeof token !== "string") {
    res.status(400).json({ status: "fail", message: "MFA token is required." });
    return;
  }

  try {
    const success = await verifyMfaSetup(userId, token);

    if (success) {
      res
        .status(200)
        .json({ status: "success", message: "MFA enabled successfully." });
    } else {
      res.status(400).json({ status: "fail", message: "Invalid MFA token." });
    }
    return;
  } catch (error) {
    console.error(
      `[MFA Controller] Error verifying MFA setup for user ${userId}:`,
      error
    );
    res
      .status(500)
      .json({ status: "error", message: "Failed to verify MFA setup." });
    return;
  }
};
