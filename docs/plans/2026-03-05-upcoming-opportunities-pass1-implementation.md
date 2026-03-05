# Upcoming Opportunities Pass 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix upcoming opportunity correctness and priority UX issues (window defaults, past-event exclusion, filter reliability, and visual clarity).

**Architecture:** Apply a backend-first correctness patch for upcoming window semantics and sorting, then align frontend defaults/controls and visual polish. Keep dashboard’s 7-day scope while events page defaults to 60 days. Use lightweight smoke tests to enforce required behavior contracts.

**Tech Stack:** Express, SQLite, Next.js App Router, TypeScript, Tailwind, shadcn/ui, Bash smoke tests

---

### Task 1: Add failing smoke tests for pass-1 contracts

**Files:**
- Create: `scripts/tests/upcoming-pass1-smoke.sh`

**Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVENTS_PAGE="$ROOT_DIR/frontend/app/events/page.tsx"
DASHBOARD_PAGE="$ROOT_DIR/frontend/app/dashboard/page.tsx"
EVENTS_ROUTE="$ROOT_DIR/backend/routes/events.js"
ANALYTICS_ROUTE="$ROOT_DIR/backend/routes/analytics.js"

grep -q 'const \[upcomingWindow, setUpcomingWindow\] = useState("60")' "$EVENTS_PAGE"
grep -q 'SelectItem value="60"' "$EVENTS_PAGE"
grep -q 'upcoming_window: "7"' "$DASHBOARD_PAGE"
grep -q "date(date) >= date('now')" "$EVENTS_ROUTE"
grep -q "date(on_sale_date) >= date('now')" "$EVENTS_ROUTE"
grep -q "date(date) >= date('now')" "$ANALYTICS_ROUTE"
```

**Step 2: Run test to verify it fails**

Run: `bash scripts/tests/upcoming-pass1-smoke.sh`
Expected: FAIL before implementation.

### Task 2: Implement backend upcoming-window semantics

**Files:**
- Modify: `backend/routes/events.js`
- Modify: `backend/routes/analytics.js`

**Step 1: Implement minimal backend fix**
- In `events` route:
- when `upcoming_window` is present, require both future on-sale and future event dates.
- include 60-day behavior automatically via numeric window parsing.
- refine on-sale sort to include event date tie-break.
- In `analytics/upcoming-opportunities`:
- accept `upcoming_window` query (default 7).
- require future event date too.

**Step 2: Verify syntax**
Run:
- `node --check backend/routes/events.js`
- `node --check backend/routes/analytics.js`
Expected: PASS.

### Task 3: Implement frontend defaults/filter reliability + visual polish

**Files:**
- Modify: `frontend/app/events/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/EventCard.tsx`
- Modify: `frontend/components/PriceChart.tsx`
- Modify: `frontend/app/events/[id]/page.tsx`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/components/ui/select.tsx`

**Step 1: Implement minimal UI/data changes**
- Events page default window to 60 and add 60 option.
- Dashboard requests upcoming window 7.
- Load filters from `/api/events/filters` endpoint.
- Improve select trigger full-width consistency.
- Integrate face-value pricing block styling.
- Increase dark-mode chart contrast.
- Add subtle gradient texture overlays.

**Step 2: Run smoke test and syntax checks**
Run:
- `bash scripts/tests/upcoming-pass1-smoke.sh`
- `node --check backend/routes/events.js`
- `node --check backend/routes/analytics.js`
Expected: PASS.

### Task 4: Deploy and verify live behavior

**Files:**
- Modify: none

**Step 1: Deploy**
Run:
- `npm run deploy:vm -- "feat: pass1 upcoming opportunities correctness and ui polish"`
Expected: VM pull/build/restart + health checks pass.

**Step 2: Verify live data behavior**
Run:
- force sync live endpoint
- query events endpoint with `upcoming_window=60` and verify non-past on-sale/event dates
- query dashboard upcoming endpoint with `upcoming_window=7`
Expected: dashboard remains 7d; events default supports 60d and excludes stale items.
