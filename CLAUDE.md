# WatchLog — Claude Code Instructions

## What This App Does

WatchLog is a Japanese SHOWROOM live-streaming log tool. Users register a SHOWROOM room via invite code, then the app saves live stream logs (comments, gifts, rankings) and provides dashboards and replays. All times are JST. Most UI text is Japanese.

## Tech Stack

- **Next.js 16** App Router, React 19, TypeScript 5 (strict mode)
- **Prisma 7** with PostgreSQL — client generated to `app/generated/prisma` (non-standard path)
- **NextAuth v5 beta** — Google OAuth only, database sessions, 180-day max age
- **Tailwind CSS 4**, Radix UI primitives, shadcn-style components in `components/ui/`
- **Vitest 4** + Testing Library + jsdom

## Critical Non-Obvious Facts

- **Prisma Client is at `app/generated/prisma`**, not `@prisma/client`. Import from there.
- **Timezone is hardcoded to `Asia/Tokyo`** everywhere. Use `lib/jst.ts` helpers for date formatting. Never use `new Date().toLocaleString()` without explicit timezone.
- **Next.js docs are local**: read `node_modules/next/dist/docs/` before using any Next.js API — this version has breaking changes from older conventions.
- **Middleware is named `proxy.ts`, not `middleware.ts`**: Next.js 16 renamed Middleware to Proxy. The root-level `proxy.ts` exports `proxy` (wrapping `auth()`) and `config.matcher`, same conventions as the old Middleware API. Never create a `middleware.ts` file.
- **Images**: use `<img>` tags, not `next/image`.
- **No unauthorized destructive refactoring**: small change requests (add a field, fix a bug) must not trigger layout restructuring or component rewrites.

## Authorization Model

`lib/authz.ts` provides:
- `requireUser()` — throws `UnauthorizedError` if not logged in
- Fixed roles: `admin`, `premiumuser`, `user` (the last is assigned automatically on account creation)
- A finer-grained permission system backs role checks: `Role` → `RolePermission` → `Permission` tables. Admin API routes mostly use `requirePermission(action)` (e.g. `"role.assign"`), not plain role checks
- Ban status is checked in the root layout (redirects to `/banned`)
- Admin (`admin`) role cannot be assigned via API — routes reject it explicitly and require assigning it directly in the DB

Always call `requireUser()` (or `requirePermission()` for admin actions) at the top of API routes. Use `ForbiddenError` for permission violations. Log significant actions with `lib/audit.ts`.

## Key Patterns

**Server-first**: Server Components by default. Add `"use client"` only when you need browser APIs or event handlers.

**API routes** live in `app/api/**/route.ts`. Export named functions per HTTP method (`GET`, `POST`, etc.). Validate input at the boundary; trust `lib/` functions internally.

**Data access**: all DB queries go through Prisma singleton (`lib/prisma.ts`). Use transactions for multi-step writes. Request/response types live in `types/api/`; page-level prop/data types live in `types/pages/`. There is no separate domain-model type layer — `types/domain/` only holds a shared `JsonValue`/`JsonObject` type; domain models are imported directly from `app/generated/prisma` or defined alongside the `lib/` functions that own them.

**SHOWROOM integration**: REST wrappers in `lib/showroom/`, WebSocket parsing in `lib/showroom-realtime.ts`. Do not call SHOWROOM APIs directly from components or routes.

## Commands

```bash
npm run dev              # local dev server
npm run build            # production build (runs framework checks)
npm run lint             # ESLint (Next.js + TypeScript rules)
npm run test             # Vitest single run
npm run test:watch       # Vitest watch
npm run prisma:generate  # regenerate Prisma Client after schema changes
npm run prisma:migrate   # create/apply local migrations
npm run prisma:seed      # seed database
```

**Validation sequence before committing:** `npm run lint && npm run test && npm run build`

## Testing Conventions

- Test files colocated: `foo.ts` → `foo.test.ts`, `Bar.tsx` → `Bar.test.tsx`
- `test-utils/` contains Vitest mocks (Next.js Link, hls.js, etc.) — use them, don't recreate
- `vitest.setup.ts` polyfills jsdom gaps (ResizeObserver, scrollIntoView)
- Test environment gets `DATABASE_URL=postgresql://test:test@localhost:5432/test` automatically
- Do not mock the Prisma client in unit tests for route handlers — use real DB or integration patterns consistent with existing tests

## File Naming

- Route folders and UI component files: `kebab-case` (e.g., `components/ui/button.tsx`)
- React components: `PascalCase`
- Functions and variables: `camelCase`
- Imports use `@/` alias for the project root (e.g., `@/lib/utils`)

## Environment Variables

Required for local dev:
```
DATABASE_URL         # PostgreSQL connection string
AUTH_SECRET          # NextAuth signing secret
AUTH_GOOGLE_ID       # Google OAuth client ID
AUTH_GOOGLE_SECRET   # Google OAuth client secret
NEXTAUTH_URL         # e.g. http://localhost:3000
```
Optional: `LOG_LEVEL` (debug | info | warn | error). Logs write to `logs/YYYY-MM-DD.log` as JSON Lines.

## Commit Style

Concise imperative: `Add dashboard notice editor`, `Fix room search validation`, `Update invite code expiry logic`.

PR descriptions must note: Prisma migration files added, env var changes, and include validation commands run.
