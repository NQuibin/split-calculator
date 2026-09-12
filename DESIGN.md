# SumShare Design System

The single source of truth for UI/UX in this app. Read this before writing or
changing any component, page, or Tailwind class string.

**Rules of engagement**

- **Reach for an existing component before writing markup.** Search
  `src/components/ui/` then `src/components/`. A bespoke `<button>`/`<input>`
  with a hand-written class string is the last resort, not the default — see
  § 5 for the canonical set and `AGENTS.md` for the extraction threshold.
- **Extend, don't fork.** If a component is close but not exact, add a variant
  or a prop to it. Do not copy it into a second component that differs only in
  padding, radius, or colour — that is how § 8's eleven primary buttons happened.
- Use the tokens and components defined here. Do not invent a new colour, font
  size, radius, or hover treatment for a one-off.
- If a need genuinely isn't covered, add it to this file in the same change
  that introduces it — don't leave the new pattern undocumented.
- The app is **light-theme only**. There is no dark mode. `dark:` utilities are
  pinned to a `.dark` ancestor that is never applied (`src/globals.css:20`), so
  they are dead code — don't add more.
- § Known deviations at the end lists places the codebase does not yet match
  this spec. When you touch one of those files, fix the deviation.

---

## 1. Colour

All colours are CSS variables in `src/globals.css` and exposed as Tailwind
utilities via `@theme inline`. **Never write a hex literal in a `className`.**

### Palette

| Token           | Value     | Tailwind            | Use for                                                     |
| --------------- | --------- | ------------------- | ----------------------------------------------------------- |
| `--paper`       | `#edf1e4` | `bg-paper`          | App background (`body`), recessed fills, hover wash on light |
| `--surface`     | `#f7f5ec` | `bg-surface`        | Raised surfaces: cards, sidebar, dialogs, popovers           |
| `--ink`         | `#1e2a22` | `text-ink`          | Primary text                                                 |
| `--ink-soft`    | `#4b5a4f` | `text-ink-soft`     | Secondary text, captions, inactive nav                       |
| `--forest`      | `#2f4a3c` | `bg/text-forest`    | Primary action, links, focus ring, active state              |
| `--ledger-green`| `#276b46` | `text-ledger-green` | **Money only** — positive balances. Never chrome.             |
| `--margin-red`  | `#c1432b` | `bg/border-margin-red` | Destructive **fills**, borders, icons                        |
| `--margin-red-ink` | `#b23c26` | `text-margin-red-ink` | Destructive and error **text**                            |
| `--brass`       | `#b8933a` | `text-brass`        | **Decoration only** — see the contrast warning below          |
| `--rule`        | `#ccd5bd` | `border-rule`       | Borders, dividers, input outlines                             |
| `--wash`        | `#e9dfc5` | `bg-wash`           | Hover/active wash — **warm**, against sage resting grounds      |
| `--band`        | `#d6ddc9` | `bg-band`           | A structural band in a card — a table header, a totals footer   |
| `--brass-ink`   | `#7a611f` | `text-brass-ink`    | Brass where it must be **readable** — the wordmark, brass text  |
| `--edge`        | `#788576` | `border-edge`       | The boundary of a floating surface **or a form field**          |
| `--field`       | `#fffdf6` | `bg-field`          | The **inset** ground — input wells *and* data tables            |

Semantic shadcn tokens (`--primary`, `--muted`, `--destructive`, …) are remapped
onto this palette, so shadcn-derived components inherit it automatically. Prefer
the app tokens (`bg-forest`) in app code and the semantic tokens
(`bg-primary`) inside `src/components/ui/`.

### Contrast (WCAG 2.1 AA)

Measured against the two app grounds:

| Foreground     | on `--paper` | on `--surface` | Verdict                          |
| -------------- | ------------ | -------------- | -------------------------------- |
| `--ink`        | 12.99        | 13.64          | ✅ AAA                            |
| `--forest`     | 8.45         | 8.88           | ✅ AAA                            |
| `--ink-soft`   | 6.37         | 6.69           | ✅ AA                             |
| `--ledger-green`| 5.58        | 5.87           | ✅ AA                             |
| `--margin-red` | **4.46**     | 4.68           | ⚠️ fails AA on `--paper`          |
| `--brass`      | **2.52**     | **2.64**       | ❌ fails AA text *and* 3:1 non-text |

Consequences that are binding:

- **Red text is `--margin-red-ink`; red fills are `--margin-red`.**
  `--margin-red` is 4.46:1 on `--paper` and 3.86:1 on `--wash` — under AA in
  both, so it can fill or outline a shape but must never be the colour of
  words. `--margin-red-ink` clears 4.5:1 on every ground a red label lands on
  (`--paper` 5.13, `--surface` 5.39, `--wash` 4.44, `--field` 5.78).
