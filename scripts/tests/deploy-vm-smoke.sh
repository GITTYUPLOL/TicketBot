#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/scripts/deploy-vm.sh"

test -x "$DEPLOY_SCRIPT"
grep -q "git add -A" "$DEPLOY_SCRIPT"
grep -q "git push origin" "$DEPLOY_SCRIPT"
grep -q "git pull --ff-only origin main" "$DEPLOY_SCRIPT"
grep -q "systemctl restart ticketbot-backend ticketbot-frontend nginx" "$DEPLOY_SCRIPT"
grep -q "for ATTEMPT in \$(seq 1 30)" "$DEPLOY_SCRIPT"
grep -q "sleep 1" "$DEPLOY_SCRIPT"
