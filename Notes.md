## Authentication System Development Notes (Up to Phase 1.4)

This document outlines the key steps taken and security considerations implemented during the initial phases of the authentication system development.

### Phase 1.1: Project Initialization & Setup

- **Stack:** Node.js with Express framework and TypeScript for type safety.
- **Dependencies:**
  - `express`: Web server framework.
  - `typescript`, `@types/node`, `@types/express`, `ts-node`: TypeScript support.
  - `nodemon`: Automatic server restarts during development.
  - `dotenv`: Loading environment variables from a `.env` file.
  - `zod`: Input validation library.
- **Database ORM:** Prisma was chosen for database interactions, simplifying schema management and queries.
- **Database:** PostgreSQL, run via a Docker container for isolated and reproducible development environment.
- **Project Structure:** A standard structure (`src`, `src/controllers`, `src/services`, `src/routes`, `src/middleware`, `src/config`, `src/utils`, `prisma`) was established for organization.
- **Configuration:**
  - `tsconfig.json`: Configured for TypeScript compilation (targeting ES2016, CommonJS modules, outputting to `dist`, strict mode enabled).
  - `package.json`: Configured with `dev`, `build`, and `start` scripts.

### Phase 1.2: Basic User Model & Registration Endpoint

- **Database Schema (`prisma/schema.prisma`):**
  - Defined a `User` model with `id`, `email` (unique), `passwordHash`, `createdAt`, `updatedAt`.
  - Configured Prisma to connect to the PostgreSQL database using the `DATABASE_URL` environment variable.
  - Applied the schema using `prisma migrate dev`.
- **Password Hashing:**
  - **Library:** `bcrypt` was installed.
  - **Process:** When a user registers, their plain-text password is **never** stored. Instead, `bcrypt.hash()` generates a secure, salted hash of the password. The salt is automatically handled by `bcrypt`.
  - **Security:** This prevents attackers from obtaining plain-text passwords even if they gain access to the database. Brute-forcing salted hashes is computationally expensive. `saltRounds` was set to 10 (a common default).
- **Input Validation:**
  - **Library:** `zod` used to define schemas (`src/utils/validators.ts`).
  - **Implementation:** A `registerSchema` validates the request body for `email` (must be a valid email format) and `password` (must be at least 8 characters).
  - **Middleware:** A reusable `validate` middleware (`src/middleware/validate.ts`) was created to apply Zod schemas to incoming requests, returning clear `400 Bad Request` errors if validation fails.
  - **Security:** Prevents invalid or malicious data from reaching service logic, reducing potential errors and attack vectors.
- **Registration Logic (`src/services/auth.service.ts`):**
  - Checks if the email already exists to prevent duplicates.
  - Hashes the validated password using `bcrypt`.
  - Creates the user record in the database via Prisma.
  - Returns the created user data (excluding the password hash).
- **API Endpoint (`src/routes/auth.routes.ts` & `src/controllers/auth.controller.ts`):**
  - Defined `POST /api/auth/register`.
  - Uses the `validate` middleware with `registerSchema`.
  - Calls the `registerHandler` controller, which in turn calls the `registerUser` service.
  - Returns `201 Created` on success or appropriate error codes (`409 Conflict` for existing email, `500 Internal Server Error` for other issues).

### Phase 1.3: Basic Login Endpoint

- **Password Verification:**
  - **Process:** During login, the user provides email and password. The system retrieves the user by email and uses `bcrypt.compare()` to compare the provided password against the stored `passwordHash`.
  - **Security:** `bcrypt.compare()` performs the same hashing process on the provided password (using the salt stored within the hash) and compares the results securely without exposing the stored hash.
- **JSON Web Tokens (JWT):**
  - **Library:** `jsonwebtoken` was installed.
  - **Process:** Upon successful password verification, a JWT is generated using `jwt.sign()`.
  - **Payload:** The token payload includes non-sensitive user identifiers (e.g., `id`, `email`).
  - **Secret:** The token is signed using a secret key (`JWT_SECRET`) stored securely as an environment variable.
  - **Expiry:** The token is configured with an expiration time (`expiresIn: '1h'`).
  - **Security:** JWTs allow stateless authentication. The signature ensures the token hasn't been tampered with. The expiry limits the time window an attacker could use a compromised token.
