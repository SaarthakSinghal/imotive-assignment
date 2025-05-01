import express, { Express, Request, Response } from "express";
import config from "./config"; // Import centralized config
import authRoutes from "./routes/auth.routes"; // Import auth routes

const app: Express = express();
const port = config.PORT;

app.use(express.json()); // Middleware to parse JSON bodies

app.get("/", (req: Request, res: Response) => {
  res.send("Auth System API");
});

// Mount Auth routes
app.use("/api/auth", authRoutes);

// TODO: Add Auth routes

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default app; // Export for potential testing
