import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import config from "./index";

// Create a pg Pool for connect-pg-simple
// It needs direct access, doesn't easily integrate with Prisma Client instance
const pgPool = new Pool({
  connectionString: config.DATABASE_URL,
});

// Initialize the session store
const PgSessionStore = connectPgSimple(session);
const store = new PgSessionStore({
  pool: pgPool,
  tableName: "user_sessions", // Name of the session table
  createTableIfMissing: true,
});

// Session configuration options
const sessionOptions: session.SessionOptions = {
  store: store,
  secret: config.SESSION_SECRET,
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something stored
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true, // Prevent client-side JS from reading the cookie
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production (requires HTTPS)
    sameSite: "lax", // Protect against CSRF attacks
  },
};

export { sessionOptions, store };
