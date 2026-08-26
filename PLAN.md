# q-wash-worker — Plan

Source design: Claude Design project "Car wash queue app"
(`Car Wash Web Apps.dc.html`), the "Приложение мастера" tab, imported
2026-08-20. Backend: `../q-wash-api`, extended per
`../q-wash-api/docs/PLAN_WEB_APPS.md` — blocked on that plan's phase 7
(worker role + live-boxes endpoint + pause/resume + broadened cancel RBAC).

**Update 2026-08-22**: build started. Re-checked `PLAN_WEB_APPS.md` first
(same check that let q-wash-cabinet skip straight to real data on two of
its tabs) — phase 6 (`Box` entity) and phase 7 (worker RBAC/live-boxes/
pause/resume) are **both** still `[ ]`, unlike cabinet's case, so this app
really is still blocked on real data for its one screen. Confirmed, not
just read off the doc: `worker` can log in and call `GET /me` (`auth
service.LoginWithPassword` allows the role), but every management route
this screen needs — `wpHandler`, `queueHandler`, everything under
`requireStaff` in `internal/app/app.go` — only allows `staff`/`admin`
(`auth.RequireRole(string(user.RoleStaff), string(user.RoleAdmin))`), so a
real worker account 403s on all of them today. Built Phases A and B only,
per the plan below — mock data for the box cards/queue table, real auth.
Added a seeded `worker` account to `q-wash-api/cmd/seed` (`worker` /
`worker12345`, scoped to the seed washing point) so this app's actual auth
flow is testable end to end even though the rest of the API isn't reachable
for that role yet — see `q-wash-api/PROGRESS.md`.

Shift-technician console — what a washer actually looks at while working a
box. Renamed from the original "washer-app" naming: the mock's own label
is "мастер" (master/technician), and "washer" reads as the machine, not the
person operating it.

## What the design actually is

Header: point name, master's own name + date, a live clock, a
today's-completed-count badge. Below it, two panes:

1. **Box cards** (one per box, grid): each shows box name + state text +
   badge (В работе / Пауза / Свободен). A **busy** box shows the current
   customer's car+plate+client name, the queue ticket (e.g. "A-14"),
   service+slot, an elapsed-time progress bar, and two actions
   (Пауза/Продолжить, Завершить). A **free** box shows the next scheduled
   booking's name/info and a "Начать мойку {ticket}" action.
