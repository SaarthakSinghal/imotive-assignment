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

### Phase 3.2: Forgot/Reset Password Flow

- **Goal:** Allow users to securely reset their password if they forget it.
- **Schema Changes (`prisma/schema.prisma`):**
  - Added a `PasswordResetToken` model (`id`, `token` (unique), `expiresAt`, `userId` (relation to `User`), `createdAt`).
  - Added the `passwordResetTokens` relation field to the `User` model.
  - Applied changes using `prisma migrate dev --name add_password_reset`.
  - Regenerated Prisma Client (`npx prisma generate`).
- **Request Reset Endpoint (`POST /api/auth/forgot-password`):**
  - **Validation:** Uses `forgotPasswordSchema` to validate the email in the request body.
  - **Service (`requestPasswordReset`):**
    - Finds user by email.
    - **Security:** If user not found, logs internally and returns _without_ error to prevent email enumeration.
    - Generates a secure token (`crypto.randomBytes`).
    - Sets a 1-hour expiry for the token.
    - Uses a transaction to delete any old reset tokens for the user and create the new one.
    - Includes a `console.log` placeholder for the token (actual email sending deferred).
  - **Controller (`forgotPasswordHandler`):** Calls the service and _always_ returns a generic `200 OK` success message, regardless of whether the email existed or an internal error occurred during token generation (again, to prevent enumeration).
- **Reset Password Endpoint (`POST /api/auth/reset-password`):**
  - **Validation:** Uses `resetPasswordSchema` to validate the `token` and new `password` (min 8 chars) in the request body.
  - **Service (`resetPassword`):**
    - Finds the `PasswordResetToken` record by the provided token.
    - Checks if the token exists and has not expired.
    - If valid, hashes the new password using `argon2.hash()`.
    - Uses a transaction to:
      - Update the corresponding user's `passwordHash` and set `hashingAlgorithm` to `'argon2'`.
      - Delete the used `PasswordResetToken`.
    - Returns `true` on success, `false` otherwise.
  - **Controller (`resetPasswordHandler`):** Calls the service and returns `200 OK` on success, or `400 Bad Request` if the token was invalid/expired or the transaction failed.
- **Security:**
  - Uses secure, random, single-use tokens with a short expiry (1 hour).
  - Protects against email enumeration on the forgot password endpoint.
  - Uses transactions for atomic updates (password change + token deletion).
- **Errors Encountered & Fixes:** None significant in this subphase.

### Phase 4.1: MFA Enrollment (TOTP Setup)

- **Goal:** Allow users to enable Time-based One-Time Password (TOTP) using authenticator apps.
- **Library Correction:** Initially attempted to use `@node-rs/otp`, but this package does not exist on npm. Switched to the standard `speakeasy` library (`npm install speakeasy @types/speakeasy`). Also requires `qrcode` and `@types/qrcode`.
- **Configuration (`.env`, `src/config/index.ts`):**
  - Added `MFA_ENCRYPTION_KEY` environment variable (expected 32 bytes / 64 hex chars).
  - Updated config schema to validate the presence and minimum length of `MFA_ENCRYPTION_KEY`.
- **Schema Changes (`prisma/schema.prisma`):**
  - Added `mfaEnabled: Boolean @default(false)` to `User` model.
  - Added `mfaSecretEncrypted: String?` (nullable) to `User` model to store the encrypted secret.
  - Applied changes using `prisma migrate dev --name add_mfa_fields`.
  - Regenerated Prisma Client (`npx prisma generate`).
