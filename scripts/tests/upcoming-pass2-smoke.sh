#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROI_SERVICE="$ROOT_DIR/backend/services/roiProjection.js"
EVENTS_ROUTE="$ROOT_DIR/backend/routes/events.js"
ANALYTICS_ROUTE="$ROOT_DIR/backend/routes/analytics.js"
DASHBOARD_PAGE="$ROOT_DIR/frontend/app/dashboard/page.tsx"
EVENT_CARD="$ROOT_DIR/frontend/components/EventCard.tsx"

grep -q "function buildRoiProjection" "$ROI_SERVICE"
grep -q "price_estimate_status" "$ROI_SERVICE"
grep -q "buildRoiProjection" "$EVENTS_ROUTE"
grep -q "router.get('/quick-view'" "$ANALYTICS_ROUTE"
grep -q "getDashboardQuickView" "$DASHBOARD_PAGE"
grep -q "Workflow Quick View" "$DASHBOARD_PAGE"
grep -q "Modeled Price Bands" "$EVENT_CARD"

echo "Pass 2 smoke checks passed."
