# Ticketbot Deployment Agent Guide

Use this guide for all server deploys. Do not improvise ad-hoc commands.

## Deployment Policy

- Deploy from GitHub only: `https://github.com/GITTYUPLOL/TicketBot.git` on `main`.
- Never upload local folders with `scp` for normal deploys.
- Never deploy local `node_modules`, `.env*`, or `backend/*.db*`.
- Keep backend internal (`127.0.0.1:3001`) and expose only Nginx on `0.0.0.0:8001`.
- Run app processes under `systemd` with restart policies.

## Server Layout

- Repo path: `/opt/ticketbot`
- Backend service: `ticketbot-backend.service`
- Frontend service: `ticketbot-frontend.service`
- Nginx site file: `/etc/nginx/sites-available/ticketbot`
- Env files:
  - `/etc/ticketbot/backend.env`
  - `/etc/ticketbot/frontend.env`

## First-Time Provisioning (VM)

```bash
sudo apt-get update
sudo apt-get install -y nginx git
```

Install Node.js 22 LTS if missing/outdated.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Deploy/Update Procedure

1. Refresh code:

```bash
sudo mkdir -p /opt
sudo chown -R "$USER":"$USER" /opt
cd /opt
if [ ! -d /opt/ticketbot/.git ]; then
  git clone https://github.com/GITTYUPLOL/TicketBot.git ticketbot
fi
cd /opt/ticketbot
git fetch origin
git checkout main
git pull --ff-only origin main
```

2. Install dependencies and build:

```bash
cd /opt/ticketbot/backend && npm ci
cd /opt/ticketbot/frontend && npm ci && npm run build
```

3. Ensure env files exist:

`/etc/ticketbot/backend.env`

```bash
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
TICKETMASTER_API_KEY=<set-if-available>
PREDICTHQ_ACCESS_TOKEN=<set-if-available>
```

`/etc/ticketbot/frontend.env`

```bash
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
BACKEND_URL=http://127.0.0.1:3001/api
```

4. Restart runtime:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ticketbot-backend ticketbot-frontend nginx
sudo systemctl enable ticketbot-backend ticketbot-frontend nginx
```

## One-Command Local Push/Pull Deploy

Run from local repo root:

```bash
npm run deploy:vm -- "feat: your commit message"
```

Behavior:
- Runs `git add -A`
- Commits all current local edits (if any)
- Pushes `main` to GitHub
- SSHes into VM and runs `git pull --ff-only origin main`
- Reinstalls deps only when lockfiles change
- Rebuilds frontend only when `frontend/` changed
- Restarts `ticketbot-backend`, `ticketbot-frontend`, `nginx`
- Runs health checks on `/dashboard` and `/api/proxy/health`

Optional env overrides:

```bash
TICKETBOT_VM_HOST=azureuser@172.174.246.226 \
TICKETBOT_SSH_KEY=~/.ssh/mySSHKey \
TICKETBOT_REMOTE_REPO=/opt/ticketbot \
npm run deploy:vm -- "chore: deploy"
```

Local smoke-test for deploy contract:

```bash
npm run deploy:vm:smoke
```

## Required Smoke Checks

Run all checks after each deploy:

```bash
systemctl is-active ticketbot-backend ticketbot-frontend nginx
curl -I http://127.0.0.1:8001
curl -s http://127.0.0.1:8001/api/proxy/health
```

Expected:
- all services `active`
- homepage returns HTTP `200`
- health returns JSON with `"status":"ok"`

## Troubleshooting

- Check logs:

```bash
journalctl -u ticketbot-backend -n 200 --no-pager
journalctl -u ticketbot-frontend -n 200 --no-pager
sudo nginx -t
```

- If `http://SERVER_IP:8001` fails externally but local curl works:
  - Verify Azure NSG inbound rule allows TCP `8001`.
  - Verify VM firewall allows `8001` (if UFW enabled).

## Cost/Time Guardrails

- Do not reinstall OS packages unless required.
- Do not run repeated `npm install`; use `npm ci`.
- Do not rebuild frontend unless code/deps changed.
- Keep logs bounded with journalctl rotation defaults; avoid custom verbose logging unless debugging.