- **MFA Service (`src/services/mfa.service.ts`):**
  - Implemented helper functions `encryptMfaSecret` and `decryptMfaSecret` using Node.js `crypto` (AES-256-GCM).
  - Refactored `generateMfaSetup(userId, email)` function:
    - Uses `speakeasy.generateSecret({ name: ..., issuer: ... })` to create a new secret object.
    - Encrypts the **base32** encoded secret (`secret.base32`) for storage.
    - Updates the user record with `mfaSecretEncrypted`, ensuring `mfaEnabled` is `false`.
    - Returns the `otpauth_url` provided by `speakeasy` (e.g., `secret.otpauth_url`).
  - Refactored `verifyMfaSetup(userId, token)` function:
    - Retrieves and decrypts the user's stored **base32** secret.
    - Uses `speakeasy.totp.verify({ secret: decryptedBase32Secret, encoding: 'base32', token: ..., window: 1 })` to validate the token.
    - If valid, updates the user record setting `mfaEnabled = true`.
- **MFA Controller (`src/controllers/mfa.controller.ts`):**
  - No functional changes needed after switching to `speakeasy` (still generates QR from URL and verifies token).
  - Fixed handler return types by adding explicit `return;` after sending responses, resolving linter errors.
- **MFA Routes (`src/routes/mfa.routes.ts`):**
  - No functional changes needed.
  - Includes placeholder auth middleware injecting test user ID/email (**NOTE: Insecure**).
- **Errors Encountered & Fixes:**
  - **Incorrect Package:** Attempted to use non-existent `@node-rs/otp`. **Fix:** Switched to `speakeasy` based on user feedback.
  - **Self-Import:** Removed accidental self-import in `mfa.service.ts`.
  - **Express Handler Types:** Fixed return types in `mfa.controller.ts` handlers to satisfy TypeScript/Express expectations.

### Phase 4.2: MFA Verification During Login

- **Goal:** Require users with MFA enabled to provide a TOTP code after successful password login.
- **Login Flow Changes:**
  - **Service (`loginUser` in `auth.service.ts`):**
    - Modified to fetch `mfaEnabled` field for the user.
    - After successful password verification:
      - If `mfaEnabled` is `false`, generates and returns the final JWT in a `{ status: 'success', token: '...' }` payload.
      - If `mfaEnabled` is `true`, generates a **short-lived** (e.g., 5 min) "MFA pending" JWT. This JWT contains the `userId` and a `purpose: 'mfa-pending'` claim.
      - Returns `{ status: 'mfa_required', mfaToken: '...' }` payload, containing the MFA pending token.
    - Refactored background password rehashing to use `.then().catch()` to avoid blocking the MFA check.
  - **Controller (`loginHandler` in `auth.controller.ts`):**
    - Updated to check the `status` field returned by the `loginUser` service.
    - If `status` is `'success'`, returns the final JWT.
    - If `status` is `'mfa_required'`, returns the MFA pending token and the `mfa_required` status to the client, prompting them for the next step.
- **MFA Verification Endpoint (`POST /api/auth/login/mfa`):**
  - **Validation Schema (`verifyMfaLoginSchema` in `validators.ts`):** Added schema to validate `mfaToken` (string) and `totpCode` (6-digit string).
  - **Service (`verifyLoginMfa` in `mfa.service.ts`):**
    - Created function `verifyLoginMfa(userId, token)`.
    - Retrieves user, checks if MFA is enabled and secret exists.
    - Decrypts the stored base32 secret.
    - Uses `speakeasy.totp.verify()` to validate the provided `token` against the secret (allows 1-step window for time drift).
    - Returns `true` if valid, `false` otherwise.
  - **Controller (`mfaLoginHandler` in `auth.controller.ts`):**
    - Verifies the received `mfaToken` (short-lived JWT) using `jwt.verify()` and checks its `purpose` claim.
    - If valid, extracts the `userId`.
    - Calls `verifyLoginMfa(userId, totpCode)`.
    - If TOTP code is valid, generates the **final** JWT (same as non-MFA login).
    - Returns the final JWT (`200 OK`) or an appropriate error (`401 Unauthorized`).
  - **Route (`auth.routes.ts`):** Added route `POST /api/auth/login/mfa` pointing to `mfaLoginHandler`, applying the `verifyMfaLoginSchema` validation.
