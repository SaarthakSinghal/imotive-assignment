## Auth System

Robust authentication service with sessions, email verification, password resets, and MFA (TOTP + backup codes). Built with Express, TypeScript, and Prisma on PostgreSQL.

## Tech Stack

- **Language**: TypeScript (Node.js)
- **Framework**: Express 5
- **Database**: PostgreSQL (Prisma ORM)
- **Auth/session**: express-session + connect-pg-simple (DB-backed sessions)
- **Crypto**: argon2 (argon2id), bcrypt (for legacy/backup codes)
- **Validation**: Zod
- **Rate limiting**: express-rate-limit
- **2FA (TOTP)**: speakeasy, qrcode
- **CSRF**: csurf

## Features

- **Email/password auth** with Argon2id hashing and progressive rehash from bcrypt
- **Email verification** via single-use token before login is allowed
- **Password reset** with single-use token and one-hour expiry
- **MFA (TOTP)** enable/verify flow with AES-256-GCM encrypted TOTP secret
- **Backup codes** (hashed, single-use) for MFA recovery
- **Session-based auth** using secure, httpOnly cookies stored in PostgreSQL
- **CSRF protection** for state-changing requests
- **Global rate limiting** to reduce brute-force/abuse
- **Strong input validation** with clear error responses

## Project Tree Structure

```
auth-system/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/
│   │   ├── index.ts
│   │   └── session.config.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── mfa.controller.ts
│   ├── generated/
│   │   └── prisma/ ...
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── validate.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── mfa.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── mfa.service.ts
│   ├── utils/
│   │   └── validators.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Installation & Setup

1. Prerequisites

    - Node.js 18+
    - PostgreSQL (DATABASE_URL)

2. Install

```bash
npm install
```

3. Environment

    Create `.env` with:
    
    ```
    DATABASE_URL=postgres://user:pass@host:5432/db
    JWT_SECRET=change_me
    SESSION_SECRET=change_me
    MFA_ENCRYPTION_KEY=<64 hex chars (32 bytes)>  # required for AES-256-GCM
    PORT=3000
    ```
    
    Notes:
    
    - `MFA_ENCRYPTION_KEY` must be exactly 32 bytes (64 hex characters) or MFA setup will fail.

4. Database

    ```bash
    npx prisma migrate dev
    npx prisma generate
    ```

5. Run

    ```bash
    npm run dev   # development
    npm run build && npm start   # production
    ```
    
    Server runs at `http://localhost:3000` by default.


## Usage/Examples

This app uses cookie-based sessions and CSRF protection. Obtain a CSRF token, then include it in subsequent state-changing requests along with the session cookie.


#### 1) Get CSRF token

Using curl:

```bash
curl -i -c cookies.txt http://localhost:3000/api/auth/csrf-token
```

Using HTTP client:

```http
GET /api/auth/csrf-token
Content-Type: application/json
```

Response(200):

```http
Set-Cookie: connect.sid=...
Content-Type: application/json
```

```json
{
    "csrfToken": "<csrf-token>"
}
```

> [!NOTE]
> In subsequent requests,
> Use `<csrf-token>` as the `X-CSRF-Token` header
> Use value of `Set-Cookie` as `Cookie` header

#### 2) Register

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"email":"user@example.com","password":"Password123!"}' \
  http://localhost:3000/api/auth/register
```

Using HTTP client:

```http
POST /api/auth/register
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

Response(201 Created):

```json
{
  "status": "success",
  "message": "Registration successful. Please check your email to verify your account."
}
```

> [!NOTE]
> Email sending is not yet implemented. For now, the verification token is logged to the server console for testing.

#### 3) Verify email

Using curl:

```bash
curl -i http://localhost:3000/api/auth/verify/<verification-token>
```

Using HTTP client:

```http
GET /api/auth/register
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

Response(200 OK):

```json
{
  "status": "success",
  "message": "Email verified successfully."
}
```

#### 4) Login

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"email":"user@example.com","password":"Password123!"}' \
  http://localhost:3000/api/auth/login
```

Using HTTP client:

```http
POST /api/auth/login
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

Response(200 OK):

```json
{
  "status": "success",
  "message": "Login successful"
}
```

> [!NOTE]
> Returns "mfa_required" for users with MFA enabled.

#### 5) Enable MFA (after login). Step 1: generate QR

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "X-CSRF-Token: <csrf-token>" \
  -X POST http://localhost:3000/api/mfa/setup
```

Using HTTP client:

