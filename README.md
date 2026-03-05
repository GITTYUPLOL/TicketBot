# Ticketbot - Concert Ticket Scalping Platform

A full-featured ticket scalping UI that aggregates event data from multiple sources, provides analytics on resale trends, and enables automated purchasing with saved payment methods.

## Status

> **v1.1 Complete** - All core features built + accounts, sniper view, dark mode, concert aesthetic.

| Feature | Status |
|---------|--------|
| Backend (Express + SQLite) | Done |
| API Routes (events, tickets, analytics, cards, autobuy, orders, accounts, sniper) | Done |
| Frontend Scaffold (Next.js + Tailwind + shadcn) | Done |
| Event Pages (listing grid + detail w/ price chart) | Done |
| Analytics Dashboard | Done |
| Autobuy Rules Manager | Done |
| Sniper Control Center (browser windows, captcha handling) | Done |
| Platform Accounts (single + bulk import) | Done |
| Profile & Payment Cards | Done |
| Order History | Done |
| Dark Mode + Concert Aesthetic | Done |
| Scraper & Selector Cache (DB schema + seed) | Done |

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Node/Express + SQLite (better-sqlite3)
- **Charts**: Recharts
- **State**: React Context + SWR

## Project Structure

```
/ticketbot
├── /frontend          # Next.js app (port 3000)
├── /backend           # Express API server (port 3001)
├── README.md
└── AGENT.md           # Instructions for AI agents
```

## Environments (Live vs Test)

- Ticketbot now runs two isolated SQLite databases:
  - `backend/ticketbot-live.db` (real/live data only)
  - `backend/ticketbot-test.db` (seeded demo data)
- The UI has a global navbar toggle (`TEST` / `LIVE`) that switches environments.
- Requests include `x-ticketbot-env: test|live`, and backend routes each request to the matching DB.
- Test data is seeded automatically on startup.
- Live data is not auto-seeded.
- Live ingestion uses:
  - `ticketmaster_discovery` (API key required, fully real fields including prices when available)
  - `ticketmaster_web` fallback (no key required, real event/on-sale metadata with estimated price fields)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & Run

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Start both servers (from root)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Backend Only

```bash
cd backend && npm run dev
```

### Frontend Only

```bash
cd frontend && npm run dev
```

### Reset Database

