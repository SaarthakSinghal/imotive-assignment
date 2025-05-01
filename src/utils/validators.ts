import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Not a valid email"),
    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be at least 8 characters long"),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];

// Schema for Login
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Not a valid email"),
    password: z.string({
      required_error: "Password is required",
    }),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];

// Schema for Forgot Password Request
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Not a valid email"),
  }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];

// Schema for Reset Password
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({
        required_error: "Reset token is required",
      })
      .min(1, "Reset token cannot be empty"), // Basic check
    password: z
      .string({
        required_error: "New password is required",
      })
      .min(8, "Password must be at least 8 characters long"),
    // Optional: Add password confirmation field if desired
    // passwordConfirmation: z.string().min(8),
  }),
}); // Optional: Add refinement to check if password and confirmation match
// .refine((data) => data.body.password === data.body.passwordConfirmation, {
//   message: "Passwords do not match",
//   path: ["body", "passwordConfirmation"], // Path of error
// });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
