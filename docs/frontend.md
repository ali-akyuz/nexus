# NEXUS Frontend Architecture

## Overview
The frontend is built using Next.js 14 (App Router), React 18, Tailwind CSS, and shadcn/ui.
State management for API requests is handled by TanStack Query, while WebSocket connections are managed through `socket.io-client`.

## Directory Structure
- `src/app/(auth)`: Unauthenticated routes (`/login`, `/register`).
- `src/app/(dashboard)`: Protected routes requiring JWT authentication.
- `src/app/api`: Next.js Route Handlers acting as an API proxy.
- `src/components`: Reusable UI components.
- `src/hooks`: Custom React hooks (e.g., `useJobRealtime`).
- `src/lib`: Core abstractions (`api.ts`, `realtime.ts`).

## Real-time Strategy
The frontend connects to the NestJS WebSocket Gateway.
1. The `AuthProvider` acquires the `accessToken` and keeps it in React Context memory.
2. The `useJobRealtime(jobId)` hook connects the `socket.io-client` instance using the token.
3. The hook emits a `subscribeToJob` event, which places the socket in the `job:{jobId}` room.
4. The hook updates local React state (`status`, `progress`, `logs`) as events stream in.
5. `RealtimeJobCard.tsx` renders this state beautifully without ever polling the API.

## TanStack Query
We use TanStack Query strictly for Server State fetching (REST API).
- Caching: Default stale time of 60 seconds.
- Invalidation: When a job is created, we invalidate the `['jobs']` query.
- WebSockets update local component state, preserving TanStack Query caches for list views.
