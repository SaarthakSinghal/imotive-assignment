import { Request, Response, NextFunction } from "express";

/**
 * Middleware to ensure the user is authenticated.
 * Checks for `userId` in the session.
 */
export const ensureAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if the userId exists in the session
  if (req.session?.userId) {
    // User is authenticated, proceed to the next middleware or route handler
    return next();
  } else {
    // User is not authenticated
    res.status(401).json({
      status: "fail",
      message: "Unauthorized: You must be logged in to access this resource.",
    });
    // No return needed after sending response
  }
};
