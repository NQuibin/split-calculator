# SumShare

Itemize any expense — restaurant, grocery, or service — and split it fairly.

A client-rendered SPA built with [Vite](https://vite.dev),
[TanStack Router](https://tanstack.com/router),
[TanStack Query](https://tanstack.com/query), and
[Convex](https://convex.dev) as the backend.

## Getting started

```bash
pnpm install
pnpm dev          # Vite dev server
npx convex dev    # Convex backend (separate terminal)
```

The app is served under a base path (`src/lib/basePath.ts`), so the dev URL is
http://localhost:5173/projects/split-calculator/.

Local email authentication still requires a password, but can skip OTP by
setting `AUTH_SKIP_OTP=true` on the **development Convex deployment**:

```bash
pnpm exec convex env set AUTH_SKIP_OTP true
```

The bypass also requires the backend's `SITE_URL` to use `localhost`,
`127.0.0.1`, or `[::1]`. It defaults off and is ignored for non-local site URLs.
Set `AUTH_SKIP_OTP=false` to test the full password-plus-OTP flow locally.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typechecks, renders app icons, builds to `dist/` |
| `pnpm typecheck` | `tsc --noEmit` — also runs first in `build`, so a type error fails the deploy |
| `pnpm preview` | Serves the production build locally |
| `pnpm icons` | Regenerates the PWA/Apple icons into `public/` |
| `pnpm lint` | ESLint |

## Deploying

Deployed to Vercel as a static site (Framework Preset **Vite**, output
directory `dist`), and reached through a rewrite from `nquibin.dev` that
forwards `/projects/split-calculator/*` with the prefix intact.

Two things make that work:

- **`vite.config.ts` nests the build under the base path**
  (`outDir: dist/projects/split-calculator`). Vite's `base` only rewrites the
  URLs inside `index.html`; it does not move the emitted files. Next's
  `basePath` did both, so without this the HTML would ask for
  `/projects/split-calculator/assets/…` while the files sat at `/assets/…`.
- **`vercel.json` provides the SPA fallback.** Vercel checks the filesystem
  before applying rewrites, so real assets are served directly and only
  unmatched app routes fall through to the shell. There are two entries
  because `:match*` does not match the bare, no-trailing-slash path — which
  is the PWA `start_url`.

Without the fallback, deep links such as `/t/{slug}` and `/e/{slug}` 404 on a
hard load.

Set **`VITE_CONVEX_URL`** in the Vercel project (Vite only exposes
`VITE_`-prefixed vars). Using `npx convex deploy --cmd 'pnpm build'` as the
build command injects it automatically and ships the backend at the same
time; it needs `CONVEX_DEPLOY_KEY`.

## Expense member references

Saved splits and payments reference `tabMembers._id` directly. Names and the
available roster are resolved when reading; adding a member never selects them
on an existing item. `roundingOrder` preserves rounding ties across migration.
Editor/results `stage` is UI state and is not stored on expense documents.

The production email OTP rollout can be held with `AUTH_REQUIRE_EMAIL_OTP=false`
until `RESEND_API_KEY` and a verified `AUTH_EMAIL` sender are configured. This
retains password authentication. Other deployments require password plus OTP,
subject to the explicitly enabled localhost development bypass above.
