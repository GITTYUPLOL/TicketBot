/**
 * SeatGeek data source
 * Uses SeatGeek's public API (no key required for basic queries, key optional for higher limits)
 */

const MS_PER_DAY = 86400000;

function normalizeCountryCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function mapGenre(sgType) {
  if (!sgType) return 'Other';
  const t = sgType.toLowerCase();
  // Sports
  if (t.includes('nfl') || t.includes('football') || t.includes('ncaa_football')) return 'Sports';
  if (t.includes('nba') || t.includes('basketball') || t.includes('ncaa_basketball')) return 'Sports';
  if (t.includes('mlb') || t.includes('baseball')) return 'Sports';
  if (t.includes('nhl') || t.includes('hockey')) return 'Sports';
  if (t.includes('mls') || t.includes('soccer')) return 'Sports';
  if (t.includes('ufc') || t.includes('mma') || t.includes('boxing') || t.includes('wrestling')) return 'Fighting';
  if (t.includes('tennis') || t.includes('golf') || t.includes('racing') || t.includes('nascar')) return 'Sports';
  // Entertainment
  if (t.includes('comedy')) return 'Comedy';
  if (t.includes('theater') || t.includes('theatre') || t.includes('broadway') || t.includes('musical')) return 'Theater';
  if (t.includes('festival')) return 'Festival';
  // Music
  if (t.includes('hip_hop') || t.includes('rap')) return 'Hip-Hop';
  if (t.includes('rock') || t.includes('metal') || t.includes('punk')) return 'Rock';
  if (t.includes('country')) return 'Country';
  if (t.includes('r_and_b') || t.includes('rnb') || t.includes('soul')) return 'R&B';
  if (t.includes('latin') || t.includes('reggaeton')) return 'Latin';
  if (t.includes('edm') || t.includes('electronic') || t.includes('dance')) return 'Electronic';
  if (t.includes('pop') || t.includes('concert') || t.includes('music')) return 'Pop';
  return 'Other';
}

function normalize(sgEvent) {
  const performers = sgEvent.performers || [];
  const primary = performers[0] || {};
  const venue = sgEvent.venue || {};
  const stats = sgEvent.stats || {};

  const eventDate = toIsoDate(sgEvent.datetime_local || sgEvent.datetime_utc);
  if (!eventDate) return null;

  // SeatGeek announce_date is when tickets go on sale
  const onSaleDate = toIsoDate(sgEvent.announce_date) || toIsoDate(sgEvent.visible_until_utc) || eventDate;

  const minPrice = stats.lowest_price || stats.lowest_sg_base_price || 0;
  const maxPrice = stats.highest_price || stats.average_price * 2 || minPrice * 2.5 || 0;
  const avgPrice = stats.average_price || Math.round((minPrice + maxPrice) / 2);
  const faceValue = minPrice > 0 ? minPrice : Math.round(avgPrice * 0.7);

  if (minPrice <= 0 && maxPrice <= 0) return null;

  const score = sgEvent.score || 0; // SeatGeek's own 0-1 popularity score
  const demandScore = Math.round(Math.min(95, Math.max(35, score * 85 + 15)));

  const city = venue.city && venue.state
    ? `${venue.city}, ${venue.state}`
    : venue.city || venue.country || 'Unknown';
  const countryCode = normalizeCountryCode(venue.country || venue.country_code);

  const genre = mapGenre(primary.type || sgEvent.type);

  return {
    source: 'SeatGeek',
    source_event_id: String(sgEvent.id),
    name: sgEvent.short_title || sgEvent.title || 'Unnamed Event',
    artist: primary.name || sgEvent.title || 'Unknown Artist',
    venue: venue.name || 'Unknown Venue',
    city,
    country_code: countryCode,
    date: eventDate,
    time: sgEvent.datetime_local ? sgEvent.datetime_local.slice(11, 16) : '20:00',
    genre,
    image_url: primary.image || sgEvent.image || null,
    face_value: Math.max(25, Math.round(faceValue)),
    min_price: Math.max(25, Math.round(minPrice)),
    max_price: Math.max(Math.round(minPrice) + 10, Math.round(maxPrice)),
    demand_score: demandScore,
    trending: demandScore >= 75 ? 1 : 0,
    on_sale_date: onSaleDate,
    listing_count: stats.listing_count || 0,
    median_price: stats.median_price || avgPrice,
  };
}

async function fetchEvents(options = {}) {
  const {
    clientId,
    daysAhead = 60,
    perPage = 100,
    maxPages = 5,
    geoIp = true,
  } = options;

  const allEvents = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      // Pull all event types — sports, concerts, theater, comedy, etc.
      sort: 'score.desc',
      per_page: String(perPage),
      page: String(page),
      'datetime_utc.gte': new Date().toISOString(),
      'datetime_utc.lte': new Date(Date.now() + daysAhead * MS_PER_DAY).toISOString(),
    });

    // SeatGeek now requires client_id for all requests
    if (clientId) {
      params.set('client_id', clientId);
    } else {
      return {
        provider: 'seatgeek',
        fetched: 0,
        normalized: 0,
        events: [],
        errors: ['SeatGeek requires SEATGEEK_CLIENT_ID. Get one free at https://seatgeek.com/account/develop'],
      };
    }
    if (geoIp) params.set('geoip', 'true');

    try {
      const res = await fetch(`https://api.seatgeek.com/2/events?${params}`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 429) break; // rate limited
        continue;
      }

      const data = await res.json();
      const events = data.events || [];
      allEvents.push(...events);

      if (events.length < perPage) break; // last page
    } catch (err) {
      console.error(`[SeatGeek] Page ${page} error:`, err.message);
      break;
    }
  }

  const normalized = allEvents
    .map(normalize)
    .filter(e => e !== null);

  return {
    provider: 'seatgeek',
    fetched: allEvents.length,
    normalized: normalized.length,
    events: normalized,
  };
}

module.exports = { fetchEvents, normalize };