- **`--brass` may never carry meaning.** It is decorative only — a small icon
  sitting beside its own label. The moment brass has to be *read*, use
  `--brass-ink` (5.2:1 on `--paper`, 5.4:1 on `--surface`). The wordmark and
  any brass text use `--brass-ink`; an active state never signals with brass
  alone.
- `--rule` (1.32:1) is a divider, not a focusable-control border. Any border
  that communicates state (input focus, selected card) must be `--forest`.
- **`--field` is the inset ground, not just "input".** It is for anything
  nested inside a `--surface` card that has to lift off it — an input well or
  a data table. What makes an input an input is its `--edge` border and focus
  ring, not its fill.
- **A form field is `bg-field` with a `border-edge`.** Fields used to be
  `--paper` — the page's own colour — which is **1.00:1** on a page and 1.05:1
  inside a card, so the fill did nothing anywhere. Going lighter can't fix
  that: white is only 1.15:1 on `--paper`, because this palette already sits
  near the top of the lightness range. So the two do different jobs — the
  `--edge` border (3.4:1) is what makes a field *identifiable* and satisfies
  WCAG 1.4.11, and the neutral near-white `--field` is what makes it *look*
  like something you type into, reading against sage-tinted grounds by hue
  rather than by luminance. Both, or neither works.
- **A floating surface needs `--edge`, not `--rule`.** `--surface` on
  `--paper` is 1.05:1, so a popover has no fill difference at all and its
  border is the only thing separating it from the page — `--rule` gave that
  border just 1.32:1 and the panel disappeared. `--edge` clears 3:1 against
  both the page and the panel's own fill. `--rule` stays for dividers *within*
  a surface; `--edge` is only for one surface floating above another.
- **A hover state must be `--wash`, never `--paper`.** `--paper` against a
  `--surface` row is 1.05:1 — a state change nobody can see. The shadcn
  `--accent` token points at `--wash`, so `hover:bg-accent` inside `ui/` and
  `hover:bg-wash` in app code are the same colour.
- **`--wash` is deliberately warm.** Every resting ground here is sage, so a
  sage hover only reads as "slightly darker paper" and would need a big
  luminance step to register at all. Shifting *hue* instead lets a modest step
  (1.16:1 off the page, 1.20:1 off a row) read immediately as a state. If you
  ever retune it, keep it out of the green family — that is the whole point of
  the colour, not an accident.
- White text on `--forest` is fine (9.70) but `text-surface` is the house
  style — use `text-surface`, not `text-white`.

---

## 2. Typography

Three families, declared in `src/globals.css` and loaded from `@fontsource` in
`src/main.tsx`:

| Class          | Family         | Use for                                        |
| -------------- | -------------- | ---------------------------------------------- |
| *(default)*    | IBM Plex Sans  | All body text, labels, buttons                  |
| `.font-display`| Space Grotesk  | Page titles, section headings, dialog titles, tab labels, brand |
| `.font-numeric`| IBM Plex Mono  | **Every currency amount and quantity.** Carries `tabular-nums`. |

Any number a user compares down a column — totals, per-person shares, rates,
item costs — must be `.font-numeric`, or the columns won't line up.

### Type scale

Body text in this app is **14px (`text-sm`)**. That is deliberate and is the
default for prose, labels, list rows, and buttons. Use only these steps:

| Role                    | Classes                                                     | px  |
| ----------------------- | ----------------------------------------------------------- | --- |
| Page title              | `font-display text-3xl font-semibold tracking-tight`        | 30  |
| Page title (hero pages) | add `sm:text-4xl`                                           | 36  |
| Amount, hero            | `font-numeric text-3xl font-semibold`                       | 30  |
| Subtitle / entity name  | `font-display text-2xl font-semibold`                       | 24  |
| Section & dialog title  | `font-display text-lg font-semibold`                        | 18  |
| Body, buttons, inputs   | `text-sm`                                                   | 14  |
| Group heading           | `GroupTitle` — `text-sm font-semibold text-ink`              | 14  |
| Field label             | `Label` — `text-sm font-medium text-ink`                     | 14  |
| Meta, captions, badges  | `text-xs text-ink-soft`                                     | 12  |

**Use the components, not the class strings**: `PageTitle`, `PageDescription`,
`SectionTitle`, `GroupTitle` (`ui/Typography.tsx`) and `Label`
(`ui/Input.tsx`). `SectionTitle` and `GroupTitle` take `as` so the document
outline stays correct wherever they sit.

The rule separating the two 14px steps: a **heading** labels a block of content
and is `font-semibold`; a **field label** names one control, is `font-medium`,
and renders a real `<label>`.

Rules:

- **12px is the floor for any text a user reads.** Arbitrary values
  (`text-[10px]`, `text-[0.8rem]`) are not allowed in app code; the only
  exemption is glyph-like content inside a fixed-size shape (avatar initials).
- **Weights: `font-medium` or `font-semibold` only.** No `font-bold`, no
  `font-light`. `font-normal` only to *undo* an inherited weight.
