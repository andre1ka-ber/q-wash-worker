# q-wash-worker

Shift-technician console — what a washer (мастер) sees while working a
box: box cards with pause/resume/start/finish actions, plus today's queue
table with no-show removal. One `worker`-role account, scoped to the one
point they work at (`User.washing_point_id`). Talks only to `q-wash-api`
over its documented HTTP API, via `q-wash-shared`'s API client — no direct
DB access, no private endpoints.

Design and scope decisions live in `PLAN.md`; the phase-by-phase
implementation log (including real browser verification against a live
API) lives in `PROGRESS.md`. Both are the source of truth for this app's
internals — this file is just how to run it.

## Stack

Vite + React 19.2 + TypeScript, `react-router-dom` v7, `@tanstack/react-query`
v5 (`refetchInterval: 8_000` — polling, not SSE; see `PLAN.md`'s "Live
updates" decision for why). Depends on `../q-wash-shared` via a `file:`
dependency for theme tokens, the API client, auth, and common
components — not a workspace, this stays a fully separate top-level
project. Vitest + React Testing Library for tests, oxlint for linting.

## Getting started

```bash
npm install
npm run dev      # needs a running q-wash-api
npm run build    # tsc -b && vite build
```

Log in with a `worker`-role account (username + password via
`POST /auth/login` — see `q-wash-api/README.md` for seeded dev accounts).

## Testing

```bash
npm test          # vitest run
npm run lint       # oxlint
npx tsc -b         # typecheck
```

## Structure

```
src/
  main.tsx, App.tsx      router root, auth gate
  vitest-setup.ts         RTL afterEach(cleanup); kept under src/ so
                          tsconfig.app.json's include: ["src"] picks it up
  features/
    auth/                 login screen
    shift/                 box cards + today's queue table — the one
                           real screen, all pause/resume/start/finish/
                           no-show actions
  shared/
    layout/                Header shell (clock, completed-count)
    useClock.ts             1s Asia/Dushanbe clock/date ticker
    useMyWashingPoint.ts     resolves the logged-in worker's own point
```
