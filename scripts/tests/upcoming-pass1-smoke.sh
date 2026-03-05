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