```bash
rm backend/ticketbot-test.db backend/ticketbot-live.db
# Restart backend - it will auto-reseed
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List events (search, filter, sort) |
| GET | `/api/events/:id` | Event detail |
| GET | `/api/events/genres` | List distinct genres |
| GET | `/api/tickets/:eventId` | Ticket listings for event |
| POST | `/api/tickets/:id/purchase` | Purchase a ticket |
| GET | `/api/analytics/trending` | Trending events by demand |
| GET | `/api/analytics/upcoming-opportunities` | Upcoming on-sale opportunities prioritized 7d -> 14d -> 30d with ROI assumptions |
| GET | `/api/analytics/price-history/:eventId` | 30-day price history |
| GET | `/api/analytics/market-heatmap` | Genre/venue heatmap data |
| GET | `/api/analytics/best-time-to-buy/:eventId` | Buy timing recommendation |
| GET | `/api/analytics/supply-demand` | Supply/demand per event |
| GET | `/api/analytics/roi-calculator` | ROI estimates |
| GET | `/api/autobuy` | List autobuy rules |
| POST | `/api/autobuy` | Create autobuy rule |
| PATCH | `/api/autobuy/:id` | Update/toggle rule |
| DELETE | `/api/autobuy/:id` | Delete rule |
| GET | `/api/accounts` | List platform accounts |
| GET | `/api/accounts/platforms` | Supported platforms |
| GET | `/api/accounts/stats` | Account counts per platform |
| POST | `/api/accounts` | Add single account |
| POST | `/api/accounts/bulk` | Bulk import (JSON array) |
| POST | `/api/accounts/bulk-text` | Bulk import (email:pass text) |
| PATCH | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| GET | `/api/sniper/sessions` | Active snipe sessions |
| POST | `/api/sniper/sessions` | Start snipe session |
| PATCH | `/api/sniper/sessions/:id` | Update session status |
| POST | `/api/sniper/sessions/:id/resolve` | Mark captcha/input resolved |
| POST | `/api/sniper/demo` | Create demo snipe sessions |
| GET | `/api/cards` | List saved cards |
| POST | `/api/cards` | Add card |
| PATCH | `/api/cards/:id/default` | Set default card |
| DELETE | `/api/cards/:id` | Remove card |
| GET | `/api/orders` | Order history |
| GET | `/api/orders/stats` | Order statistics |
| GET | `/api/live/providers` | Live-data provider configuration status |
| POST | `/api/live/ingest` | Pull real live events into `live` environment |

## Key Features

### Event Discovery
Browse and search concerts by artist, venue, date. Genre-colored cards with demand scores, trending indicators, and resale ROI potential.

### Price Analytics
Interactive price history charts, trending events, ROI calculator, market heatmap by genre/venue, best-time-to-buy indicators.

### Autobuy System
Three modes:
1. **Price Alert**: Set target price, get notified, one-click buy
2. **Full Auto**: Set criteria, bot auto-purchases when matched
3. **Snipe**: Auto-attempt purchase at on-sale drop time

### Sniper Control Center
Live view of active snipe sessions displayed as browser-style windows. Each session shows:
- Platform-colored header with URL bar
- Real-time status (running, needs input, completed)
- CAPTCHA/verification detection - windows surface automatically when user input needed
- Session log with timestamped entries
- "Alerts only" toggle to hide running sessions and only show those needing attention

### Platform Accounts
- Add accounts for Ticketmaster, StubHub, SeatGeek, AXS, VividSeats, Live Nation
- **Bulk import**: Paste `email:password` lines (one per line) to add many at once
- Platform overview cards with active/total counts
- Toggle accounts active/inactive

### Profile & Payments
Save multiple payment cards, set defaults, assign to autobuy rules. Full purchase history with profit/loss tracking and win rate.

### Dark Mode
Toggle between light and dark themes via the moon/sun icon in the navbar. Dark mode features a concert-venue inspired color palette with fuchsia/violet accents and ambient glow effects.

## Seed Data

The backend ships with 32 realistic concert events, simulated 30-day price histories, demand scores, multiple ticket listings per event, sample accounts across platforms, payment cards, and sample orders. Data is auto-seeded on first run.

## Live Data Ingestion

Required env var:

```bash
TICKETMASTER_API_KEY=<your-ticketmaster-discovery-key>
```

Optional env vars:

```bash
TICKETMASTER_COUNTRY_CODE=US
TICKETMASTER_COUNTRY_CODES=US,CA,GB,AU,DE,FR,ES,NL,IT,BR,MX,JP
TICKETMASTER_MAX_PAGES=10
TICKETMASTER_PAGE_SIZE=200
TICKETMASTER_DAYS_AHEAD=45
SEATGEEK_CLIENT_ID=<optional-for-real-resale-market-data>
PREDICTHQ_ACCESS_TOKEN=<optional-for-broad-cross-category-event-feed>
```

Run one-time live sync (from `backend/`):

```bash
npm run ingest:live
```

This runs both providers by default (`ticketmaster_discovery`, `ticketmaster_web`).

Or use API (must be in live env via navbar toggle):

```bash
curl -X POST http://localhost:3001/api/live/ingest \
  -H "Content-Type: application/json" \
  -H "x-ticketbot-env: live" \
  -d '{"providers":["ticketmaster_discovery","ticketmaster_web"],"max_pages":10,"days_ahead":45}'
```

Recommended cached sync endpoint (avoids re-pulling providers on every reload):

```bash
curl -X POST http://localhost:3001/api/live/sync \
  -H "Content-Type: application/json" \
  -H "x-ticketbot-env: live" \
  -d '{"ttl_minutes":30,"max_pages":12,"days_ahead":60,"providers":["ticketmaster_discovery","ticketmaster_web","seatgeek_resale"],"categories":["concerts","sports","theater","comedy","family"]}'
```

Category/league/region filter metadata for UI:

```bash
curl -H "x-ticketbot-env: live" http://localhost:3001/api/events/filters
```

## Google Cloud Ubuntu Deployment (Single VM)

Use env-based runtime config for production:

```bash
# backend
cd backend
HOST=0.0.0.0 PORT=3001 TICKETMASTER_API_KEY=<your-key> npm start

# frontend (from /frontend)
NEXT_PUBLIC_API_URL=http://<your-vm-ip>:3001/api npm run build
NEXT_PUBLIC_API_URL=http://<your-vm-ip>:3001/api npm start -- -H 0.0.0.0 -p 3000
```

- Open firewall ports for `3000` (frontend) and `3001` (API), or put both behind nginx.
