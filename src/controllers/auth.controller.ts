import { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service";
import { RegisterInput, LoginInput } from "../utils/validators";

export const registerHandler = async (
  // Explicitly type req.body using RegisterInput
  req: Request<{}, {}, RegisterInput>,
  res: Response
) => {
  try {
    const user = await registerUser(req.body);
    // Exclude passwordHash from the response
    res.status(201).json({
      status: "success",
      data: {
        user,
      },
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
