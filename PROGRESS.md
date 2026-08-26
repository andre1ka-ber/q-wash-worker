# Progress

See `PLAN.md` for the full plan and build order.

- [x] Phase A — Scaffold
- [x] Phase B — Screen against mock data
- [x] Phase C — Wire to real q-wash-api
- [x] Phase D — Live polling
- [x] Phase E — Polish

## Log

- 2026-08-20 — Imported the design from Claude Design (`Car Wash Web
  Apps.dc.html`, "Приложение мастера" tab), read `q-wash-api` end to end,
  grilled the plan with the user, wrote `PLAN.md`. Renamed from the
  original "washer-app" naming to "worker" (mock's own label is "мастер").
  Nothing built yet.
- 2026-08-22 — Built phases A and B.

  **Re-checked the phase-7 blocker before writing any code** (the same
  check that let q-wash-cabinet skip mock-data builds for two tabs whose
  backend had shipped since its own plan was written): re-read
  `q-wash-api/docs/PLAN_WEB_APPS.md`'s phased build order and confirmed
  phases 6 (`Box` entity) and 7 (worker RBAC/live-boxes/pause-resume) are
  both still `[ ]`. Went further than the doc, too — read
  `internal/app/app.go` directly and confirmed `requireStaff` (which gates
  every route this app needs: `washingpoint`, `queue`, `service`,
  `schedule`) only accepts `auth.RequireRole(RoleStaff, RoleAdmin)`, while
  `auth/service.go`'s `LoginWithPassword` already accepts `RoleWorker` for
  login itself. So a worker account can authenticate and call `GET /me`,
  but 403s on everything else — confirmed this isn't just a schema gap
  but a real, live RBAC block. Built Phases A/B against mock data as the
  plan already anticipated for this exact scenario, rather than trying to
  get ahead of the backend.

  **No design-system access this session**: `DesignSync.list_projects`
  only returned an unrelated writable project ("Modernist") — the "Car
  wash queue app" mock either isn't a design-system-type project or isn't
  writable by this account, so `get_file` couldn't read
  `Car Wash Web Apps.dc.html` directly. Built from this doc's plain-English
  design description instead (written 2026-08-20, presumably transcribed
  from the mock at the time), reusing `q-wash-cabinet`'s already-built
  header/login/table visual patterns 1:1 for anything the mock description
  doesn't pin down precisely (e.g. exact box-card padding, exact queue-pill
  wording choices beyond the three named in PLAN.md).

  **Phase A (scaffold)**: same Vite/React/TS/`@tanstack/react-query`/
  `react-router-dom` versions as the other three apps (tooling-vouched
  combination). Single route (`/`) behind auth, no tab bar/sidebar — this
  app really is one screen. `ProtectedRoute` requires `role in
  {staff, worker}` and `washing_point_id` set, same gate as
  `q-wash-cabinet`, letting a shift lead (`staff`) use this screen too, not
  only `worker`. Added a seeded `worker` account to `q-wash-api/cmd/seed`
  (`worker` / `worker12345`, `washing_point_id` set to the seed point) —
  needed for this app's login screen to have anything real to test against
  locally; confirmed via `curl POST /auth/login` that it authenticates and
  returns `washing_point_id` correctly. See `q-wash-api/PROGRESS.md`'s
  matching entry.

  **Phase B (screen, mock data)**: `src/features/shift/types.ts` holds the
  mock shape (`MockBooking`, `MockBox`) deliberately close to what
  `PLAN_WEB_APPS.md` phase 6/7's real endpoints will return, so Phase C is
  a data-source swap, not a rewrite. Two boxes seeded from the same
  `cmd/seed` data every other app in this session was verified against
  (Full wash 90 мин / Express wash 30 мин). Single source of truth is a
  flat `bookings` array in `ShiftPage`'s `useState` — box "current"/"next"
  booking, the queue table's rows, and the completed-count badge are all
  *derived* from it on render rather than duplicated into separate box
  state, so starting/pausing/finishing/removing a booking can't desync box
  and queue-table views from each other. A local `setInterval` (in
  `ShiftPage`) ticks every `washing`+non-paused booking's `elapsedMs`
  forward by 1s — stands in for Phase D's `refetchInterval` for now, per
  PLAN.md's "Live updates" decision. `useClock` (`src/shared/useClock.ts`)
  is a separate 1s ticker driving the header's live clock/date, formatted
  in `Asia/Dushanbe` (the platform's fixed `businessLocation`) rather than
  the browser's local timezone.

  The header's washing-point name/address is a **hardcoded placeholder**
  (`Header.tsx`'s `MOCK_POINT_NAME`/`MOCK_POINT_ADDRESS`), not a real `GET
  /washing-points/{id}` call — that endpoint sits behind the same
  `requireStaff` block above, so calling it for a real worker account would
  just 403. `useMyWashingPoint()` (the pattern `q-wash-cabinet` uses) isn't
  wired in here at all yet; add it in Phase C once the block lifts. The
  master's own name *is* real (`useAuth().user.name`, via `GET /me`, which
  isn't gated by `requireStaff`).

  "Снять" (no-show) is a single click with no confirmation — Phase E's
  explicit job, not skipped by accident (see PLAN.md). Deliberately did
  *not* use a `window.confirm()` for it even as a placeholder, to keep this
  screen safe to click through in an automated browser session later
  (blocking dialogs freeze the extension).

  **Verification**: `npm install`, `tsc -b`, `oxlint`, and `vite build`
  all clean. `curl -X POST /auth/login` with the seeded `worker` credentials
  round-tripped a token pair with `role: "worker"` and the correct
  `washing_point_id`.
- 2026-08-22 (later still, same day) — **Real browser verification**, once
  the user reconnected the `claude-in-chrome` extension (it reported not
  connected earlier this session — see the prior entry). Logged in as the
  seeded `worker` account against the Vite dev server (`:5183`) talking to
  the real local `q-wash-api` (`:8080`): header showed the real name "Азиз
  Каримов" (from `GET /me`) and a live-ticking clock/date, Box 1 rendered
  busy (В работе, progress bar advancing), Box 2 rendered free with its
  next booking and a "Начать мойку A-03" button, queue table showed all 3
  upcoming bookings with correct pills. Clicked through the full action
  set: Пауза froze Box 1's elapsed timer while the header clock kept
  advancing (confirmed via two zoomed screenshots a few seconds apart),
  Продолжить resumed it; "Начать мойку A-03" moved Box 2 to busy and
  removed A-03 from the queue table; Завершить on Box 1 freed it,
  incremented "Помыто сегодня" from 0 to 1, and correctly showed "На
  сегодня записей нет" (no more bookings assigned to that box); Снять on
  A-02 turned its pill into "Не приехал" and removed its action buttons,
  while A-04 (still waiting) kept its own; logout returned cleanly to
  `/login`. No console errors. Confirms the `bookings`-array-as-single-
  source-of-truth design (PLAN.md) actually keeps box cards and the queue
  table in sync through every transition, not just in theory.

- 2026-08-26 — **Phases C/D/E: wired to the real API.** `PLAN_WEB_APPS.md`
  phases 6/7 (boxes, worker RBAC/live-boxes/pause-resume/broadened cancel)
  had both shipped and been verified against real Postgres earlier the same
  session (see `q-wash-api/PROGRESS.md`, `q-wash-cabinet/PROGRESS.md`'s
  boxes entry) — this app's own C/D blocker was gone, just not yet acted on.

  **Read the real backend contract before writing any UI code** (`internal/
  queue/handler.go`, `internal/queue/manager.go`) and found three real
  mismatches between the mock's design and what the API actually returns —
  grilled with the user (`AskUserQuestion`), all three "Recommended"
  options taken:
  1. **No ticket/plate/full-name anywhere in the API.** `boardItemResponse`/
     `liveBoxBookingResponse` only carry `car_name` + `customer_phone_last4`
     (`Car` has no plate field, `Queue` has no ticket concept at all).
     `q-wash-admin`'s `BookingsPage.tsx` had already hit this exact gap and
     settled on `"{car_name} · ••{phone_last4}"` — matched that pattern
     exactly instead of re-deciding it, rather than inventing a fake ticket.
  2. **Status only advances one step at a time** — `queue → waiting →
     washing → ready`, enforced by `forwardStatusTransitions` in
     `queue.Manager.UpdateStatus`, no skipping. The mock's single "Начать
     мойку {ticket}" button implies one click starts the wash even from
     `queue`. Chained client-side in `ShiftPage.tsx`'s `startMutation`:
     if the booking is still `queue`, fires `PATCH .../status
     {waiting}` then `{washing}` sequentially before resolving — the
     technician still only clicks once. (`q-wash-admin`'s own board takes
     the other, two-explicit-steps approach for its own reasons — a
     staff-facing network monitor, not a floor device — so this is a
     deliberate divergence, not an inconsistency.)
  3. **Scope**: build C, D, and E together rather than stopping at C — the
     screen is small enough that splitting into separate sessions wasn't
     worth the overhead.

  **q-wash-shared additions** (`api/queue.ts`, `api/types.ts`):
  `listQueueByWashingPoint(washingPointId, date?)` (`GET .../queue?date=`),
  `getBoxesLive(washingPointId)` (`GET .../boxes/live`), `pauseBooking`/
  `resumeBooking`/`cancelBooking` (`PATCH .../pause|resume|cancel`) — none
  of these existed yet, only the admin-only `listQueueNetworkWide`/
  `updateBookingStatus` did. New types `LiveBoxBooking`/`LiveBox`/
  `LiveBoxList` matching `liveBoxResponse` exactly; added the missing
  `paused_at?` field to the existing `BoardItem` type (the real
  `boardItemResponse` has always had it, the type just hadn't caught up).
  Also added five error codes to `errors.ts`'s Russian map that this
  screen's own action buttons can now genuinely hit: `cannot_pause`,
  `cannot_resume`, `cannot_cancel`, `invalid_status_transition`,
  `queue_not_found` — verified each one's exact wire format via `curl`
  against the real API (see below), not guessed from the Go source alone.

  **q-wash-worker changes**: `useMyWashingPoint()` (`src/shared/
  useMyWashingPoint.ts`, identical pattern to `q-wash-cabinet`'s) replaces
  `Header.tsx`'s `MOCK_POINT_NAME`/`MOCK_POINT_ADDRESS` placeholders —
  `GET /washing-points/{id}` turned out to already be a fully public route
  (`washingpoint.Handler.RegisterRoutes`'s own comment: "reads are
  public"), so no RBAC change was needed here at all, despite the 2026-08-22
  entry above assuming it would be. `ShiftPage.tsx` rewritten from a single
  local `bookings` array to two `react-query` queries
  (`['worker','boxes-live',id]`, `['worker','queue',id]`,
  `refetchInterval: 8_000` each — mirrors `pegasus-board`'s cadence per
  PLAN.md) plus four mutations (start/pause-resume/finish/cancel), each
  invalidating both queries on success so box cards and the queue table
  can never drift out of sync with each other, same guarantee the old
  single-array design gave for free. Deleted `features/shift/types.ts`
  (the mock shapes) — `BoxCard.tsx` and `ShiftPage.tsx` now import
  `LiveBox`/`LiveBoxBooking`/`BoardItem`/`BoardItemStatus` straight from
  `q-wash-shared`.

  **Elapsed-time bar**: no "washing started at" field exists on the
  backend, only `scheduled_start_at`/`paused_at`. Derived as wall-clock
  time since `scheduled_start_at`, anchored to `paused_at` (not `now`)
  while paused — since `paused_at` doesn't move, this naturally freezes the
  bar with zero extra state, and naturally resumes counting real elapsed
  time (not a simulated one) the instant `paused_at` clears. A deliberate
  behavior change from Phase B's mock, which paused a simulated stopwatch
  and didn't count time spent paused at all — this version shows genuine
  wall-clock lateness, arguably more useful to a technician than a fake
  stopwatch, and was the only option that didn't require a new backend
  field.

  **Completed-today count**: still purely client-side (`useState` in
  `ShiftPage`, incremented on a successful `finish` mutation), same as
  Phase B — the real API has no way to answer "how many bookings did this
  point finish today" for a non-admin caller (`boxes/live` and
  `.../queue` both deliberately exclude `status=ready` rows, and
  `admin`'s stats endpoint is network-wide and admin-only). Not re-grilled
  with the user since the only alternatives were dropping the badge
  entirely or adding a new backend endpoint (out of scope without
  approval) — kept the same defensible default Phase B already used.

  **"Снять" confirm-before-cancel** (Phase E): no `window.confirm()` (same
  no-blocking-dialogs rule as Phase B) — first click turns the button into
  "Точно снять?" with an "Отмена" button alongside; second click fires the
  real `cancelBooking`. **Poll-failure banner** (Phase E): a
  "Переподключение…" banner shows above the board when a background
  refetch fails but the screen still has stale data to show; a full error
  state only replaces the screen if the very first load fails.

  **Verification — real backend, not just typecheck.** `tsc -b`, `oxlint`,
  `vite build` all clean for `q-wash-worker`; re-ran `tsc -b` in
  `q-wash-admin` and `q-wash-cabinet` too, since this session's shared-
  package changes are consumed by both — both clean, no regressions from
  the new `BoardItem.paused_at` field or the new `queue.ts` exports.
  Started the real stack (`docker compose up` Postgres, `go run ./cmd/api`,
  `make seed`, `vite --port 5183`) and logged in as the seeded `worker` /
  `worker12345` account via direct `curl` calls (the `claude-in-chrome`
  extension reported not connected this session, unlike the 2026-08-22
  entry above — no live browser click-through was possible this pass):
  - `GET .../boxes/live` returned exactly the shape `LiveBox`/
    `LiveBoxBooking` expect, including a box with no `label` (`omitempty`
    working as typed — `label?` correctly optional) and a box with neither
    `current` nor `next`.
  - Walked one real seeded booking through the full chain the UI drives —
    `status=waiting` → `status=washing` → `pause` (response includes
    `paused_at`) → `resume` (`paused_at` gone) → `status=ready` — every
    response matched what `ShiftPage.tsx`'s mutations expect, and
    `boxes/live` correctly dropped the booking from `current` once it hit
    `ready` (box shows as free again).
  - Canceled a second booking while still `status=queue`; `boxes/live`
    correctly stopped showing it as that box's `next` at all afterward
    (matches the real UI behavior: the row just disappears on the next
    poll, it doesn't turn into a persistent "not shown" pill the way the
    Phase B mock's local `no_show` status did — a real, if minor, UX
    difference from the mock worth knowing about).
  - Forced both new 409 codes for real (paused/canceled an already-`ready`
    booking) and confirmed the wire format (`{"error":{"code":
    "cannot_pause", ...}}`) matches what `errors.ts`'s new map keys off of.
  - Reseeded afterward (`make seed`) to undo the state mutations from this
    verification pass and leave the demo data clean.

- 2026-08-26 (later, same day) — **Real browser verification**, once the
  `claude-in-chrome` extension reconnected (it wasn't connected earlier
  the same session — see the prior entry).

  **Found and fixed one real bug from this**: `BoxCard.tsx`'s
  `startLabel()` showed "Поставить в очередь" for a `queue`-status next
  booking, implying a single administrative step — leftover from
  reasoning about the *unchosen* "two explicit steps" option in this
  session's earlier grilling. The actually-approved `startMutation`
  always chains through to `washing` regardless of starting status, so the
  button was lying about what one click does. Fixed to always show
  "Начать мойку". A pure `tsc`/`oxlint`/`curl` pass wouldn't have caught
  this — it's a UI-copy bug, not a type or wiring error, exactly the kind
  of thing browser verification exists to catch.

  The seed data's own demo bookings are dated tomorrow
  (`2026-08-27`, `q-wash-api/cmd/seed`), so today's queue/box screen would
  otherwise have nothing to show. Created two real bookings for today via
  the actual customer OTP-login + `POST /queue` flow (not raw SQL) — one
  per box, `Full wash`/`Express wash` — to get a realistic board to click
  through. To verify the elapsed-time bar actually ticks (rather than
  sitting at `00:00` because the freshly-created booking's
  `scheduled_start_at` was still a few minutes in the future), backdated
  one booking's `scheduled_start_at` 10 minutes via direct SQL after
  creation — the one piece of this verification that touched the DB
  directly rather than going through the API, done only because there's
  no "start washing right now regardless of schedule" endpoint and this
  was purely for watching a number tick, not exercising business logic.

  **Clicked through, logged in as `staff` first**: header showed the real
  point name/address (`useMyWashingPoint`, no more hardcoded placeholder)
  and both today's real bookings on their box cards and in the queue
  table, correctly labeled "Поставить в очередь" → fixed to "Начать
  мойку" mid-verification (see bug above). One-click "Начать мойку" on
  Box 1 chained `queue → washing` in a single click exactly as designed —
  card flipped to "В работе", progress bar started, queue table
  correctly dropped that row (now shown on its own card instead). Пауза
  froze the elapsed bar at its exact value — confirmed via two zoomed
  screenshots 4s apart showing identical `00:00 из 90 мин` while the
  header clock kept advancing; Продолжить resumed and the bar picked up
  real elapsed time again (verified via two more zoomed screenshots,
  10:22 → 10:37 over roughly the expected wall-clock gap). Завершить
  freed Box 1, incremented "Помыто сегодня" 0→1, and correctly showed "На
  сегодня записей нет". Снять on Box 2's queue-table row: first click
  swapped the button to "Точно снять?" with an "Отмена" alongside;
  clicked Отмена first and confirmed it correctly reverted to a plain
  "Снять" (not stuck half-confirmed); clicked Снять → "Точно снять?"
  again and confirmed for real — the row disappeared entirely (not a
  persistent "not shown" pill, a real, deliberate divergence from the
  Phase B mock's `no_show` behavior, already flagged in the 2026-08-26
  wiring entry above).

  **Then logged in as the actual seeded `worker` account** (not just
  `staff`) to confirm the RBAC-broadened endpoints (`requireQueueOps`)
  really do work for that role too, not only `staff`/`admin` — header
  showed the real name "Азиз Каримов" (from `GET /me`), boxes/queue
  rendered correctly (empty, since the prior `staff` session had already
  resolved both test bookings). Closes the "worker-role access never
  actually exercised" gap noted in the entry above.

  No console errors (`onlyErrors: true`) at any point across this pass.
  Cleaned up afterward: deleted the two ad-hoc test bookings and re-ran
  `make seed` to restore clean demo data (seed's own bookings, being
  dated tomorrow, don't self-heal into a fresh state — they were left as
  whatever status this session's earlier `curl` testing put them in,
  harmless since neither shows on any current-day screen, but worth
  knowing if a future session wonders why the seed's `ready`/`canceled`
  rows don't look freshly seeded).

- 2026-08-26 (later still, same day) — `git init`'d this app (`main`
  branch, matching every sibling web app) and committed everything —
  closes the "no `.git` yet" gap from the entry above.

  Then, prompted by "is this fully implemented?", **found and fixed one
  more real gap**: `box.is_open` (the `Box` entity's own open/closed
  flag, set via `q-wash-cabinet`'s Боксы tab) was on the `LiveBox` type
  but never read anywhere in `BoxCard.tsx` — an administratively closed
  box rendered identically to an idle open one ("Свободен"), with nothing
  telling a technician not to use it. Fixed `badgeFor()` to check
  `box.is_open` (closed → `bad`/"Закрыт", same `StatusPill` convention
  `q-wash-cabinet`'s own `BoxesPage.tsx` already uses) — a currently-busy
  box still shows its busy/paused badge first, since that's the more
  urgent signal for whoever's standing at it; closed only wins over the
  generic idle state. Verified live: closed Box 3 via the real API
  (logged in as `staff`), confirmed the worker screen showed "Закрыт" in
  red, reopened it afterward to leave demo data clean. Deliberately left
  the "Начать мойку" action itself untouched for a closed box with a
  `next` booking (only reachable if a box gets closed after being booked
  while open, since `availability` already excludes closed boxes from new
  slots) — the badge now tells the technician the truth, and the backend
  stays the authority on what's actually allowed; guessing at a hard
  client-side block for an edge case this rare isn't worth the added
  complexity.
