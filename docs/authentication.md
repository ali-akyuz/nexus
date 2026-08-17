# NEXUS Authentication Strategy

## Challenge
The NestJS backend returns `accessToken` and `refreshToken` via a JSON payload. Storing a refresh token in `localStorage` in the frontend is insecure and vulnerable to XSS attacks.

## Solution: Next.js API Proxy
To securely manage tokens, we use Next.js Route Handlers as a proxy layer.

### 1. Login Flow
1. User submits `/login` form.
2. Client sends POST to Next.js proxy `/api/auth/login`.
3. Next.js proxy forwards credentials to NestJS API `:3001/auth/login`.
4. NestJS returns JSON `{ accessToken, refreshToken }`.
5. Next.js proxy intercepts the JSON, creates `HttpOnly`, `Secure` cookies for both tokens, and responds `200 OK` to the frontend.

### 2. Standard API Requests
1. Frontend makes a request to Next.js proxy `/api/proxy/jobs`.
2. Next.js proxy reads the `HttpOnly` `accessToken` cookie.
3. Next.js proxy attaches `Authorization: Bearer <token>` and forwards to NestJS `:3001/jobs`.
4. Result is returned securely.

### 3. WebSockets
WebSockets cannot easily proxy through Next.js.
1. To authenticate the Socket.IO connection directly with NestJS, the client needs the `accessToken`.
2. The frontend calls `/api/auth/session` (Next.js proxy).
3. Next.js proxy reads the `accessToken` from the HttpOnly cookie and returns it to the client.
4. The `accessToken` is kept in React Context (memory) and passed to `socket.io-client`.
5. The `refreshToken` remains locked in the HttpOnly cookie, perfectly secure from XSS.
