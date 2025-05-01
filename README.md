# Advanced Authentication System

A secure and robust user authentication system built with Node.js, Express, TypeScript, and Prisma.

## Features

- **User Registration:** Allows new users to sign up.
- **User Login:** Authenticates existing users using email and password.
- **Password Hashing:** Securely hashes passwords using Argon2id.
- **JWT Authentication:** Uses JSON Web Tokens for session management.
- **Email Verification:** Sends verification emails to new users.
- **Password Reset:** Allows users to reset their passwords securely via email.
- **Rate Limiting:** Protects against brute-force attacks on authentication endpoints.
- **TypeScript:** Built with TypeScript for type safety and better developer experience.
- **Prisma ORM:** Uses Prisma for database interactions.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Language:** TypeScript
- **Database ORM:** Prisma
- **Password Hashing:** Argon2id (`argon2`)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`)
- **Email:** Nodemailer (or similar, depending on implementation)
- **Validation:** Zod (or similar, depending on implementation)
- **Rate Limiting:** `express-rate-limit`

## Project Structure

```
auth-system/
├── prisma/                 # Prisma schema, migrations, and client
│   ├── schema.prisma
│   └── migrations/
├── src/                    # Source code
│   ├── config/             # Configuration files (e.g., environment variables)
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Express middleware (auth, rate limiting, validation)
│   ├── models/             # Database models (interfaces/types, possibly Prisma generated types)
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions (email, tokens, etc.)
│   └── server.ts           # Express application entry point
├── .env.example            # Example environment variables file
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

_(Note: This is a typical structure; adjust based on the actual project layout.)_

## Setup

1.  **Prerequisites:**

    - Node.js (v18 or later recommended)
    - npm or yarn
    - A database supported by Prisma (e.g., PostgreSQL, MySQL, SQLite)
    - An SMTP server or email service (for email verification and password reset)

2.  **Clone the Repository:**

    ```bash
    git clone <repository-url>
    cd auth-system
    ```

3.  **Install Dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

4.  **Set Up Environment Variables:**

    - Copy the example environment file:
      ```bash
      cp .env.example .env
      ```
    - Edit the `.env` file and provide necessary values for:
      - `DATABASE_URL`: Your database connection string (see [Prisma docs](https://www.prisma.io/docs/reference/database-reference/connection-urls))
      - `JWT_SECRET`: A strong secret key for signing JWTs.
      - `JWT_EXPIRATION`: JWT expiration time (e.g., `1h`, `7d`).
      - `PORT`: The port the server will run on (e.g., `3000`).
      - `EMAIL_HOST`: SMTP host.
      - `EMAIL_PORT`: SMTP port.
      - `EMAIL_USER`: SMTP username.
      - `EMAIL_PASS`: SMTP password.
      - `EMAIL_FROM`: Default "from" address for emails.
      - `CLIENT_URL`: The base URL of your frontend application (used in email links).

5.  **Database Setup:**
    - Run Prisma migrations to create the database schema:
      ```bash
      npx prisma migrate dev
      ```
    - (Optional) Seed the database if seed scripts are available:
      ```bash
      npx prisma db seed
      ```

## Running the Application

1.  **Development Mode:**

    - Starts the server with hot-reloading using `ts-node-dev` or similar.

    ```bash
    npm run dev
    ```

2.  **Build for Production:**

    - Compiles TypeScript to JavaScript in the `dist` directory.

    ```bash
    npm run build
    ```

3.  **Start Production Server:**
    - Runs the compiled JavaScript code. Ensure `.env` variables are available in the production environment.
    ```bash
    npm start
    ```

The server will typically be available at `http://localhost:PORT` (replace `PORT` with the value from your `.env` file).

## API Endpoints

_(Provide a summary of the main API endpoints. This might require reviewing the `src/routes/` directory)_

- **`POST /api/auth/register`**: Register a new user.
  - Body: `{ name: string, email: string, password: string }`
- **`POST /api/auth/login`**: Log in an existing user.
  - Body: `{ email: string, password: string }`
  - Returns: `{ accessToken: string }`
- **`GET /api/auth/verify-email/:token`**: Verify user's email address.
- **`POST /api/auth/forgot-password`**: Request a password reset email.
  - Body: `{ email: string }`
- **`POST /api/auth/reset-password/:token`**: Set a new password using a reset token.
  - Body: `{ password: string }`
- **`GET /api/users/me`** (Example protected route): Get current user details.
  - Requires `Authorization: Bearer <accessToken>` header.

_(Add more endpoints as needed)_

## Security Considerations

- **Password Hashing:** Argon2id is used for strong, salted password hashing.
- **Rate Limiting:** Applied to sensitive endpoints like login and password reset requests to prevent brute-force attacks.
- **Input Validation:** Ensure all incoming data is validated (e.g., using Zod) to prevent injection attacks and ensure data integrity.
- **HTTPS:** Always run the application behind HTTPS in production.
- **Helmet:** Consider using the `helmet` middleware for setting various security-related HTTP headers.
- **CSRF Protection:** Implement CSRF protection if using cookie-based sessions alongside or instead of JWTs in headers.
- **Dependency Updates:** Regularly update dependencies to patch known vulnerabilities.