```http
POST /api/mfa/setup
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

Response(200 OK):

```json
{
  "status": "success",
  "data": {
    "qrCodeDataUrl": "data:image/png;base64,..."
  }
}
```

> [!NOTE]
> Scan the returned QR code with an authenticator app (e.g., Google Authenticator) to link your account.

#### 6) Verify MFA with TOTP (returns backup codes)

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"token":"<totp-code>"}' \
  http://localhost:3000/api/mfa/verify
```

Using HTTP client:

```http
POST /api/mfa/verify
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

```json
{
  "token": "<totp-code>"
}
```

Response(200 OK):

```json
{
  "status": "success",
  "message": "MFA enabled successfully. Save your backup codes!",
  "data": {
    "backupCodes": [ 10 backup codes ]
  }
}
```

#### 7a) Login with MFA: verify TOTP using the temporary mfaToken

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"mfaToken":"<mfaToken>","totpCode":"<totp-code>"}' \
  http://localhost:3000/api/auth/login/mfa
```

Using HTTP client:

```http
POST /api/auth/login/mfa
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

```json
{
  "mfaToken": "<mfaToken>",
  "totpCode": "<totp-code>"
}
```

Response(200 OK):

```json
{
  "status": "success",
  "message": "Login successful"
}
```

> [!NOTE]
> The `mfaToken` is returned in the response of `/api/auth/login` when MFA is enabled.

#### 7b) Login with backup code

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"mfaToken":"<mfaToken>","backupCode":"<backup-code>"}' \
  http://localhost:3000/api/auth/login/backup
```

Using HTTP client:

```http
POST /api/auth/login/backup
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

```json
{
  "mfaToken": "<mfaToken>",
  "backupCode": "<backup-code>"
}
```

Response(200 OK):

```json
{
  "status": "success",
  "message": "Login successful"
}
```

> [!NOTE]
> The `mfaToken` is returned in the response of `/api/auth/login` when MFA is enabled.

#### 8) Logout

Using curl:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -H "X-CSRF-Token: <csrf-token>" \
  -X POST http://localhost:3000/api/auth/logout
```

Using HTTP client:

```http
POST /api/auth/logout
Content-Type: application/json
X-CSRF-Token: <csrf-token>
Cookie: connect.sid=<session-cookie>
```

Response(200 OK):

```json
{
  "status": "success",
  "message": "Logout successful"
}
```

> [!NOTE]
> For testing purposes, the server logs the `userID` and the `sessionID` when the user logs out.


## API Routes / Endpoints

Base URL: `http://localhost:3000`

- `GET /api/auth/csrf-token` – get CSRF token
- `POST /api/auth/register` – body: `{ email, password }`
- `GET /api/auth/verify/:token` – verify email
- `POST /api/auth/login` – body: `{ email, password }`
- `POST /api/auth/login/mfa` – body: `{ mfaToken, totpCode }`
- `POST /api/auth/login/backup` – body: `{ mfaToken, backupCode }`
- `POST /api/auth/forgot-password` – body: `{ email }` (always returns 200)
- `POST /api/auth/reset-password` – body: `{ token, password }`
- `POST /api/auth/logout` – requires authenticated session

MFA (requires authenticated session):

- `POST /api/mfa/setup` – returns QR code data URL
- `POST /api/mfa/verify` – body: `{ token }`, returns backup codes

## Security Measures / Best Practices Followed

- **Argon2id password hashing**; progressive rehash from bcrypt on successful login
- **Single-use, expiring tokens** for email verification and password reset
- **Sessions in DB** with `connect-pg-simple`; cookies set `httpOnly`, `sameSite=lax`, `secure` in production
- **CSRF protection** via `csurf` and a dedicated token endpoint
- **Encrypted MFA secret** at rest using AES-256-GCM with a 32-byte key
- **Backup codes hashed** (bcrypt) and marked used after successful login
- **Input validation** everywhere using Zod and a shared `validate` middleware
- **Rate limiting** applied globally
- **Transactional operations** for critical multi-step DB changes
- **Email enumeration protection** on password reset request

## Known Issues / Limitations

- Email sending is currently a placeholder (tokens are logged/returned for testing).
- Time synchronization matters for TOTP; allow small window but clients should keep clocks accurate.
- No endpoints yet to disable MFA or rotate backup codes.
- Ensure `MFA_ENCRYPTION_KEY` is valid (64 hex chars) or MFA setup will fail.

## Contributing

PRs are welcome. Please keep code typed, validated at boundaries, and add tests where reasonable.

## License

ISC