2. **Очередь на сегодня (today's queue)** — a flat table below the box
   cards: ticket, car+plate, service, time, status pill (Ждёт/
   Подтверждена/Не приехал), and a per-row action where relevant
   (Начать / Снять).

The mock's box-state transitions (`washing ⇄ paused`, `free -> washing`)
map directly onto the `paused_at` field and `PATCH /queue/{id}/status`
from `PLAN_WEB_APPS.md`; "Снять" (remove a no-show) maps onto the
broadened `PATCH /queue/{id}/cancel` RBAC in the same doc.

## Decisions locked in (with the user)

- **Framework**: Vite + React + TypeScript.
- **Shared package**: depends on `../q-wash-shared` via `file:` dependency.
- **Fidelity**: close visual port, same bar as the other three apps.
- **Auth**: username + password, new `worker` role, scoped to one point via
  `User.washing_point_id` — same login mechanism as staff/admin, per
  `PLAN_WEB_APPS.md`'s explicit decision not to build a separate
  PIN-per-box kiosk login for v1.
- **Device context**: built as a normal authenticated web app (one worker,
  one login), not a shared-kiosk-with-box-picker — the mock doesn't show a
  box-selection or device-pairing step, it just shows all of a point's
  boxes to whoever's logged in. Revisit if the real usage pattern turns
  out to be "one shared tablet per box" rather than "one master's own
  device seeing all boxes."
- **Live updates**: poll rather than SSE for v1 — this app's own state
  changes (starting/pausing/finishing a wash) are the primary driver of
  what's on screen, unlike the customer queue screen or the display board
  where *other* actors changing things live is the whole point. A
  reasonable poll interval (mirroring `pegasus-board`'s 8s) plus
  refetch-on-own-mutation covers the real need; add SSE later only if a
  second worker's actions on another box need to show up without a manual
  refresh and polling proves too laggy for that.

## App architecture

```
q-wash-worker/
  PLAN.md
  PROGRESS.md
  package.json          depends on q-wash-shared via file:../q-wash-shared
  vite.config.ts
  src/
    main.tsx
    App.tsx               router root, auth gate
    features/
      auth/                 login screen
      shift/                 the one real screen: box cards + today's
                             queue table, all the pause/resume/start/
                             finish/no-show actions
    shared/
      layout/                Header shell (clock, completed-count) specific
                             to this app
```

- **Routing**: `react-router`, essentially a single-screen app behind
  auth — no nav beyond login/logout.
- **Data/server-state**: `@tanstack/react-query`, `refetchInterval` on the
  live-boxes and today's-queue queries, optimistic-friendly mutations for
  the action buttons (the mock's own local `setState` calls suggest the
  actions should feel instant, not spinner-gated).
- **Localization**: Russian only, matching the mock.

## Phased build order

- [x] **A — Scaffold**: Vite react-ts, `q-wash-shared` wired in, theme
      applied, auth. No design-system access this session (the mock
      project isn't a writable design-system-type project, see
      `PROGRESS.md`), so the header/login chrome is ported from
      `q-wash-cabinet`'s already-built pattern (same visual language, same
      component primitives) rather than pixel-read off the `.dc.html`
      source directly.
- [x] **B — Screen against mock data**: box cards (busy/free variants) +
      today's queue table, built from this doc's plain-English design
      description (no direct mock access, see A's note) — actions wired to
      local `useState` only, no `.dc.html` source to mirror against. Local
      1s ticker (`useClock`) drives both the header clock and every busy
      box's elapsed-time bar.
- [x] **C — Wire to real `q-wash-api`**: built 2026-08-26, both phases 6/7
      confirmed shipped by this point (`q-wash-cabinet`'s Боксы tab and the
      full integration suite verified phase 6/7 against real Postgres
      earlier the same session — see `q-wash-api/PROGRESS.md`). All four
      endpoints wired: `GET .../boxes/live`, `GET .../queue?date=`,
      `PATCH /queue/{id}/status|/pause|/resume|/cancel`. See `PROGRESS.md`
      for the real gaps found between the mock and the actual API response
      shapes (no ticket/plate/full-name, one-step-at-a-time status
      transitions) and how each was resolved with the user.
- [x] **D — Live polling**: `refetchInterval: 8_000` on both the
      boxes-live and today's-queue queries (mirrors `pegasus-board`'s own
      cadence, per this doc's original "Live updates" decision). The local
      1s `useClock()` ticker still drives the progress bar between polls —
      elapsed time is now derived from `scheduled_start_at`/`paused_at`
      (server-sourced), not simulated client state, so it stays correct
      across a refetch instead of jumping.
- [x] **E — Polish**: done alongside C/D rather than as a separate pass.
      Loading states (`Загрузка…`) and empty states already existed from
      Phase B, kept as-is. Confirm-before-cancel: no native `confirm()`
      dialog (session-wide no-dialogs rule) — first "Снять" click turns
      the button into "Точно снять?" plus an "Отмена" button, second click
      fires the real cancel. Poll-failure banner: a "Переподключение…"
      banner shows above the board when a refetch fails but stale data is
      still on screen; a full error state shows only if the very first
      load fails.

`tsc -b`, `oxlint`, and `vite build` are clean for Phases A–E (also
re-checked `q-wash-admin`/`q-wash-cabinet` still typecheck against the
shared-package additions this phase made — both clean, no regressions).

**2026-08-26**: Phase C/D/E's actual start/pause/resume/finish/cancel
chain was verified against the real running API via direct HTTP calls
(logged in as the seeded `worker` account, walked a real booking through
queue→waiting→washing→pause→resume→ready, and canceled another one while
still `queue`) — every response matched what the frontend code expects,
including the two 409 conflict codes (`cannot_pause`, `cannot_cancel`)
newly added to `q-wash-shared`'s Russian error map.

**Real browser verification done later the same day**, once the
`claude-in-chrome` extension reconnected. Found and fixed one real UI bug
this pass: the box card's "next booking" button was labeled "Поставить в
очередь" when the booking was still `queue`-status, implying a
single-step transition — but the approved chained-`startMutation` always
carries it all the way to `washing` regardless of starting status, so the
label was describing the wrong outcome. Fixed to always read "Начать
мойку" (see `BoxCard.tsx`). Confirmed live in the browser against real
customer-created bookings scheduled for today (not the seed data, which
is dated tomorrow): one-click start chained queue→washing correctly,
pause froze the elapsed-time bar exactly at its paused value (verified
across two zoomed screenshots 4s apart) and resume picked real elapsed
time back up, finish freed the box and incremented "Помыто сегодня", and
the two-click "Снять" confirm (Отмена correctly aborts back to a plain
"Снять" state) removed a booking cleanly. Logged in as both `staff` and
the actual `worker` role account and confirmed both render/act
identically (this screen's `requireQueueOps` gate covers both). No
console errors on any of it. Test bookings and a temporary
`scheduled_start_at` backdate (used to make elapsed-time actually tick
during verification, since the seed data's own bookings are scheduled for
tomorrow) were cleaned up afterward via `make seed`.

Progress against this list, decisions made along the way, and anything
discovered that changes the plan are logged in `PROGRESS.md` as work
happens.
