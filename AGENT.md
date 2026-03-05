# AGENT.md - Instructions for AI Agents

This file provides context and instructions for AI agents working on the Ticketbot codebase.

## Project Overview

Ticketbot is a concert ticket scalping platform with a Next.js frontend and Express/SQLite backend. It aggregates event data, provides price analytics, and supports automated ticket purchasing with a sniper system and multi-platform account management.

## Product Direction

The core workflow is a **pipeline**: Research upcoming drops → Pick winners → Auto-queue snipe sessions.

### Focus priorities (strict order)
1. **Upcoming on-sales** over historical analysis — always surface what's dropping soon first.
2. Rank opportunities: 7-day window (primary) → 14-day → 30-day (fallback).
3. Every opportunity must show ROI with explicit assumptions:
   - projected entry price, projected resale price, estimated fees/cost basis
   - confidence level (`high`/`medium`/`low`)
4. If ROI can't be estimated confidently, call out missing inputs and ask before recommending.

### ROI methodology (layered)
- **Layer 1 — Historical comparables**: Past events by same artist, venue, or genre provide baseline projected resale price.
- **Layer 2 — Live market signals**: Current StubHub/SeatGeek resale listings for similar events adjust the estimate.
- Manual override is always available per event.

### Snipe readiness
Every upcoming event should expose a **readiness score** (go/no-go checklist):
- Platform accounts linked for target site(s)
- Payment card assigned
- Autobuy/snipe rule created
- Selectors cached for target platform(s)
The event detail page shows this checklist with quick-action buttons to fix missing items.

### Dashboard default
ROI leaderboard — ranked list of upcoming on-sales by projected ROI, each row showing the readiness score and on-sale countdown.

## Qualifying Questions Gate (Moderate/Big Changes)

Before implementing, ask concise qualifying questions and wait for user confirmation whenever any trigger below is true:
- The change touches 5 or more files
- The change alters user-facing behavior
- The change modifies an API contract
- The change modifies database/schema behavior
- The change updates ROI or scoring logic

Qualifying questions should cover:
- Desired outcome and success criteria
- Constraints (speed, risk tolerance, timeline)
- Acceptable tradeoffs

## Architecture

- **Frontend** (`/frontend`): Next.js 14 App Router, Tailwind CSS, shadcn/ui, Recharts, SWR
- **Backend** (`/backend`): Express.js, better-sqlite3, Puppeteer (scrapers)
- Frontend runs on port 3000, backend on port 3001
- Frontend calls backend API via `/lib/api.ts`
- Dark mode supported via `.dark` class on `<html>`, toggled in Navbar

## Directory Layout

```
/frontend/app/
  /dashboard         → Analytics dashboard with trending, charts, heatmap, ROI
  /events            → Event listing grid with search/filter
  /events/[id]       → Event detail with price chart, ticket listings, buy
  /autobuy           → Autobuy rules manager (alert, auto, snipe modes)
  /sniper            → Live sniper control center with browser-style windows
  /accounts          → Platform accounts manager with bulk import
  /orders            → Order history with P/L tracking
  /profile           → Profile + payment card management
/frontend/components/
  Navbar.tsx          → Top nav with dark mode toggle, concert-themed branding
  EventCard.tsx       → Event card with genre gradient, demand badge, ROI
  PriceChart.tsx      → Recharts area/line chart for price history
  DemandBadge.tsx     → Score badge (Flame/TrendingUp/Snowflake icons)
  AutobuyRuleForm.tsx → Form for creating autobuy rules
  PaymentCardForm.tsx → Form for adding payment cards
/frontend/lib/
  api.ts              → ALL backend API calls (events, tickets, analytics, autobuy, accounts, sniper, cards, orders)
  utils.ts            → cn() utility for classnames
/backend/
  server.js           → Express entry point, route registration
  db.js               → SQLite schema (all tables)
  /routes/
    events.js         → Event CRUD + search/filter/sort
    tickets.js        → Ticket listings + purchase
    analytics.js      → Trending, price history, heatmap, ROI, supply-demand, best-time
    autobuy.js        → Autobuy rules CRUD
    accounts.js       → Platform accounts CRUD + bulk import (JSON + text format)
    sniper.js         → Snipe sessions CRUD + resolve input + demo data
    cards.js          → Payment cards CRUD
    orders.js         → Order history + stats
  /data/seed.js       → Seed data (32 events, price histories, accounts, cards, orders, selectors)
```