- **Input Validation:**
  - A `loginSchema` was added to `src/utils/validators.ts` to validate email and password presence/format during login.
- **Login Logic (`src/services/auth.service.ts`):**
  - Finds the user by email.
  - Returns `null` if the user is not found or if `bcrypt.compare()` fails.
  - If validation succeeds, generates and returns the JWT.
- **API Endpoint (`src/routes/auth.routes.ts` & `src/controllers/auth.controller.ts`):**
  - Defined `POST /api/auth/login`.
  - Uses the `validate` middleware with `loginSchema`.
  - Calls the `loginHandler` controller, which calls the `loginUser` service.
  - Returns `200 OK` with the JWT on success or `401 Unauthorized` for invalid credentials.

### Phase 1.4: Environment Configuration

- **Centralized Config (`src/config/index.ts`):**
  - Created a dedicated module to handle environment variables.
- **Validation:**
  - Uses `zod` to define a schema (`envSchema`) for required environment variables (`DATABASE_URL`, `JWT_SECRET`, `PORT`).
  - Validates `process.env` against this schema on application startup.
  - **Security:** Ensures the application doesn't start with missing or invalid critical configuration (like database URLs or JWT secrets). Prevents runtime errors due to misconfiguration.
- **Usage:**
  - Other modules (like `index.ts`, `auth.service.ts`) now import the validated `config` object instead of accessing `process.env` directly.
  - Removes the need for `dotenv.config()` calls in multiple files.

### General Notes & Fixes

- **TypeScript Type Safety:** Resolved type errors related to Express middleware/handler return types by ensuring functions explicitly return `void` after sending responses in error cases (in `validate.ts`, `auth.controller.ts`).
- **Database Management:** PostgreSQL is managed via Docker, ensuring isolation from the host system and easy setup/teardown. `prisma migrate reset` was used to ensure a clean database state after configuration changes.

### Phase 2.1: Email Verification Logic

- **Goal:** Require users to confirm their email address after registration before they can log in.
- **Schema Changes (`prisma/schema.prisma`):**
  - Added `isVerified: Boolean @default(false)` to the `User` model.
  - Created a `VerificationToken` model (`id`, `token` (unique), `expiresAt`, `userId` (relation to `User`), `createdAt`).
  - Applied changes using `prisma migrate dev --name add_verification`.
- **Registration Flow Update (`src/services/auth.service.ts`):**
  - Uses Node.js `crypto.randomBytes` to generate a secure, random verification token (32 bytes, hex encoded).
  - Stores the token, a 24-hour expiry date, and the `userId` in the `VerificationToken` table.
  - Does **not** return user data or log the user in anymore. Instead, returns a success message indicating verification is needed.
  - Includes a `console.log` placeholder for the token (actual email sending deferred).
- **Login Flow Update (`src/services/auth.service.ts`):**
  - Modified `loginUser` to check `user.isVerified` **before** comparing passwords or generating a JWT.
  - Returns `null` (leading to a `401 Unauthorized` response) if the user is not found OR if `isVerified` is `false`.
  - **Security:** Prevents unverified accounts from logging in.
- **Verification Endpoint (`GET /api/auth/verify/:token`):**
  - **Service (`verifyEmailToken`):**
    - Finds the `VerificationToken` record by the provided token.
    - Checks if the token exists and has not expired (`expiresAt < new Date()`).
    - If valid and the associated user is not already verified, it uses a Prisma transaction (`prisma.$transaction`) to:
      - Set `isVerified = true` on the `User` record.
      - Delete the used `VerificationToken` record.
    - Returns `true` on success, `false` otherwise (invalid/expired token or DB error).
    - **Security:** Transaction ensures atomicity (user is marked verified only if the token is successfully deleted). Deleting the token prevents reuse.
  - **Controller (`verifyEmailHandler`):** Handles the request, calls the service, and returns appropriate success (`200 OK`) or failure (`400 Bad Request`) JSON responses.
