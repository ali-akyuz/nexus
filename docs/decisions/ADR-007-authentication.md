# ADR-007: Authentication and Refresh Token Strategy

## Status
Accepted

## Context
NEXUS requires a secure authentication strategy for users to interact with the API, submit jobs, and view results. We must protect against common vulnerabilities like XSS, CSRF, and token theft. The system uses JSON Web Tokens (JWT) for stateless authentication.

## Decisions

1. **Password Hashing:**
   - We will use **Argon2** (`argon2`) for hashing passwords and secrets. It is memory-hard and currently recommended over bcrypt by OWASP and NIST.

2. **Access Tokens:**
   - Short-lived JWTs (e.g., 15 minutes) signed with a strong secret.
   - Used for authenticating every API request.
   - Sent via the `Authorization: Bearer <token>` header.

3. **Refresh Tokens:**
   - Long-lived (e.g., 7 days) cryptographically random strings (32 bytes).
   - Used to obtain a new Access Token when it expires without requiring the user to log in again.
   - **Storage:** Only the SHA-256 hash of the refresh token is stored in the database. This prevents attackers from hijacking sessions in the event of a database leak.
   - **Token Rotation:** When a refresh token is used, it is revoked (marked in the database) and a new one is issued.
   - **Reuse Detection (Family Invalidation):** If a previously revoked refresh token is presented, we assume the token was stolen. The system immediately revokes **all** refresh tokens for that user to protect the account.

4. **Role-Based Access Control (RBAC):**
   - Implemented via a custom `@Roles()` decorator and `RolesGuard`.
   - The user's role (`USER`, `ADMIN`) is embedded in the Access Token payload.

## Consequences
- Requires users to re-login if their refresh token expires (max 7 days).
- Secure against DB leaks because passwords and refresh tokens are hashed.
- Token reuse detection proactively blocks active sessions if a token is intercepted.
- Slightly higher DB load because refreshing tokens requires database queries, but since this only happens every 15 minutes per active user, it is easily scalable.
