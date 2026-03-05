# Upcoming Opportunities Pass 1 Design

**Context date:** March 5, 2026

## Goal
Ship a focused pass that fixes data correctness and UI usability for upcoming opportunities without redesigning the full product architecture.

## Approved Scope
- Dashboard remains 7-day on-sale window.
- Events page defaults to 60-day on-sale window.
- Upcoming opportunities only include records where both event date and on-sale date are today or later.
- Improve face-value pricing presentation so it looks integrated.
- Improve dark-mode chart visibility.
- Add subtle textured imagery behind gradient bars/heroes.
- Improve filter reliability, especially leagues.

## Key Behavior Decisions
1. Upcoming semantics:
- Upcoming means future event + future on-sale.
- Past on-sale events are excluded from upcoming filters.

2. Window policy:
- Dashboard pipeline/leaderboard query uses 7 days.
- Events page default window is 60 days with selectable alternatives.

3. Data reliability:
- Filter options come from backend filters endpoint instead of inferred snapshot-only options.
- On-sale sorting should prioritize soonest on-sale and then soonest event date.

4. Visual direction:
- Keep existing brand gradients and concert feel.
- Add low-opacity texture overlays to gradient sections.
- Increase chart line contrast in dark theme.

## Out of Scope for Pass 1
- Full dashboard “quick view of all pages” redesign.
- Deep ROI model rewrite (historical comparables fully integrated into list-level ROI).
- Confirmation-state pipeline for ticket price certainty.

## Pass 2 Preview
- Integrate historical comparables directly into list endpoint ROI output.
- Add explicit confidence/status fields for price estimates.
- Redesign dashboard into modular quick-view panels across major workflows.
