# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 App Router project using TypeScript, Prisma, NextAuth, Tailwind CSS, and shadcn-style UI components.

- `app/`: route segments, pages, layouts, global CSS, and API routes in `app/api/**/route.ts`.
- `components/`: reusable React components. UI primitives live in `components/ui`, navigation in `components/navigation`, and feature widgets in folders such as `components/dashboard`.
- `lib/`: server helpers, data access, authorization, environment parsing, and integration logic.
- `prisma/`: Prisma schema, migrations, and `seed.ts`.
- `hooks/`, `types/`, `public/`: shared hooks, TypeScript declarations, and static assets.

## Build, Test, and Development Commands

- `npm run dev`: start the local Next.js dev server.
- `npm run build`: create a production build and run framework checks.
- `npm run start`: serve the production build.
- `npm run lint`: run ESLint with Next.js core-web-vitals and TypeScript rules.
- `npm run prisma:generate`: regenerate Prisma Client after schema changes.
- `npm run prisma:migrate`: create/apply local Prisma migrations.
- `npm run prisma:seed`: seed the configured database.

## Coding Style & Naming Conventions

Write TypeScript and React with 2-space indentation, named exports where practical, and focused modules. Use PascalCase for components, camelCase for functions and variables, and kebab-case for route folders and UI files, matching `components/ui/button.tsx`.

Prefer existing helpers such as `lib/utils.ts` and established component primitives before adding abstractions. Keep server-only logic in `lib/`, route handlers in `app/api`, and client interactivity behind explicit `"use client"` boundaries.

## Testing Guidelines

No test framework or `npm test` script is configured. Validate changes with `npm run lint` and `npm run build`; add focused manual checks for affected pages or API routes. If tests are introduced, colocate them near the code or under a clearly named test directory, use `*.test.ts` or `*.test.tsx`, and add the command to `package.json`.

## Commit & Pull Request Guidelines

Git history currently contains only the initial Create Next App commit, so use concise imperative commits such as `Add dashboard notice editor` or `Fix room search validation`.

Pull requests should include a short summary, linked issue or task when available, notes on migrations or environment variables, screenshots for UI changes, and validation commands run. Call out Prisma migration files added under `prisma/migrations`.

## Agent-Specific Instructions

Before editing Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`; this version has breaking changes from older conventions. Check local docs before using framework APIs.
