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
