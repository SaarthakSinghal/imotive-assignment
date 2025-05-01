import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

// Middleware factory function
export const validate =
  (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        // Format Zod errors for a cleaner response
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        res.status(400).json({
          status: "fail",
          errors,
        });
        return; // Explicitly return void after sending response
      }
      // Handle unexpected errors during validation
      console.error("Validation Error (Non-Zod):", error);
      res.status(500).json({
        status: "error",
        message: "Internal Server Error during validation",
      });
      return; // Explicitly return to satisfy Express types
    }
  };
