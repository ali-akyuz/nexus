# @nexus/config

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 2+.

## Description

Shared configuration utilities for all Node.js services in the NEXUS monorepo.

Contains:

- Environment variable schemas and parsers (using Zod)
- Configuration factory functions
- Common configuration types

## Structure (planned)

```
packages/config/
├── src/
│   ├── env.ts             # Environment variable parsing and validation
│   ├── database.ts        # Database config schema
│   ├── redis.ts           # Redis config schema
│   ├── jwt.ts             # JWT config schema
│   └── index.ts
├── tsconfig.json
└── package.json
```

## Usage (planned)

```typescript
import { parseEnv, databaseConfig } from '@nexus/config';

const config = parseEnv(process.env);
const dbUrl = databaseConfig(config).url;
```
