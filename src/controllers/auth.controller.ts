import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  verifyEmailToken,
} from "../services/auth.service";
import { RegisterInput, LoginInput } from "../utils/validators";

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

// Login Handler
export const loginHandler = async (
  // Explicitly type req.body using LoginInput
  req: Request<{}, {}, LoginInput>,
  res: Response
) => {
  try {
    const token = await loginUser(req.body);

    if (!token) {
      // Service returns null for invalid credentials
      res.status(401).json({
        status: "fail",
        message: "Invalid email or password",
      });
      return;
    }

    // Send the token back to the client
    res.status(200).json({
      status: "success",
      token,
    });
  } catch (error: any) {
    // Handle potential errors from login service (e.g., config error)
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
