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

# Reusable components are preferred

**Before writing UI, search for an existing component that already does it.**
Check `src/components/ui/` first, then `src/components/`. Reach for a raw
element with a bespoke class string only after confirming nothing covers it.

Prefer extending an existing component (a new variant, an optional prop) over
creating a near-duplicate beside it. Two components that differ only in padding
or colour should be one component with a variant.

Extract a new shared component when **either** trigger fires:

- **Count** - the same markup-and-class pattern appears a **third** time.
- **Shape** - you are building an interactive control (button, input, toggle,
  menu item, chip) that `DESIGN.md` specifies a hover state, focus ring, or
  touch target for. Extract on the **first** use: the spec is the second caller,
  and a bespoke control is how those rules drift.

Otherwise, don't pre-abstract. Static layout or page-specific markup used once
belongs in the file that uses it - a local `function Row()` is the right answer
until a second caller exists. "This could be reused someday" is not a trigger;
duplication is cheaper to fix than a wrong abstraction, and a component built
for one caller grows a prop per caller after that.

When you do repeat a class string, that is a signal you skipped a component.

# Design

**Always read `DESIGN.md` before any UI/UX change.** It is the source of truth
for colour tokens, the type scale, button variants and their hover states,
spacing, mobile touch/viewport rules, and accessibility requirements. Its final
section lists verified deviations in the current code - fix the ones in files
you touch, and never add new instances.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->


# Agent Orchestration

Use subagents by default for substantial implementation work.

For any task that involves multiple files, multiple independent steps,
repository exploration plus implementation, or meaningful test work, the root
agent should first consider decomposition and delegate bounded work to
subagents.

Do not keep routine implementation on the root agent merely because the root
agent is capable of doing it. Prefer delegation when a task can be clearly
specified and completed independently.

Do not spawn subagents for trivial or tightly sequential work such as:
- a one-line or obvious localized edit
- committing or pushing already-completed changes
- simple formatting or renaming
- a small fix where delegation overhead would exceed the work itself

The root Astra agent owns:
- architecture
- planning
- decomposition
- ambiguous decisions
- integration
- final review

Delegate routine implementation to Luna.

Use Luna for:
- bounded implementation
- tests
- repo exploration
- mechanical refactors
- migrations
- documentation
- lint/type fixes
- repetitive changes

For tasks that touch 3 or more files, require substantial repository search, or
contain 2 or more independently implementable parts, prefer delegating at least
one bounded task to Luna unless there is a specific reason not to.

When independent work exists, prefer parallel Luna workers rather than
performing those tasks sequentially on the root agent.

When delegating Convex work, explicitly tell the worker to read
`convex/_generated/ai/guidelines.md` before making changes.

Before delegating, give the worker:
- a concrete objective
- relevant files
- constraints
- acceptance criteria
- tests to run

Parallelize independent Luna tasks where useful.

Escalate a worker from Luna to Terra when:
- substantial reasoning is required
- debugging crosses several abstractions
- Luna is uncertain about design
- Luna has failed twice
- implementation requires an important local design decision

Use another Astra worker only for genuinely difficult independent reasoning.

Protect root-agent context. Workers should return concise conclusions,
files changed, tests run, results, and remaining uncertainty.

The root Astra agent must review and integrate delegated work before declaring
the task complete.

Optimize for cost-adjusted correctness:

Astra plans  
→ Luna implements  
→ Terra handles difficult exceptions  
→ Astra reviews