- **Security:**
  - Separates password verification from TOTP verification.
  - Uses a short-lived, single-purpose JWT (`mfaToken`) to link the two steps securely.
  - Final access token is only issued after _both_ password and TOTP are successfully verified.
- **Errors Encountered & Fixes:**
  - **Forward Reference:** Initially added the `/api/auth/login/mfa` route before its validation schema (`VerifyMfaLoginInput`) and controller handler (`mfaLoginHandler`) were created/exported, causing linter errors.
    - **Fix:** Created the schema and exported the handler before adding the route definition.

### Phase 4.3: Emergency Backup Code Handling

- **Goal:** Provide users with one-time backup codes to use if they lose access to their TOTP authenticator device.
- **Schema Changes (`prisma/schema.prisma`):**
  - Added a `BackupCode` model (`id`, `codeHash: String`, `used: Boolean @default(false)`, `userId` (relation to `User`), `createdAt`).
  - Added the `backupCodes` relation field to the `User` model.
  - Applied changes using `prisma migrate dev --name add_backup_codes`.
  - Regenerated Prisma Client (`npx prisma generate`).
- **MFA Setup Flow Changes (`src/services/mfa.service.ts`, `src/controllers/mfa.controller.ts`):**
  - **Service (`generateAndStoreBackupCodes`):**
    - Created a new function `generateAndStoreBackupCodes(userId, count = 10)`.
    - Generates `count` random, user-friendly backup codes (e.g., 8 digits).
    - **Hashes each code individually** using `bcrypt.hash()` before storing.
    - Uses a transaction to delete any old codes for the user and store the new hashed codes.
    - **Returns the plain text codes** immediately after generation (for the user to save).
  - **Service (`verifyMfaSetup`):**
    - Modified to call `generateAndStoreBackupCodes()` _after_ successfully verifying the TOTP token and enabling MFA (`mfaEnabled = true`).
    - Returns the generated plain text backup codes along with the success status.
  - **Controller (`verifyMfaSetupHandler`):**
    - Updated to include the `backupCodes` array in the successful JSON response to the client.
- **Backup Code Login Endpoint (`POST /api/auth/login/backup`):**
  - **Validation Schema (`verifyMfaBackupSchema` in `validators.ts`):** Added schema to validate `mfaToken` (string) and `backupCode` (string).
  - **Service (`verifyBackupCode` in `mfa.service.ts`):**
    - Created function `verifyBackupCode(userId, providedCode)`.
    - Fetches all _unused_ (`used: false`) `BackupCode` records for the `userId`.
    - Iterates through the stored hashed codes, using `bcrypt.compare(providedCode, storedHash)` to find a match.
    - If a match is found:
      - Uses a transaction to mark the specific `BackupCode` record as `used = true`.
      - Returns `true`.
    - If no match is found, returns `false`.
  - **Controller (`mfaLoginBackupHandler` in `auth.controller.ts`):**
    - Verifies the `mfaToken` (same process as `mfaLoginHandler`).
    - If valid, calls `verifyBackupCode(userId, backupCode)`.
    - If backup code is valid, generates the final JWT.
    - Returns the final JWT (`200 OK`) or an appropriate error (`401 Unauthorized`).
  - **Route (`auth.routes.ts`):** Added route `POST /api/auth/login/backup` pointing to `mfaLoginBackupHandler`, applying the `verifyMfaBackupSchema` validation.
- **Security:**
  - Backup codes are hashed using `bcrypt` before storage.
  - Codes are marked as used after successful login, preventing reuse.
  - Generation happens only during the verified MFA setup process.
- **Errors Encountered & Fixes:**
  - **Forward Reference:** Similar to Phase 4.2, route/schema/handler order needed correction.
  - **Express Handler Types:** Ensured `mfaLoginBackupHandler` explicitly returned `void` after responses.
  - **Typo:** Corrected a typo in the `verifyBackupCode` service logic where it wasn't returning `true` correctly after marking the code as used within the transaction.

