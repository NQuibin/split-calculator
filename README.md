# Ventura

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

The app is served from the domain root, so the dev URL is http://localhost:5173/.

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
| `pnpm lint` | Biome (format + lint) then ESLint (`react-hooks` only) |
| `pnpm lint:fix` | The same, applying safe fixes |
| `pnpm format` | `biome format --write .` |

## Deploying

Deployed to Vercel as a static site (Framework Preset **Vite**, output
directory `dist`) at `venturago.app`.

Two things make deep links work:

- **`vite.config.ts` uses the root base path.** Build output stays directly in
  `dist/`, matching URLs such as `/assets/…`.
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
