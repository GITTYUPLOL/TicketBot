# VM Push/Pull Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single local command that commits all local edits, pushes to GitHub, then pulls and redeploys on the VM.

**Architecture:** Add one bash script at the repo root to orchestrate local git operations and a remote SSH deploy routine. Keep VM runtime model unchanged (`systemd` + `nginx` on port `8001`) and run health checks after restart. Expose command through root `package.json` for repeatable usage.

**Tech Stack:** Bash, Git, SSH, npm scripts, systemd, Nginx

---

### Task 1: Add a failing smoke test for deploy workflow contract

**Files:**
- Create: `scripts/tests/deploy-vm-smoke.sh`

**Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/scripts/deploy-vm.sh"

test -x "$DEPLOY_SCRIPT"
grep -q "git add -A" "$DEPLOY_SCRIPT"
grep -q "git push origin" "$DEPLOY_SCRIPT"
grep -q "git pull --ff-only origin main" "$DEPLOY_SCRIPT"
grep -q "systemctl restart ticketbot-backend ticketbot-frontend nginx" "$DEPLOY_SCRIPT"
```

**Step 2: Run test to verify it fails**

Run: `bash scripts/tests/deploy-vm-smoke.sh`
Expected: FAIL because `scripts/deploy-vm.sh` does not exist yet.

**Step 3: Commit**

```bash
git add scripts/tests/deploy-vm-smoke.sh
git commit -m "test: add deploy workflow smoke test"
```

### Task 2: Implement deploy orchestration script

**Files:**
- Create: `scripts/deploy-vm.sh`

**Step 1: Write minimal implementation**

```bash
#!/usr/bin/env bash
set -euo pipefail
# 1) git add/commit/push locally
# 2) ssh to VM and pull latest main
# 3) install/build only when needed
# 4) restart services and run health checks
```

**Step 2: Run smoke test**

Run: `bash scripts/tests/deploy-vm-smoke.sh`
Expected: PASS

**Step 3: Run script syntax check**

Run: `bash -n scripts/deploy-vm.sh`
Expected: PASS (no syntax errors)

**Step 4: Commit**

```bash
git add scripts/deploy-vm.sh
git commit -m "feat: add local-to-vm deploy script"
```

### Task 3: Expose command and document usage

**Files:**
- Modify: `package.json`
- Modify: `DEPLOYMENT_AGENT.md`

**Step 1: Add npm command**

```json
"deploy:vm": "bash scripts/deploy-vm.sh"
```

**Step 2: Document usage**

Add run examples:
- `npm run deploy:vm -- "commit message"`
- env overrides for host/key/repo/branch

**Step 3: Verify key checks**

Run:
- `bash scripts/tests/deploy-vm-smoke.sh`
- `bash -n scripts/deploy-vm.sh`

Expected: both PASS

**Step 4: Commit**

```bash
git add package.json DEPLOYMENT_AGENT.md
git commit -m "docs: document one-command vm deploy workflow"
```
