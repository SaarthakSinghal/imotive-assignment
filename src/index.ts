import express, { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit"; // Import rate limiter
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

app.use(express.json()); // Middleware to parse JSON bodies

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