- Never use `!` to force a size (`text-3xl!`). If a component fights you,
  fix the component.
- Long user-supplied strings (tab names, expense titles, member names) need
  `break-words` and a `min-w-0` flex parent.

---

## 3. Spacing, radius, motion

**Spacing** — Tailwind's 4px scale. Prefer `gap-*` on a flex/grid parent over
margins on children. The house steps are `1`, `1.5`, `2`, `3`, `4`, `5`, `6`.
Don't reach for `gap-7`/`gap-9` etc.

**Radius** — driven by `--radius: 0.5rem`:

| Class          | Use for                                                |
| -------------- | ------------------------------------------------------ |
| `rounded-md`   | Inputs, textareas, small controls, list rows            |
| `rounded-lg`   | Buttons, cards, nav-adjacent surfaces                   |
| `rounded-xl`   | Dialogs, sidebar nav items, large panels                |
| `rounded-full` | Avatars, person chips, pills                            |

Pick by element type, not by taste — a button is `rounded-lg` everywhere.

**Elevation** — this is a flat, paper-textured design, so shadows are reserved
for surfaces that genuinely float above the page:

| Surface                        | Treatment                          |
| ------------------------------ | ---------------------------------- |
| Form field, picker trigger     | `border-edge` + `bg-field` — no shadow |
| Data table / row list in a card | `border-edge` + `bg-field`, header row `bg-paper` |
| Card, panel, list container    | `border-rule` — no shadow           |
| Popover, dropdown, menu        | `border-edge` + `shadow-lg`         |
| Dialog                         | `border-rule/70` + `shadow-xl`, over a `bg-ink/40` backdrop |

Everything else separates with `border-rule` and the `--paper` / `--surface`
step, never with a shadow. A dialog can get away with a soft border because
its backdrop already separates it; a popover has no backdrop, so it needs both
the edge and the shadow. `PopoverContent` carries this — don't re-declare
`border-*`/`bg-*` on individual popovers.

**Icon motion must use `transform`, never `translate`/`rotate`.** The modern
individual transform properties are a **no-op on SVG elements**, and every icon
here is an SVG. Tailwind's `translate-*` and `rotate-*` utilities compile to
those properties, so `group-hover:translate-x-0.5` on an icon sets the
`--tw-translate-*` variables and then moves nothing — which is exactly what
every chevron in this app did, silently, until it was fixed. Use the
`.chevron-x` / `.chevron-y` / `.chevron-flip` classes in `globals.css` (put
`group` on the hoverable ancestor); they use `transform`.

Two verification traps if you ever re-check this: `getComputedStyle(svg).transform`
reports `matrix(1,0,0,1,0,0)` even while the icon is visibly offset — measure
`getBoundingClientRect()` instead; and reading computed style right after a
change returns the mid-transition value, so settle past the duration first.

**Motion** — `transition` (all properties, default duration) is the house
default; `transition-transform duration-200 ease-in-out` for the mobile drawer.
`prefers-reduced-motion: reduce` is handled globally in `src/globals.css:168` —
don't re-implement it per component.

**Receipt motifs** — `.perforated-top` is the dashed tear line between an item
list and its total. Use it for that, nothing else.

---

## 4. Layout

### Page shell

Every route renders exactly one `<Page>` (`ui/Page.tsx`). Never hand-write a
`<main>` or copy a `pageClass` constant.

```tsx
<Page>…</Page>                      {/* max-w-5xl — the default */}
<Page width="wide">…</Page>         {/* max-w-7xl — only the tab's expense grid */}
<Page width="narrow" center>…</Page> {/* a centred single-purpose state */}
```

