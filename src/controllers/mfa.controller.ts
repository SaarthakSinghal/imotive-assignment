import { Request, Response } from "express";
import qrcode from "qrcode";
import { generateMfaSetup, verifyMfaSetup } from "../services/mfa.service";
import { PrismaClient } from "../generated/prisma"; // Import PrismaClient

const prisma = new PrismaClient(); // Instantiate PrismaClient

export const enableMfaSetupHandler = async (req: Request, res: Response) => {
  // Get userId from session (ensureAuthenticated middleware guarantees it exists)
  const userId = req.session.userId!;

  try {
    // Fetch user email needed for OTP label
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      // This shouldn't happen if session userId is valid
      console.error(`[MFA Controller] User ${userId} not found in DB.`);
      res
        .status(401)
        .json({ status: "fail", message: "Invalid user session." });
      return;
    }
    const email = user.email;

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
  // Get userId from session
  const userId = req.session.userId!;
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ status: "fail", message: "MFA token is required." });
    return;
  }

  try {
    // Service now returns backup codes array or null
    const backupCodes = await verifyMfaSetup(userId, token);

    if (backupCodes) {
      // Include backup codes in the success response
      res.status(200).json({
        status: "success",
        message: "MFA enabled successfully. Save your backup codes!",
        data: {
          backupCodes: backupCodes,
        },
      });
    } else {
      res.status(400).json({
        status: "fail",
        message: "Invalid MFA token or setup failed.",
      });
    }
    return;
  } catch (error) {
    console.error(
      `[MFA Controller] Error verifying MFA setup for user ${userId}:`,
      error
    );
    // Include error message if it was thrown by generateAndStoreBackupCodes
    const errorMessage =
      error instanceof Error ? error.message : "Failed to verify MFA setup.";
    res.status(500).json({ status: "error", message: errorMessage });
    return;
  }
};