### Phase 5.1: Secure Session Management

- **Goal:** Replace direct JWT return on login with server-side sessions stored in the database, enhancing security and enabling easier session invalidation.
- **Libraries Installed:**
  - `express-session`: Core session middleware.
  - `connect-pg-simple`: Session store adapter for PostgreSQL.
  - `pg`: PostgreSQL client library (required by `connect-pg-simple`).
  - `@types/express-session`, `@types/pg`, `@types/connect-pg-simple`: Type definitions (fixed missing types for `connect-pg-simple`).
- **Configuration:**
  - Added `SESSION_SECRET` to `.env` and validated it in `src/config/index.ts`.
  - Created `src/config/session.config.ts`:
    - Initialized `connect-pg-simple` using the `DATABASE_URL` and configured it to create/use a `user_sessions` table.
    - Defined `sessionOptions` with security best practices:
      - `store`: Use the PostgreSQL store.
      - `secret`: Use the `SESSION_SECRET` environment variable.
      - `resave: false`, `saveUninitialized: false`: Optimize session saving.
      - `cookie`: Set `maxAge` (e.g., 30 days), `httpOnly: true` (prevents client-side script access), `secure: true` (in production, requires HTTPS), `sameSite: 'lax'` (CSRF protection).
  - Applied the session middleware (`app.use(session(sessionOptions))`) in `src/index.ts` after rate limiting but before routes.
- **Login Flow Refactoring:**
  - **Services (`auth.service.ts`, `mfa.service.ts`):**
    - Modified `loginUser` (for non-MFA success), `verifyLoginMfa`, and `verifyBackupCode` to return the authenticated `userId` instead of generating/returning the final JWT.
    - The `mfa_required` flow in `loginUser` still returns the short-lived `mfaToken`.
  - **Controllers (`auth.controller.ts`):**
    - Added TypeScript type augmentation for `req.session.userId`.
    - Modified `loginHandler`, `mfaLoginHandler`, and `mfaLoginBackupHandler`:
      - Upon receiving a successful result (with `userId`) from the respective service, they now establish the session by setting `req.session.userId = verifiedUserId`.
      - They return a generic `{ status: 'success', message: 'Login successful' }` JSON response instead of a token.
- **Authentication Middleware:**
  - Created `src/middleware/auth.middleware.ts` with `ensureAuthenticated` function.
  - This middleware checks if `req.session.userId` exists.
  - If yes, calls `next()`.
  - If no, sends a `401 Unauthorized` response.
- **Route Protection:**
  - Applied `ensureAuthenticated` middleware to all routes in `src/routes/mfa.routes.ts`, replacing the insecure placeholder middleware.
- **Controller Updates (`mfa.controller.ts`):**
  - Removed placeholder functions for getting user details.
  - Updated `enableMfaSetupHandler` and `verifyMfaSetupHandler` to retrieve the authenticated user's ID directly from `req.session.userId` (guaranteed to exist by the `ensureAuthenticated` middleware).
  - Fetched the user's email from the database in `enableMfaSetupHandler` using the session `userId` to include it in the TOTP issuer name.