## Database Tables

SQLite via better-sqlite3. Schema in `/backend/db.js`:
- `events` — concert events (artist, venue, date, genre, prices, demand_score)
- `tickets` — per-event listings from multiple sources with prices
- `price_history` — 30-day daily price snapshots per event
- `autobuy_rules` — rules with mode (alert/auto/snipe), criteria, execution log
- `accounts` — platform accounts (ticketmaster, stubhub, seatgeek, axs, vividseats, livenation)
- `snipe_sessions` — active snipe sessions with status, needs_input flag, log
- `cards` — saved payment methods (mock data only)
- `orders` — purchase history with P/L tracking
- `scraped_selectors` — cached CSS selectors per site/page type

## Code Conventions

- **Backend**: CommonJS (`require`/`module.exports`), Express route handlers
- **Frontend**: TypeScript, all pages use `"use client"` (interactive)
- **Styling**: Tailwind utility classes, shadcn/ui components, fuchsia/violet concert theme
- **API client**: ALL backend calls go through `/frontend/lib/api.ts`
- **Dark mode**: Toggle in Navbar, persisted to localStorage, uses `.dark` class on `<html>`
- **Aesthetic**: Concert/musical vibe — gradient headers, glow effects, Music/Flame/Ticket icons
- **Cards**: Use `glow-card` class on Cards for hover glow effect in dark mode

## Key Patterns

### Adding a new API route
1. Create route file in `/backend/routes/`
2. Register in `/backend/server.js` with `app.use('/api/...', require('./routes/...'))`
3. Add corresponding function(s) in `/frontend/lib/api.ts`

### Adding a new page
1. Create directory in `/frontend/app/<pagename>/`
2. Add `page.tsx` with `"use client"` directive
3. Add gradient hero header at top matching existing pages
4. Add nav item in `/frontend/components/Navbar.tsx` navItems array
5. Use loading state with `<Music className="animate-bounce" />`

### Bulk operations
The accounts system supports two bulk import formats:
- **JSON**: POST `/api/accounts/bulk` with `{ accounts: [{platform, email, password, username}] }`
- **Text**: POST `/api/accounts/bulk-text` with `{ platform, text }` where text is `email:password` per line

### Sniper sessions
- Sessions track browser state: running, needs_input, completed
- `needs_input` flag + `input_type` (captcha/verification) triggers alert UI
- POST `/api/sniper/sessions/:id/resolve` marks input as resolved
- POST `/api/sniper/demo` creates 3 sample sessions for testing

## Running

```bash
npm run dev           # Both servers (from root)
cd backend && npm run dev    # Backend only
cd frontend && npm run dev   # Frontend only
```

## Common Tasks

### Reset database
Delete `/backend/ticketbot-test.db` and `/backend/ticketbot-live.db` and restart backend. Test auto-reseeds.

### Add a shadcn component
```bash
cd frontend && npx shadcn@latest add <component-name>
```

### Modify seed data
Edit `/backend/data/seed.js`

## Important Notes

- Demo project — no real payments or browser automation
- Account passwords stored as plaintext mock data (no real auth)
- Sniper "browser windows" are UI representations, not actual embedded browsers
- Price histories are pre-seeded with 30 days of simulated data
- Supported platforms: ticketmaster, stubhub, seatgeek, axs, vividseats, livenation
- Always check README.md for current feature status