- **Errors Encountered & Fixes:**
  - **Prisma Client Sync:** After modifying the schema and service, TypeScript errors occurred (`Property 'verificationToken'/'isVerified' does not exist`). This was because the generated Prisma Client was outdated.
    - **Fix:** Ran `npx prisma generate` to update the client types based on the new schema.
  - **Express Handler Types:** Adding the `verifyEmailHandler` (an `async` function) caused TypeScript errors in the router (`auth.routes.ts`) because the handler's implicit return type (`Promise<Response | undefined>`) didn't match the expected `Promise<void>`.
    - **Fix:** Modified `verifyEmailHandler` (and others previously) to explicitly use `return;` after sending a response (`res.status(...).json(...)`), ensuring the function signature matches Express's expectations.

### Phase 2.2: Rate Limiting and Abuse Protection

- **Goal:** Protect auth endpoints (and others) from brute-force attacks and general abuse.
- **Library:** Installed `express-rate-limit` and its types (`@types/express-rate-limit`).
- **Implementation (`src/index.ts`):**
  - Configured a basic rate limiter middleware.
  - **Settings:** Allows 100 requests per IP address within a 15-minute window (`windowMs: 15 * 60 * 1000`, `max: 100`).
  - Applied the limiter globally (`app.use(limiter)`) before other middleware and routes.
  - Includes standard rate limit headers (`RateLimit-*`) in responses.
- **Security:** This initial global limit provides baseline protection. More specific limits can be applied to sensitive endpoints (like login, register, verify) later if needed.
- **Errors Encountered & Fixes:**
  - **Missing Types:** After installing `express-rate-limit`, TypeScript showed an error (`Cannot find module 'express-rate-limit' or its corresponding type declarations`).
    - **Fix:** Installed the necessary type definitions using `npm install --save-dev @types/express-rate-limit`.

### Phase 3.1: Advanced Hashing (Argon2id)

- **Goal:** Enhance password security by switching from bcrypt to Argon2id, which is more resistant to GPU cracking attempts.
- **Library:** Installed `argon2` (includes types).
- **Schema Changes (`prisma/schema.prisma`):**
  - Added `hashingAlgorithm: String @default("argon2")` to the `User` model to track the algorithm used for the `passwordHash`.
  - Applied changes using `prisma migrate dev --name add_hashing_algo`.
  - Regenerated Prisma Client (`npx prisma generate`) to update types.
- **Registration Flow Update (`src/services/auth.service.ts`):**
  - Modified `registerUser` to use `argon2.hash(password, { type: argon2.argon2id, ... })` instead of `bcrypt.hash()`.
  - Uses recommended parameters (`memoryCost`, `timeCost`, `parallelism`) for Argon2id. These can be tuned based on server resources and security requirements.
  - The new user record automatically gets `hashingAlgorithm` set to `'argon2'` (schema default).
- **Login Flow Update (`src/services/auth.service.ts`):**
  - Modified `loginUser` to implement progressive rehashing:
    - Retrieves the user and checks their `hashingAlgorithm`.
    - If `'argon2'`, uses `argon2.verify(user.passwordHash, password)`.
    - If not `'argon2'` (assumed bcrypt), uses `bcrypt.compare(user.passwordHash, password)`.
    - If `bcrypt.compare` succeeds:
      - Sets a `needsRehash` flag to `true`.
      - **After successful verification**, if `needsRehash` is true, it hashes the _provided_ password using `argon2.hash()`.
      - Updates the user's record with the new Argon2 hash and sets `hashingAlgorithm` to `'argon2'`.
      - Logs the rehash event or any errors during rehashing (errors don't prevent login).
    - Proceeds with JWT generation if verification (using either method) was successful.
- **Security:**
  - Argon2id provides stronger password hashing.
  - Progressive rehashing ensures older accounts are seamlessly upgraded to the more secure hashing algorithm upon their next successful login, without disrupting users.
- **Errors Encountered & Fixes:** None significant in this subphase beyond ensuring Prisma Client was regenerated after schema changes.
