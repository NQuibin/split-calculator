# Trip Itinerary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let members of an existing tab plan dated, ordered visits and see each day's Google places on a map.

**Architecture:** The itinerary belongs to the existing `tabs` record and uses its membership rules. Convex stores days, visits, user-authored text, and Google place IDs; the browser loads Google place details and map data only while the itinerary page is open. The list remains usable when Google is unavailable.

**Tech Stack:** Vite, React 19, TanStack Router, Convex, Vitest/convex-test, Google Maps JavaScript API and Places API (New).

**Spec:** This file's “Product contract” section. A tab is the trip container; a separate trips feature is outside scope.

## Product contract

- A tab member can create a day with a valid local `YYYY-MM-DD` date and optional label. Each tab has at most one day per date; days appear in date order.
- A visit has a required user-authored title, optional note, optional `HH:mm` time, and optional Google place ID. Manual visits work without Google. Members can add, edit, delete, move between days, and reorder visits. Order is explicit; time does not automatically sort visits.
- A day's list shows all visits even if Google fails. When Google loads, mapped visits have numbered markers matching list positions. Selecting a row or marker highlights the other. The map fits the day's mapped places, and each mapped visit has a Google Maps link.
- All claimed tab members can read and edit. Signed-out visitors, outsiders, invite-token holders before claiming, and public-share viewers cannot access itinerary data.
- Deleting a day deletes its visits after confirmation. Deleting a tab deletes its days and visits. User text survives a stale place ID or failed Maps load.
- First release excludes travel times, routing, reservations, attachments, expense links, and public itinerary sharing.

## Global constraints