- **Security:** Session IDs are stored in secure, httpOnly cookies. Session data (containing `userId`) is stored server-side in the database, reducing exposure compared to storing JWTs in client-side storage. Allows for straightforward server-side session invalidation (logout).
- **Errors Encountered & Fixes (During Testing):**
  - **MFA Setup Error (`ERR_CRYPTO_INVALID_KEYLEN`):** The `POST /api/mfa/setup` endpoint failed due to an incorrect `MFA_ENCRYPTION_KEY` length.
    - **Cause:** The key stored in `.env` was either not exactly 64 hex characters long, or it contained invalid characters (like `<` and `>`). This resulted in `Buffer.from(key, "hex")` returning a buffer of incorrect length (e.g., 0 bytes) instead of the required 32 bytes for AES-256-GCM.
    - **Fix:** Ensured the `MFA_ENCRYPTION_KEY` in `.env` was a valid 64-character hex string and restarted the server.
  - **MFA Verify Error (`P2021: Table 'public.BackupCode' does not exist`):** The `POST /api/mfa/verify` endpoint failed because the `BackupCode` table was missing from the database.
    - **Cause:** Likely synchronization issues between `schema.prisma` (which defined the table) and the actual database state, potentially from an incomplete or failed migration earlier.
    - **Fix:** Ran `npx prisma db push --force` to align the database schema with `schema.prisma`, creating the missing table. Regenerated Prisma client (`npx prisma generate`) afterwards just in case.

### Phase 5.2: Logout Functionality

- **Goal:** Implement a secure endpoint for users to terminate their session.
- **Route:** Added `POST /api/auth/logout` to `auth.routes.ts`.
- **Middleware:** Protected the route using the existing `ensureAuthenticated` middleware.
- \*\*Handler (`logoutHandler` in `auth.controller.ts`):
  - Calls `req.session.destroy((err) => { ... })` to remove the session data from the PostgreSQL store.
  - Includes error handling/logging within the `destroy` callback.
  - Calls `res.clearCookie("connect.sid")` (using the default session cookie name) to instruct the client browser to remove the cookie.
  - Sends a `200 OK` JSON response `{"status":"success","message":"Logout successful"}`.
- **Testing:** Confirmed that after logging in, calling `POST /api/auth/logout` successfully terminates the session (subsequent requests to protected routes fail with 401) and clears the client cookie.

### Phase 5.3: CSRF Protection

- **Goal:** Protect against Cross-Site Request Forgery attacks by requiring a unique token for state-changing requests.
- **Library:** Installed `csurf` and `@types/csurf`.
- \*\*Middleware Setup (`src/index.ts`):
  - Imported and applied the `csurf()` middleware globally _after_ `express-session` and `express.json` but _before_ the application routes.
  - Added a specific error handling middleware to catch `csurf` errors (identified by `err.code === 'EBADCSRFTOKEN'`), log a warning, and return a `403 Forbidden` JSON response.
- \*\*Token Endpoint (`src/routes/auth.routes.ts`):
  - Added a `GET /api/auth/csrf-token` endpoint.
  - This endpoint calls `req.csrfToken()` to generate (or retrieve the existing) CSRF token associated with the current session.
  - It returns the token in a JSON response: `{"csrfToken": "..."}`.
  - Augmented the `express-session` `SessionData` interface in `auth.controller.ts` to include the optional `_csrf?: string` property used internally by `csurf`.
- **Client Requirement:** Clients (frontend/API tools) must now:
  1. First call `GET /api/auth/csrf-token` to retrieve the token.
  2. For any subsequent state-changing request (POST, PUT, DELETE, PATCH etc.), include the retrieved token in one of the places `csurf` checks (e.g., the `X-CSRF-Token` header).
  3. Ensure the session cookie (`connect.sid`) is sent correctly along with both the GET request for the token and the subsequent state-changing request.
- **Testing & Troubleshooting:**
  - Confirmed that attempting state-changing requests (like `POST /register`, `POST /login`, `POST /logout`) _without_ a valid CSRF token results in a `403 Forbidden` error.
  - Confirmed that fetching the token via `GET /api/auth/csrf-token` and then including it in the `X-CSRF-Token` header of a subsequent POST request allows the request to succeed.
  - Initial testing encountered `403 Forbidden` errors even when the token appeared correct. Troubleshooting revealed the issue was likely related to the API client not correctly sending the `connect.sid` session cookie along with the POST request after obtaining the CSRF token via the GET request. Ensuring proper cookie handling in the client resolved the issue.