`Page` owns the horizontal padding, the max width, the bottom safe-area inset
and `id="main"` (the skip link's target). Loading and error states render the
*same* `<Page>` so the layout doesn't jump:

```tsx
if (data === undefined)
  return <Page><p role="status" className="text-sm text-ink-soft">Loading…</p></Page>;
```

Inside a page: `<Panel>` is a raised surface (card, list container, settings
group), and `<EmptyState>` is the dashed placeholder for loading / signed-out /
nothing-here-yet. `<Breadcrumb>` (`ui/Breadcrumb.tsx`) renders the trail and
inserts its own separators — pages pass only the crumbs.

### App chrome

`src/routes/__root.tsx` is a `flex min-h-full flex-col md:flex-row`: sidebar,
then a column holding the route outlet and `Footer`. The sidebar hides itself on
`/s` routes (public share links get no owner chrome).

Breakpoints: the app uses **`md` (768px) as the desktop boundary** for layout
(sidebar, two-column forms), and `sm` (640px) for content reflow within a
column. Don't introduce `lg`/`xl` layout switches.

---

## 5. Components

### Buttons

`src/components/ui/Button.tsx` is the canonical button. Import it; do not
hand-roll a `<button>` with a class string. The variants and their exact hover
states:

| Variant       | Rest                                       | Hover                | Use for                                   |
| ------------- | ------------------------------------------ | -------------------- | ----------------------------------------- |
| `default`     | `bg-primary text-primary-foreground`       | `bg-primary/80`      | The one primary action in a region         |
| `outline`     | bordered, `bg-background`                  | `bg-accent`          | Any other **labelled** action              |
| `destructive` | bordered, `bg-destructive/10`, red text    | `bg-destructive/20`  | Delete, remove, discard — labelled         |
| `ghost`       | transparent, no border                     | `bg-accent`          | **Icon-only** buttons and row actions      |
| `link`        | `text-primary`                             | `underline`          | Inline text actions inside content flow    |
| `field`       | `border-rule bg-paper`, normal weight      | border → `--forest`  | A trigger that stands in for a form control |
| `secondary`   | `bg-secondary`                             | `bg-accent`          | Rare: a filled action beside a `default`   |

**Picking one is mechanical — work down this list:**

1. Does it delete, remove or discard? → `destructive`.
2. Is it the single most important action in this screen or dialog? → `default`.
3. Is it icon-only? → `ghost`.
4. Does it sit inline inside a paragraph or a content block ("Add item",
   "Copy invite")? → `link`.
5. Is it a popover trigger that *reads as a form control* — the currency,
   date or tab picker? → `field`.
6. Otherwise → `outline`.

Two rules that follow from this, and are the ones that actually get broken:

- **A labelled button never uses `ghost`.** `ghost` has no border, so beside a
  bordered neighbour it looks like a different kind of control at rest and
  then grows a filled background on hover. Cancel, Done, Close and friends are
  `outline`.
- **`destructive` is bordered, exactly like `outline`.** A delete sitting in a
  row with other buttons must share their geometry; the red tint is what marks
  it, not a missing edge. Never hand-roll a delete as `ghost` + red text — on
  hover that puts red text on the green `--wash` and the two colours fight.

A dialog is its own region, so it gets its own `default` button.

**Dismiss is not destructive.** A close or cancel control hovers to `--ink`,
never to `--margin-red`; red is reserved for actions that actually destroy
something.

**`field` vs `outline` is the action/control distinction.** An *action*
(`outline`) fills with `--accent` on hover and keeps its border. A *control*
(`field`) never fills — its border darkens to `--forest`, the same signal
`fieldClass` gives on focus — because it stands in for an input and should
read like one. Never mix the two: an `outline` action that also darkens its
border is wearing a control's clothes, and an action never needs two hover
signals.

**Never hand-write a hover on a `Button`.** If you find yourself adding
`hover:border-*` or `hover:text-*` to a Button's className, you've picked the
wrong variant — or you need a new one, which goes in this table.

Sizes:

| Size          | Height | Use for                                                      |
| ------------- | ------ | ------------------------------------------------------------ |
| `xs`          | 24px   | Dense inline actions inside a row                             |
| `sm`          | 28px   | Compact chrome (sidebar footer, toolbars)                     |
| `default`     | 32px   | Desktop-density actions                                       |
| `lg`          | 36px   | Form submits inside a dialog or narrow panel                  |
| `touch`       | 44px   | **Any action a user taps on a phone** — the mobile default    |
| `hero`        | 48px   | The one prominent CTA on a screen; carries `font-display`     |
| `icon-*`      | —      | Square icon-only equivalents, incl. `icon-touch` (44px)       |

`xs` through `lg` are desktop-density and all fall below the 44px minimum in
§ 6. On a touch-reachable surface use `touch` / `icon-touch` / `hero`.

Binding rules:

- One `default`-variant button per screen region. Everything else is
  `secondary`, `outline`, or `ghost`.
- A destructive action is `destructive` variant *and* lives behind a
  confirmation dialog.
- Hover is **always** a background change from the table above. Never
  `hover:bg-ink` (a near-black flip on a sage palette), never an off-palette
  hex, never a bare colour change on a filled button.
- An icon-only button needs `aria-label`.
- A pending button keeps its label and gets `disabled` + `aria-busy`; text
  swaps to a gerund ("Saving…") — it does not become a spinner-only control.

### Inputs

Use `Input`, `Textarea`, `Select`, `Label` and `FieldError` from `ui/Input.tsx`. They
carry the canonical `fieldClass`; don't hand-roll a bordered field.

`Select` is the native single-choice field for short lists such as an expense's
payer. It shares the input ground, border, focus ring, and mobile type size.

- Ground is `bg-field` with a `border-edge`, on any page or card — a field
  looks the same everywhere rather than depending on what's behind it.
- Focus is **`--forest`**, matching the rest of the app — see § 7. Forest is
  darker than `--edge`, so focus still reads as a change.
- `min-h-11` so it is touchable, and **`text-base` below `sm`** so iOS doesn't
  zoom on focus (§ 6). The primitive handles both — never re-add a
  `[&_input]:text-base` wrapper.
- Numeric inputs add `font-numeric` plus `inputMode="decimal"` and `step`.
- Every input has a visible `<label>` (`text-sm font-medium text-ink`, `mb-2`)
  or, where the layout can't carry one, an `aria-label`. Placeholder is never
  the only label.
- Error state: `aria-invalid` on the control, message in `text-xs
  text-margin-red` wired with `aria-describedby`, and `role="alert"`.

### Dialogs

Use `src/components/ui/Dialog.tsx`. It already supplies the backdrop, scrolling
viewport, `max-w-lg` popup, `rounded-xl border-rule/70 bg-surface`, and
`font-display text-lg font-semibold` title.

- Always render a `DialogTitle`, even when visually redundant — it is the
  accessible name.
- Footer: actions right-aligned, `flex justify-end gap-3`, cancel as `outline`
  to the left of the confirm.
- Destructive confirmations state what will be lost and use the item's name.

### Navigation

Sidebar items: `rounded-xl px-4 py-3.5 text-sm`, active = `bg-rule/30
font-semibold text-forest`, inactive = `text-ink-soft hover:bg-rule/20`, with
`aria-current="page"` on the active link. The active icon must not rely on
`--brass` alone (§ 1).

Tabs (`ExpenseViewTabs`, breakdown currency tabs): `border-b-2 border-transparent
px-4 py-3 font-display text-sm font-medium text-ink-soft`, active =
`data-active:border-forest data-active:text-forest`. The list scrolls with
`overflow-x-auto` and keeps its `aria-label`.

### Interactive rows

A list row that both navigates *and* carries its own actions cannot be a
`<button>` or `<Link>` wrapping everything — **an interactive element may not
nest inside another one.** A `⋯` inside a row-link is invalid HTML, and a
keyboard or screen-reader user cannot reach it.

The shape, as used by `ExpenseLineItem` and the tab expense grid:

```tsx
<li className="relative grid …">
  {/* the trigger, stretched over the row by its own ::after overlay */}
  <Link className="min-w-0 after:absolute after:inset-0 after:content-['']
                   focus-visible:outline-none
                   focus-visible:after:outline-2 focus-visible:after:outline-forest" />
  …non-interactive cells…
  <div className="relative z-10 …"><OverflowMenu>…</OverflowMenu></div>
</li>
```

- The overlay keeps the **whole row** tappable, which is what a phone needs.
- `relative z-10` lifts the menu above the overlay so it receives its own
  clicks. Verify this: a click at the menu's centre must hit the menu, not the
  row link.
- Focus styling goes on the overlay (`focus-visible:after:outline-*`), so the
  ring frames the row rather than just the text.
- The row hover moves to the `<li>` (`hover:bg-wash`), since the link no longer
  covers it.
- Give the menu cell an explicit `col-start`/`row-start`. Auto-placement drops
  it into whatever cell is free and the row falls apart.
- Every row menu needs a **distinguishing** label — `Actions for {name}`, not
  "More actions". A list of identical "More actions" buttons is unusable by
  voice or screen reader.
- The `⋯` trigger is **vertical** (`MoreVertical`), `ghost`, and hovers by
  **scaling**, not by filling. A wash behind the button inside a row that is
  itself washing on hover reads as two overlapping states; a scale reads
  cleanly against either. It's wrapped in `motion-safe:`, so reduced-motion
  users get the colour shift without the movement, and `aria-expanded` still
  takes a background because "open" is a persistent state rather than a
  pointer hint.

**A row with no actions stays a plain link.** The `/tabs` and `/expenses`
directory rows are one `<Link>` wrapping the whole row — no overlay, no actions
track. Reach for the pattern above only when a row genuinely needs its own
actions; it exists to make a nested button legal, not because it is the better
row.

### Data tables and banded cards

Anything with a **header / body / footer** structure — the spend-summary table,
the tab's expense list, a breakdown member card — uses one banding scheme. Left
alone, every band inherits the card and the whole thing reads as one flat
rectangle (the body was literally 1.00:1 against the card).

| Band                          | Ground                  | Step vs. its neighbour |
| ----------------------------- | ----------------------- | ---------------------- |
| Header (column names)         | `bg-band`               | 1.37:1 vs body         |
| Body (the rows)               | `bg-field`              | 1.085:1 vs the card    |
| Footer (totals, summary)      | `bg-band`               | 1.37:1 vs body         |

**A band is `--band`, never `--paper`.** `--paper` *is* the page, so a footer
at the bottom edge of a card reads as a hole punched through to the page
behind it — and even mid-card it's only 1.04:1 against the card. `--band`
clears a step against all three grounds it can touch: the page (1.22:1), a
card (1.26:1) and a `--field` body (1.37:1).

**`--band` is sage; `--wash` is warm.** That's deliberate: a static structural
band must never be mistakable for a hover state. If you need a band and reach
for `--wash` because it's "the other light colour", you'll make every totals
row look permanently hovered.

- A block that is **bordered** (a table inside a panel) also takes
  `border-edge` — `bg-field` alone is only 1.085:1, so at this end of the
  lightness range the fill can't separate the block on its own. A block that
  is **full-bleed** inside a card (the breakdown card's rows) doesn't need
  one; the card's own border is the boundary.
- Dividers *inside* a block stay `border-rule`. `--edge` is for a block's
  outer boundary, never its internal lines.
- Rows hover to `--wash`, which lands harder on `--field` than on a
  transparent row.
- Don't reach for `/50` opacities to make a band (`bg-paper/50` was what made
  the breakdown footer vanish). Bands are flat tokens; a half-transparent one
  just averages toward whatever it sits on.

### Cards, rows, chips

- Card: `rounded-lg border border-rule bg-surface p-4` (or `p-5` for a page-level
  panel).
- Divided list: `divide-y divide-rule` on the container, not per-row borders.
- Person chip: `rounded-full border border-rule bg-paper px-4 py-2` — see
  `src/components/ui/PersonChip.tsx`.
- Avatars: `MemberAvatar`. Avatar colours are a deliberate placeholder; custom
  avatars are planned, so colour churn on claim is expected and fine.

### Money

- Always `.font-numeric`.
- Always formatted through `src/lib/format.ts` with an explicit currency —
  never a bare `toFixed(2)` in a component.
- Positive to you: `text-ledger-green`. Negative: `text-margin-red` (on
  `--surface`). Zero/settled: `text-ink-soft`.
- Never convey a balance's sign by colour alone — keep the `−`/`+` or the word.

---

## 6. Mobile

The app is designed mobile-first; `md` is where the sidebar appears.

**Touch targets.** Minimum **44 × 44 CSS px** (`min-h-11` / `size-11`) for
anything tappable — buttons, nav links, checkbox labels, icon buttons,
list-row actions. `min-h-11` on a `<label>` wrapping a checkbox is the pattern
used in `StageExpense`; follow it. The `Button` default (`h-8`) and `icon-sm`
(28px) are desktop-density sizes: on a touch-reachable surface pass
`className="min-h-11"`.

**Input font size.** iOS Safari auto-zooms any focused input rendered below
16px. Text inputs that receive focus on mobile must be **16px** — `text-base`,
or `text-sm md:text-sm` with a `max-md:text-base` override. `text-sm` alone on
a mobile-reachable input is a bug.

**Drawer.** The mobile sidebar is off-canvas (`-translate-x-full`) with a
`bg-ink/30` scrim. When closed it must be removed from the tab order — `inert`
on the `<aside>`, or don't render it — and when open it must trap focus, return
focus to the trigger on close, and close on `Escape`.

**Layout.** Single column below `md`. Two-column forms collapse by dropping the
`md:border-l md:pl-6` divider to `border-t pt-5`. Wide tables scroll inside
`overflow-x-auto` — **the page body must never scroll horizontally.**

**Safe areas.** `Page` already carries the bottom inset and the sidebar carries
the top one. Any *new* fixed chrome needs its own
`pb-[env(safe-area-inset-bottom)]` / `pt-[env(safe-area-inset-top)]`.

**Action density.** A phone has room for roughly **one** action button in a
header. The single most important action ("Add expense") gets the button;
everything rarer or destructive goes into an `<OverflowMenu>` (`⋯`) beside it,
as `<OverflowAction>` rows. A row of four equal-weight buttons hides the one
that matters and blows past the width.

A dialog that a menu item opens must be a **sibling** of the `OverflowMenu`,
never a child — a menu item unmounts when the menu closes and would take its
dialog with it.

**Progressive disclosure.** Columns that don't fit collapse into a metadata
line under the primary cell rather than shrinking (see the tab expense grid):
below `md` the date, creator and participants move under the expense name,
leaving name + amount.

**Text wrapping.** User-supplied names wrap (`break-words`); chrome
(`whitespace-nowrap`) does not.

---

## 7. Accessibility

Target: **WCAG 2.1 AA**.

**Focus.** One visible focus style, one colour — **`--forest`**:

```
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest
```

Inside a bordered control use the ring form
(`focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20`);
inside a clipped container use `focus-visible:-outline-offset-2`. Never remove
an outline without replacing it. `--margin-red` is the *error* colour and must
not double as the focus colour — including via the shadcn `--ring` token, which
should point at `--forest`.

**Colour is never the only signal.** Pair it with text, an icon, weight, or a
border — for balances, tab state, validation, and nav state alike.

**Names.** Every icon-only control gets `aria-label`. Every landmark (`nav`,
`main`, tab list) gets a label when more than one of its kind can appear.
`aria-hidden="true"` on decorative icons that sit next to their own text.

**Live regions.** Loading uses `role="status"`. Errors and failed mutations use
`role="alert"`. Optimistic results that appear without a navigation announce via
`aria-live="polite"`. Pending controls carry `aria-busy`.

**Keyboard.** Everything actionable is reachable and operable by keyboard. A
`div` with `onClick` is not a control — use `<button>`. Dialogs and the mobile
drawer move focus in on open, close on `Escape`, and restore focus to the
trigger. A closed off-canvas panel must be `invisible`, not merely translated
off-screen — a translated panel keeps its links in the tab order. The skip
link lives in `__root.tsx` and targets `Page`'s `id="main"`.

**Structure.** **Exactly one `<h1>` per page**, and it must exist in every
state — including while a title is still being typed, where it belongs in an
`sr-only` `PageTitle` beside the input. Headings descend without skipping; a
page whose first heading is an `<h2>` is a bug. `<main>` (via `Page`) wraps
page content; `<nav>` wraps navigation.

**Verify it, don't assume it.** The cheap check, run against a real 393×852
viewport: every interactive box ≥ 44×44, exactly one `h1`, no heading-level
skips, `scrollWidth <= innerWidth`, and every input with a label or
`aria-label`.

**Motion.** Respect `prefers-reduced-motion` — handled globally; don't bypass
it with inline styles or JS-driven animation.

---

## 8. Known deviations

These are real, verified gaps between the codebase and this spec. Fix them when
you touch the surrounding code; don't add new instances.

### Resolved

The button migration closed these. Listed so the history is legible — do not
reintroduce them.

- ~~Eleven distinct primary-button class strings.~~ All call sites now use
  `Button`. The remaining raw `<button>` elements are the twelve listed under
  "By design" below.
- ~~Primary hover `hover:bg-ink`~~ → the `default` variant's `bg-primary/80`.
- ~~Two competing focus colours.~~ `--ring` is `--forest`, and every
  `outline-margin-red` / `ring-margin-red/40` (buttons *and* inputs) is gone.
- ~~Off-palette `#f3ead8` hover (7 sites).~~ → `hover:bg-paper`.
- ~~`text-white`~~ → `text-surface`.
- ~~Mobile menu buttons under 44px.~~ → `icon-touch`.
- Focus rings added to controls that previously had none: the disclosure
  triggers, the item-row content button, the mode toggle, and `RateInput`'s
  segmented control.
- ~~Invisible hover states.~~ `--wash` replaced `--paper` on every row, list
  item and quiet button, and `--accent` now points at it so `Button`'s
  `outline`/`ghost`/`secondary` hovers are visible on a `--surface` dialog.
- ~~Three duplicated `inputClass` constants + ~12 hand-rolled fields.~~ →
  `ui/Input.tsx` (`Input`, `Textarea`, `Label`, `FieldError`).
- ~~Inputs at 14px, zooming on iOS focus.~~ `fieldClass` is `text-base
  sm:text-sm`; the `[&_input]:text-base` wrappers are gone.
- ~~26 hand-written heading class strings across 6 shapes.~~ →
  `ui/Typography.tsx` (`PageTitle`, `PageDescription`, `SectionTitle`,
  `GroupTitle`). The `text-sm font-medium` / `text-sm font-semibold` heading
  split collapsed into `GroupTitle`.
- ~~Popovers invisible against the page.~~ Every dropdown (currency picker,
  currency filters, date picker, tab picker, the row and header `⋯` menus)
  floated at 1.05:1 fill contrast behind a 1.32:1 border. Now `--edge`
  (3.4:1) plus `shadow-lg`, declared once on `PopoverContent`.
- ~~Tables and banded cards identical to the card behind them.~~ The
  spend-summary table, the tab's expense list and the breakdown member cards
  were all transparent on a `--surface/80` card (1.00:1), and the breakdown's
  totals footer was a `bg-paper/50` that averaged back into it. All three now
  use the header/body/footer banding above.
- ~~Friends' shared-tab chips invisible.~~ They were `bg-paper` on a card
  (1.05:1) and wrapped badly past two or three tabs. Replaced with a
  count button opening a dialog that lists the tabs as navigable rows —
  the same shape as the tab page's member roster.
- ~~Dialog close buttons at 28px.~~ Every `size="icon-sm"` in the app was a
  dialog close or inline dismiss — all touch targets. Now `icon-touch`.
- ~~Bands using `--paper`.~~ The first pass gave them the *page* colour, so a
  footer on a card's bottom edge looked like a gap. `--band` added.
- ~~The hover wash was sage, like everything else.~~ `--wash` is now warm
  (brass into `--surface`) at the same luminance step, so a hover reads by hue
  as well as value. This is what the app's original hardcoded `#f3ead8` was
  reaching for — that colour was warm but far too light (1.04:1) to register.
- ~~Red text under AA everywhere.~~ `--margin-red-ink` added and swept across
  all 11 files carrying red text, plus the `destructive` button variant.
  `--margin-red` is now fills/borders/icons only.
- ~~Fields invisible against their ground.~~ Every input, textarea, picker
  trigger and the discount/tax/tip boxes sat at `bg-paper` — 1.00:1 on a page.
  Now `--field` + `--edge`, applied through `fieldClass` and the `field`
  button variant so it reaches all of them at once.
- ~~Dead `dark:` utilities.~~ All gone (the last was one class in
  `Calendar.tsx`). The `@custom-variant dark` pin in `globals.css` stays as a
  guard so a `dark:` class arriving with a future shadcn component is inert
  rather than half-active under prefers-color-scheme.
- ~~Labelled buttons using `ghost`.~~ "Cancel item changes", "Close", the
  stage-footer cancel and the member-form cancel were borderless at rest and
  filled on hover beside bordered neighbours. All `outline` now; `ghost` is
  icon-only (verified: all 20 remaining `ghost` sites are `icon-*`).
- ~~Deletes split across two treatments.~~ "Delete note", "Remove" (receipt)
  and "Remove rate" were `ghost` + red text, which put red on the green
  `--wash` at hover. All `destructive` now, and `destructive` gained a border
  so it shares geometry with `outline` in a button row.
- ~~Panel borders lighting from any nested button.~~ `has-[button:hover]`
  matched every descendant once the panels gained real buttons; scoped to
  `has-[>button:hover]` (the panel's own disclosure trigger).
- ~~Dismiss controls hovering red.~~ Close/cancel hover to `--ink`; red is
  only for actions that destroy something.
- ~~The expense editor rendered no `<h1>`.~~ An unnamed expense never leaves
  edit mode, and that branch rendered only an `<Input>` — so the page opened
  on an orphan `<h2>`. An `sr-only` `PageTitle` now sits beside the input.
  Verified: every route has exactly one `h1`.
- ~~`--brass` failing contrast while carrying meaning.~~ `--brass-ink`
  (5.2–5.4:1) for the wordmark and any readable brass; the active nav icon is
  `--forest`.
- ~~The off-canvas drawer stayed in the tab order.~~ Closed it is `invisible`
  (transitioned, so it still slides), with `Escape` to close, focus moved in
  on open and returned to the trigger on close.
- ~~No skip-to-content link.~~ In `__root.tsx`, targeting `Page`'s `id="main"`.
- ~~No safe-area insets.~~ `Page` carries the bottom inset; the sidebar and
  mobile header carry the top one.
- ~~11 hand-written page shells + 3 copied `pageClass` constants.~~ →
  `ui/Page.tsx` (`Page`, `Panel`, `EmptyState`).
- ~~3 hand-built breadcrumb trails.~~ → `ui/Breadcrumb.tsx`.
- ~~Every tab action as its own header button on mobile.~~ "Delete tab" moved
  into an `OverflowMenu` (`ui/OverflowMenu.tsx`).
- ~~Per-row actions buried in a dialog.~~ The tab expense grid carries a row
  `⋯` (Edit / Delete) using the overlay pattern above. Verified at 393×852:
  the menu receives its own clicks, the row still navigates, and tab order
  runs row → its actions → next row. The directory lists were deliberately
  left as plain link rows.
- ~~Three hand-rolled delete confirmations.~~ → `ui/ConfirmDialog.tsx`, which
  owns pending/error state and stays open when the work fails.
- ~~Sub-44px targets~~: the wordmark, the sidebar sign-in and sign-out
  controls, the currency/date pickers, the currency filters, the Friends tab
  chips, and the "Full breakdown" link. Verified **signed in, with data**, at
  393×852 across `/tabs`, `/expenses`, `/friends`, `/settings` and a tab
  detail page: no interactive box under 44px. The one exception is a
  breadcrumb crumb (29×36) — inline text links are exempt under WCAG 2.5.8,
  and `crumbLinkClass` grows the hit area as far as it can without changing
  the breadcrumb's layout height.

  Auditing **signed out** is not enough: sign-out, the tab detail page and the
  Friends chips only exist with real data, and every one of them was
  undersized.

### By design — raw `<button>` that should stay raw

A design-system primitive owns its own element; wrapping these in `Button`
would be the wrong abstraction. Keep them, but keep them spec-compliant
(tokens, focus ring, touch target).

- `ui/Button.tsx`, `ui/MenuOption.tsx`, `ui/PersonChip.tsx`, `ui/RateInput.tsx`
  (×2, a segmented control) — primitives.
- Disclosure triggers in `StageExpense.tsx` (×2), `StageResults.tsx` (×2),
  `ExpenseImageField.tsx` — full-width block layout that `Button`'s
  `inline-flex`/`whitespace-nowrap` would fight. Their shared surface is four
  utility classes, which is too thin to extract without inventing a wrapper
  that earns nothing.
- Large content-region buttons: the expense row in `TabPage.tsx:481` (a grid
  template) and the item row in `ui/ExpenseLineItem.tsx:46`.

### Open — accessibility

*(Nothing open.)*

### Open — consistency

*(Nothing open.)*
