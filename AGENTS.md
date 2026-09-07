# Stack

A client-rendered SPA: **Vite** + **TanStack Router** (file-based routes in
`src/routes/`) + **TanStack Query** (Convex subscriptions flow through its
cache via `@convex-dev/react-query`). There is no server and no SSR - the
app was migrated off Next.js, so ignore any Next-era instructions, and note
that `next/*` imports, Server Components, `"use client"`, and route handlers
no longer exist here.

Because it ships as static files, **any host serving this app must fall back
to `index.html` for unknown paths** - otherwise deep links like `/t/{slug}`
and `/e/{slug}` 404 on a hard load.

`pnpm dev` runs Vite; `pnpm build` typechecks (`pnpm typecheck`), renders the app
icons (`scripts/build-icons.tsx`, satori + resvg), then builds to `dist/`. The
typecheck runs first and gates the build, so a type error fails the deploy.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
