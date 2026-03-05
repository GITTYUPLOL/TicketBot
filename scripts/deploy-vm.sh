#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VM_HOST="${TICKETBOT_VM_HOST:-azureuser@172.174.246.226}"
SSH_KEY="${TICKETBOT_SSH_KEY:-$HOME/.ssh/mySSHKey}"
REMOTE_REPO="${TICKETBOT_REMOTE_REPO:-/opt/ticketbot}"
DRY_RUN="${DRY_RUN:-0}"

if [ $# -gt 0 ]; then
  COMMIT_MESSAGE="$*"
else
  COMMIT_MESSAGE="chore: deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

run_cmd() {
  echo "+ $*"
  if [ "$DRY_RUN" != "1" ]; then
    "$@"
  fi
}

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: run deploy from main branch. Current branch: $CURRENT_BRANCH" >&2
  exit 1
fi

run_cmd git add -A
if git diff --cached --quiet; then
  echo "No local changes detected; skipping commit."
else
  run_cmd git commit -m "$COMMIT_MESSAGE"
fi
run_cmd git push origin main

REMOTE_SCRIPT=$(cat <<'EOF'
set -euo pipefail

cd "$REMOTE_REPO"

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: /opt/ticketbot has uncommitted changes. Commit or clean VM repo first." >&2
  exit 1
fi

OLD_REV="$(git rev-parse HEAD)"
git fetch origin
git checkout main
git pull --ff-only origin main
NEW_REV="$(git rev-parse HEAD)"

CHANGED_FILES=""
if [ "$OLD_REV" != "$NEW_REV" ]; then
  CHANGED_FILES="$(git diff --name-only "$OLD_REV" "$NEW_REV")"
fi

NEED_BACKEND_INSTALL=0
NEED_FRONTEND_INSTALL=0
NEED_FRONTEND_BUILD=0

if [ ! -d backend/node_modules ] || printf '%s\n' "$CHANGED_FILES" | grep -Eq '^backend/(package\.json|package-lock\.json)$'; then
  NEED_BACKEND_INSTALL=1
fi

if [ ! -d frontend/node_modules ] || printf '%s\n' "$CHANGED_FILES" | grep -Eq '^frontend/(package\.json|package-lock\.json)$'; then
  NEED_FRONTEND_INSTALL=1
fi

if [ ! -d frontend/.next ] || printf '%s\n' "$CHANGED_FILES" | grep -Eq '^frontend/'; then
  NEED_FRONTEND_BUILD=1
fi

if [ "$NEED_BACKEND_INSTALL" -eq 1 ]; then
  cd backend
  npm ci
  cd ..
fi

if [ "$NEED_FRONTEND_INSTALL" -eq 1 ]; then
  cd frontend
  npm ci
  cd ..
fi

if [ "$NEED_FRONTEND_BUILD" -eq 1 ]; then
  cd frontend
  npm run build
  cd ..
fi

sudo systemctl restart ticketbot-backend ticketbot-frontend nginx
systemctl is-active ticketbot-backend ticketbot-frontend nginx

READY=0
for ATTEMPT in $(seq 1 30); do
  DASHBOARD_CODE="$(curl -s -o /tmp/ticketbot-dashboard.html -w '%{http_code}' http://127.0.0.1:8001/dashboard || true)"
  HEALTH_RESPONSE="$(curl -s http://127.0.0.1:8001/api/proxy/health || true)"

  if [ "$DASHBOARD_CODE" = "200" ] && printf '%s' "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    printf '%s' "$HEALTH_RESPONSE" >/tmp/ticketbot-health.json
    READY=1
    break
  fi

  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Error: service did not become healthy in time." >&2
  echo "Last dashboard status: $DASHBOARD_CODE" >&2
  exit 1
fi

echo "VM health: $(cat /tmp/ticketbot-health.json)"
EOF
)

if [ "$DRY_RUN" = "1" ]; then
  echo "+ ssh -i $SSH_KEY $VM_HOST REMOTE_REPO=$REMOTE_REPO bash -s"
  echo "$REMOTE_SCRIPT"
else
  ssh -i "$SSH_KEY" "$VM_HOST" "REMOTE_REPO='$REMOTE_REPO' bash -s" <<<"$REMOTE_SCRIPT"
fi
