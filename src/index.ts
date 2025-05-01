import express, { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit"; // Import rate limiter
import session from "express-session"; // Import session
import csurf from "csurf"; // Import csurf
import { sessionOptions } from "./config/session.config"; // Import session config
import config from "./config"; // Import centralized config
import authRoutes from "./routes/auth.routes"; // Import auth routes
import mfaRoutes from "./routes/mfa.routes"; // Import MFA routes

const app: Express = express();
const port = config.PORT;

// Apply basic rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 15 minutes", // Optional custom message
});
app.use(limiter);

// Configure session middleware
app.use(session(sessionOptions));

app.use(express.json()); // Middleware to parse JSON bodies

// Apply CSRF protection after session and body parsing
const csrfProtection = csurf();
app.use(csrfProtection);

// Optional: Error handler specifically for CSRF errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === "EBADCSRFTOKEN") {
    console.warn(
      `[CSRF] Invalid CSRF token detected for request: ${req.method} ${req.originalUrl}`
    );
    res.status(403).json({ status: "fail", message: "Invalid CSRF token." });
  } else {
    // Pass other errors along
    next(err);
  }
});

app.get("/", (req: Request, res: Response) => {
  res.send("Auth System API");
});

// Mount Auth routes
app.use("/api/auth", authRoutes);

// Mount MFA routes
app.use("/api/mfa", mfaRoutes);

// TODO: Add Auth routes

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default app; // Export for potential testing