- Read `DESIGN.md` before UI work and `convex/_generated/ai/guidelines.md` before Convex work. Reuse `src/components/ui/` controls, the `Page` width cap, and touch/focus rules.
- Use existing tab authorization (`requireTabViewer`), date validation (`isValidISODate`), Convex subscriptions, and the host's SPA fallback for `/t/{slug}/itinerary`.
- Store only the Google place ID, never Google-provided name, address, or coordinates. Resolve current fields on display. Follow [Google's storage and attribution policy](https://developers.google.com/maps/documentation/javascript/policies).
- Load the Google SDK on this route only. Use [Place Autocomplete (New)](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), request only needed [Place fields](https://developers.google.com/maps/documentation/javascript/place-details), and use [advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).
- Use a Vite browser key restricted by website and API, with Maps JavaScript API and Places API (New) enabled. Document setup; commit no key. Check [Google's key guidance](https://developers.google.com/maps/api-security-best-practices) before launch.
- Run `pnpm lint`, `pnpm typecheck`, and focused tests before handoff. Do not deploy or alter production credentials as part of this plan.

## File map

| File | Responsibility |
| --- | --- |
| `convex/schema.ts` | Day and visit tables, indexed by parent/date or parent/order. |
| `convex/itinerary.ts` | Validated, membership-checked itinerary reads and mutations. |
| `convex/itinerary.test.ts` | Data, ordering, authorization, and deletion regression tests. |
| `convex/tabs.ts` | Include itinerary in the existing tab deletion transaction. |
| `src/routes/t.$slug.itinerary.tsx` | Member-only route and tab error boundary. |
| `src/pages/ItineraryPage.tsx` | Day and visit editing, list, status, and responsive layout. |
| `src/components/ItineraryMap.tsx` | Lazy Google load, place lookup, autocomplete, map, and markers. |
| `src/pages/TabPage.tsx` | Entry link to the itinerary. |
| `README.md` | Google Cloud browser key and map ID setup. |

## Review focus

1. Invalid dates/times and duplicate dates must be rejected without changing saved data (Task 1).
2. An outsider must not use another tab's `dayId` or `visitId` to read or mutate data (Task 1).
3. Concurrent edits or a move between days must leave each day's order contiguous (Task 1).
4. A stale place ID, blocked API, or absent key must leave manual editing and saved titles available (Task 3).
5. Deleting a tab must leave no itinerary rows; a deep link must survive hard reload (Tasks 1 and 2).

---

### Task 1: Persistent itinerary and access rules

**Files:** Create `convex/itinerary.ts`, `convex/itinerary.test.ts`; modify `convex/schema.ts`, `convex/tabs.ts`.

**Interfaces:** `api.itinerary.list({ slug })` returns `{ days, visits }` (or `null` for a missing tab). Days carry `_id`, `date`, `label`; visits carry `_id`, `dayId`, `position`, `title`, `note`, `time`, `placeId`. Mutations: `createDay({ slug, date, label? })`, `updateDay({ dayId, label })`, `deleteDay({ dayId })`, `createVisit({ dayId, title, note?, time?, placeId? })`, `updateVisit({ visitId, title, note?, time?, placeId? })`, `deleteVisit({ visitId })`, `moveVisit({ visitId, targetDayId, targetIndex })`. IDs are Convex table IDs.

- [ ] **Step 1: Write failing `convex/itinerary.test.ts` tests.** Assert member creation/read/edit, date order, duplicate/invalid date and time rejection, outsider and unclaimed invite denial for every ID-based mutation, cross-tab target rejection, reorder/move with contiguous positions, day deletion, and tab deletion cleanup. Follow identity setup in `convex/access.test.ts`.
- [ ] **Step 2: Run `pnpm exec vitest run convex/itinerary.test.ts`.** Expect failure because itinerary functions/tables do not exist.
- [ ] **Step 3: Add `itineraryDays` and `itineraryVisits` in `convex/schema.ts`.** Index days by `tabId,date`, visits by `dayId,position`, and visits by `tabId` for cleanup. Store `placeId` only for Google data. Keep `label`, `note`, `time`, and `placeId` optional.
- [ ] **Step 4: Implement the interfaces in `convex/itinerary.ts`.** Look up each parent and call `requireTabViewer` before data access. Validate `isValidISODate`, real `HH:mm` 24-hour time, nonblank trimmed title, and bounded text. Reject duplicate tab/date. Use one mutation for each move, reassigning positions `0..n-1` for affected days so concurrent moves serialize through Convex transactions. Delete a day's visits in the same mutation.
- [ ] **Step 5: Extend `deleteTab` in `convex/tabs.ts`.** Delete its visits and days in the existing transaction before deleting the tab. Follow its bounded-deletion pattern so oversized data cannot silently leave orphaned rows.
- [ ] **Step 6: Run `pnpm exec vitest run convex/itinerary.test.ts` and `pnpm typecheck`.** Expect all tests and typecheck to pass.
- [ ] **Step 7: Commit:** `feat: add tab itinerary data and access rules`.

### Task 2: Day and visit planning screen

**Files:** Create `src/routes/t.$slug.itinerary.tsx`, `src/pages/ItineraryPage.tsx`; modify `src/pages/TabPage.tsx`.

**Interfaces:** Consume Task 1's `api.itinerary.list` and mutations through `useQuery`/`useMutation`. The page passes mapped visit IDs and a selected visit ID to Task 3's map component. Build the list first so it works without Google.

- [ ] **Step 1: Add a member-only route** at `/t/$slug/itinerary` with the `AccessErrorPage` pattern in `src/routes/t.$slug.index.tsx`. Add the itinerary entry to the tab page.
- [ ] **Step 2: Build the day UI in `ItineraryPage.tsx`.** Use `Page`, `Panel`, `EmptyState`, `Button`, `Input`, `Dialog`, and `Breadcrumb`; show loading, missing tab, empty itinerary, selected day, duplicate-date error, and mutation failure. Use native date input and date-ordered day navigation. Confirm deletion of a day containing visits.
- [ ] **Step 3: Build visit editing in that page.** Use a manual title field, optional note/time fields, move-to-day control, reorder controls, and deletion confirmation. Keep a save action explicit. Make row selection keyboard operable and use accessible status/error text; no drag-and-drop is required.
- [ ] **Step 4: Verify in browser and run `pnpm typecheck`.** Check 393px and desktop widths, keyboard flow, reload persistence, two-member live updates, and a hard load of `/t/{slug}/itinerary` using the configured SPA fallback.
- [ ] **Step 5: Commit:** `feat: add day and visit planning page`.

### Task 3: Google place search and day map

**Files:** Create `src/components/ItineraryMap.tsx`; modify `src/pages/ItineraryPage.tsx`, `README.md`.

**Interfaces:** `ItineraryMap` receives the selected day's ordered visits (`_id`, `title`, `placeId?`), `selectedVisitId`, `onSelectVisit(id)`, and `onChoosePlace(placeId)`. The page asks the user for a title when adding a place; it does not persist a Google-provided name, address, or coordinates.

- [ ] **Step 1: Add Google setup to `README.md`.** Specify Vite environment variable names for the restricted browser key and production map ID, enabled APIs, allowed website origins, and attribution/terms/privacy review. Avoid adding a key to the repository.
- [ ] **Step 2: Implement lazy SDK load and `PlaceAutocompleteElement` in `ItineraryMap.tsx`.** On selection, send `placeId` to the page and require a user-entered title before saving. Resolve only display name, formatted address, and location for saved place IDs; use Google map attribution as supplied by the SDK.
- [ ] **Step 3: Render the day map with advanced markers.** Marker numbers follow list order, excluding manual visits from the marker set. Fit mapped places when day changes. Synchronize marker and list selection and supply a Google Maps link per mapped visit.
- [ ] **Step 4: Exercise failure states manually.** With no key, blocked network, and a stale place ID, confirm the page still shows saved user titles and permits manual add/edit/move. Confirm zero-place and one-place days render sensibly. Check keyboard and phone interaction.
- [ ] **Step 5: Run `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run convex/itinerary.test.ts`, and `pnpm build`.** Expect all to pass. Verify Google billing/key restrictions, attribution, public Terms/Privacy, and the production deep link before release.
- [ ] **Step 6: Commit:** `feat: add itinerary place search and map`.

## Handoff

Review this plan and the tab-as-trip assumption before implementation. For execution, use subagent-driven work if independent review is desired, or native execution for a shorter feedback loop. No implementation has started.
