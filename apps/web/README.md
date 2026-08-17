# NEXUS Web Application

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 2+.

## Description

Next.js 14 (App Router) frontend for NEXUS.

**Technology:**

- Next.js 14
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui
- TanStack Query (React Query)
- Recharts
- Socket.IO client

## Structure (planned)

```
apps/web/
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── (auth)/        # Auth route group
│   │   ├── (dashboard)/   # Dashboard route group
│   │   └── admin/         # Admin pages
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks (useJobStatus, useWebSocket, etc.)
│   ├── lib/               # Utilities (api client, formatters, validators)
│   ├── stores/            # Client state (Zustand or React context)
│   └── types/             # Frontend-specific types
├── public/                # Static assets
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```
