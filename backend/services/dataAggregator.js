/**
 * Multi-source data aggregator
 * Pulls from all available sources, deduplicates, scores, and stores events.
 * Builds historical intelligence over time.
 */

const db = require('../db');

async function aggregateFromAllSources(options = {}) {
  const result = {
    started_at: new Date().toISOString(),
    providers: [],
    totals: { fetched: 0, normalized: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
  };

  const providers = options.providers || ['ticketmaster', 'seatgeek', 'bandsintown'];

  // Fetch from each source in parallel where possible
  const fetches = [];

  if (providers.includes('ticketmaster')) {
    fetches.push(fetchTicketmaster(options));
  }
  if (providers.includes('seatgeek')) {
    fetches.push(fetchSeatGeek(options));
  }
  if (providers.includes('bandsintown')) {
    fetches.push(fetchBandsInTown(options));
  }

  const results = await Promise.allSettled(fetches);

  const allEvents = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      result.providers.push({
        provider: r.value.provider,
        fetched: r.value.fetched,
        normalized: r.value.normalized,
        errors: r.value.errors || [],
      });
      result.totals.fetched += r.value.fetched;
      result.totals.normalized += r.value.normalized;
      allEvents.push(...(r.value.events || []));
    } else {
      result.providers.push({
        provider: 'unknown',
        fetched: 0,
        normalized: 0,
        errors: [r.reason?.message || 'Provider failed'],
      });
      result.totals.errors += 1;
    }
  }

  // Deduplicate across sources by artist + venue + date
  const deduped = deduplicateEvents(allEvents);

  // Upsert into database
  const writes = upsertEvents(deduped);
  result.totals.inserted = writes.inserted;
  result.totals.updated = writes.updated;
  result.totals.skipped = writes.skipped;

  // Update price history
  updatePriceHistory(deduped);

  // Update demand intelligence
  updateDemandIntelligence();

  result.completed_at = new Date().toISOString();
  result.unique_events = deduped.length;

  return result;
}

async function fetchTicketmaster(options) {
  const apiKey = options.ticketmasterApiKey || process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return { provider: 'ticketmaster', fetched: 0, normalized: 0, events: [], errors: ['No API key'] };
  }

  try {
    const { ingestLiveData } = require('./liveIngestion');
    // Use existing Ticketmaster service but capture events before DB write
    const daysAhead = options.daysAhead || 60;
    const maxPages = options.maxPages || 5;

    const params = new URLSearchParams({
      apikey: apiKey,
      countryCode: options.countryCode || 'US',
      size: '200',
      page: '0',
      sort: 'date,asc',
      // TM requires ISO without milliseconds
      startDateTime: new Date().toISOString().replace(/\.\d{3}Z/, 'Z'),
      endDateTime: new Date(Date.now() + daysAhead * 86400000).toISOString().replace(/\.\d{3}Z/, 'Z'),
      includeTBA: 'no',
      includeTBD: 'no',
      // Pull all event types — sports, concerts, theater, comedy, etc.
    });

    const allEvents = [];
    let pagesFetched = 0;
    let totalPages = 1;

    while (pagesFetched < maxPages && pagesFetched < totalPages) {
      params.set('page', String(pagesFetched));
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) break;
      const data = await res.json();
      const events = data?._embedded?.events || [];
      const reported = Number(data?.page?.totalPages);
      if (Number.isFinite(reported) && reported > 0) totalPages = reported;

      allEvents.push(...events);
      pagesFetched++;
      if (events.length === 0) break;
    }

    // Normalize using existing transform
    const { default: liveModule } = { default: require('./liveIngestion') };
    const normalized = allEvents.map(tmEvent => {
      return normalizeTicketmaster(tmEvent);
    }).filter(Boolean);

    return {
      provider: 'ticketmaster',
      fetched: allEvents.length,
      normalized: normalized.length,
      events: normalized,
    };
  } catch (err) {
    return { provider: 'ticketmaster', fetched: 0, normalized: 0, events: [], errors: [err.message] };
  }
}

function normalizeTicketmaster(tm) {
  const venue = tm?._embedded?.venues?.[0];
  const attraction = tm?._embedded?.attractions?.[0];
  const classification = tm?.classifications?.[0];
  const salesPublic = tm?.sales?.public;
  const start = tm?.dates?.start;
  const statusCode = tm?.dates?.status?.code || 'onsale';

  const eventDate = start?.localDate;
  const onSaleDate = salesPublic?.startDateTime ? new Date(salesPublic.startDateTime).toISOString().split('T')[0] : null;
  if (!eventDate) return null;

  const minPrices = (tm?.priceRanges || []).map(r => Number(r?.min)).filter(Number.isFinite);
  const maxPrices = (tm?.priceRanges || []).map(r => Number(r?.max)).filter(Number.isFinite);
  const minPrice = minPrices.length ? Math.min(...minPrices) : 0;
  const maxPrice = maxPrices.length ? Math.max(...maxPrices) : 0;

  if (minPrice <= 0 && maxPrice <= 0) return null;

  const segment = classification?.segment?.name || '';
  const subGenre = classification?.genre?.name || classification?.subGenre?.name || '';
  const genre = segment || subGenre || 'Other';
  const faceValue = Math.max(25, Math.round(minPrice || maxPrice * 0.5));

  const cityName = venue?.city?.name || 'Unknown';
  const state = venue?.state?.stateCode || venue?.country?.countryCode || '';
  const city = state ? `${cityName}, ${state}` : cityName;

  let demandScore = 56;
  if (statusCode === 'onsale') demandScore += 10;
  if (minPrice > 0 && maxPrice > minPrice && maxPrice / minPrice >= 2) demandScore += 12;
  demandScore = Math.min(95, Math.max(35, demandScore));

  return {
    source: 'Ticketmaster',
    source_event_id: tm?.id || null,
    name: tm?.name || 'Unnamed Event',
    artist: attraction?.name || tm?.name || 'Unknown Artist',
    venue: venue?.name || 'Unknown Venue',
    city,
    date: eventDate,
    time: start?.localTime?.slice(0, 5) || '20:00',
    genre: mapGenreSimple(genre),
    image_url: pickBestImage(tm?.images),
    face_value: faceValue,
    min_price: Math.max(25, Math.round(minPrice)),
    max_price: Math.max(Math.round(minPrice) + 10, Math.round(maxPrice)),
    demand_score: demandScore,
    trending: demandScore >= 75 ? 1 : 0,
    on_sale_date: onSaleDate || eventDate,
    ticket_count: tm?.ticketLimit?.info ? 1 : 0,
  };
}

function mapGenreSimple(g) {
  if (!g) return 'Other';
  const l = g.toLowerCase();
  // Sports
  if (l.includes('nfl') || l.includes('football') || l === 'sports') return 'Sports';
  if (l.includes('nba') || l.includes('basketball')) return 'Sports';
  if (l.includes('mlb') || l.includes('baseball')) return 'Sports';
  if (l.includes('nhl') || l.includes('hockey')) return 'Sports';
  if (l.includes('mls') || l.includes('soccer') || l.includes('football')) return 'Sports';
  if (l.includes('ufc') || l.includes('mma') || l.includes('boxing') || l.includes('wrestling')) return 'Fighting';
  if (l.includes('tennis') || l.includes('golf') || l.includes('racing') || l.includes('motorsport')) return 'Sports';
  // Entertainment
  if (l.includes('comedy') || l.includes('standup')) return 'Comedy';
  if (l.includes('theater') || l.includes('theatre') || l.includes('broadway') || l.includes('musical')) return 'Theater';
  if (l.includes('festival')) return 'Festival';
  // Music genres
  if (l.includes('hip') || l.includes('rap')) return 'Hip-Hop';
  if (l.includes('rock') || l.includes('metal') || l.includes('punk') || l.includes('alternative')) return 'Rock';
  if (l.includes('country')) return 'Country';
  if (l.includes('r&b') || l.includes('soul')) return 'R&B';
  if (l.includes('latin') || l.includes('reggae')) return 'Latin';
  if (l.includes('edm') || l.includes('electronic') || l.includes('dance')) return 'Electronic';
  if (l.includes('pop') || l.includes('music') || l.includes('concert')) return 'Pop';
  if (l.includes('arts')) return 'Theater';
  return 'Other';
}

function pickBestImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
  return sorted[0]?.url || null;
}

async function fetchSeatGeek(options) {
  try {
    const seatgeek = require('./sources/seatgeek');
    return await seatgeek.fetchEvents({
      clientId: options.seatgeekClientId || process.env.SEATGEEK_CLIENT_ID,
      daysAhead: options.daysAhead || 60,
      maxPages: options.maxPages || 3,
    });
  } catch (err) {
    return { provider: 'seatgeek', fetched: 0, normalized: 0, events: [], errors: [err.message] };
  }
}

async function fetchBandsInTown(options) {
  try {
    const bit = require('./sources/jambase');

    // Use artists from our existing DB to query BandsInTown for more data
    const existingArtists = db.prepare('SELECT DISTINCT artist FROM events ORDER BY demand_score DESC LIMIT 30').all();
    const knownArtists = existingArtists.map(r => r.artist);
    const defaultArtists = bit.getTopArtists();
    const artists = [...new Set([...knownArtists, ...defaultArtists])].slice(0, 50);

    return await bit.fetchEvents({ artists, appId: 'ticketbot' });
  } catch (err) {
    return { provider: 'bandsintown', fetched: 0, normalized: 0, events: [], errors: [err.message] };
  }
}

/**
 * Deduplicate events across sources.
 * When same event found in multiple sources, merge pricing data.
 */
function deduplicateEvents(events) {
  const eventMap = new Map();

  for (const event of events) {
    // Key: lowercase artist + venue + date
    const key = `${(event.artist || '').toLowerCase().trim()}|${(event.venue || '').toLowerCase().trim()}|${event.date}`;

    if (eventMap.has(key)) {
      const existing = eventMap.get(key);
      // Merge: take the best pricing data
      existing.min_price = Math.min(existing.min_price, event.min_price);
      existing.max_price = Math.max(existing.max_price, event.max_price);
      existing.demand_score = Math.max(existing.demand_score, event.demand_score);
      existing.trending = existing.trending || event.trending;
      // Track which sources we found this in
      existing._sources = existing._sources || [existing.source];
      existing._sources.push(event.source);
      // Prefer image from TM > SeatGeek > BandsInTown
      if (event.source === 'Ticketmaster' && event.image_url) {
        existing.image_url = event.image_url;
      }
      // Prefer pricing from sources that have real data (TM, SG)
      if (event.source !== 'BandsInTown' && event.face_value > 0) {
        existing.face_value = event.face_value;
      }
    } else {
      eventMap.set(key, { ...event });
    }
  }

  return [...eventMap.values()];
}

function upsertEvents(events) {
  let inserted = 0, updated = 0, skipped = 0;

  const findExisting = db.prepare('SELECT id, demand_score, min_price, max_price FROM events WHERE LOWER(artist) = LOWER(?) AND LOWER(venue) = LOWER(?) AND date = ? LIMIT 1');

  const insertEvent = db.prepare(`
    INSERT INTO events (name, artist, venue, city, date, time, genre, image_url, face_value, min_price, max_price, demand_score, trending, on_sale_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateEvent = db.prepare(`
    UPDATE events SET
      city = COALESCE(?, city),
      time = COALESCE(?, time),
      genre = CASE WHEN ? != 'Other' THEN ? ELSE genre END,
      image_url = COALESCE(?, image_url),
      face_value = CASE WHEN ? > 0 THEN ? ELSE face_value END,
      min_price = CASE WHEN ? > 0 AND ? < min_price THEN ? ELSE min_price END,
      max_price = CASE WHEN ? > 0 AND ? > max_price THEN ? ELSE max_price END,
      demand_score = CASE WHEN ? > demand_score THEN ? ELSE demand_score END,
      trending = CASE WHEN ? THEN 1 ELSE trending END,
      on_sale_date = COALESCE(?, on_sale_date)
    WHERE id = ?
  `);

  const txn = db.transaction((rows) => {
    for (const e of rows) {
      if (!e.artist || !e.venue || !e.date) { skipped++; continue; }

      const existing = findExisting.get(e.artist, e.venue, e.date);
      if (existing) {
        updateEvent.run(
          e.city, e.time,
          e.genre, e.genre,
          e.image_url,
          e.face_value, e.face_value,
          e.min_price, e.min_price, e.min_price,
          e.max_price, e.max_price, e.max_price,
          e.demand_score, e.demand_score,
          e.trending,
          e.on_sale_date,
          existing.id
        );
        updated++;
      } else {
        insertEvent.run(
          e.name, e.artist, e.venue, e.city, e.date, e.time,
          e.genre, e.image_url, e.face_value, e.min_price, e.max_price,
          e.demand_score, e.trending ? 1 : 0, e.on_sale_date
        );
        inserted++;
      }
    }
  });

  txn(events);
  return { inserted, updated, skipped };
}

function updatePriceHistory(events) {
  const today = new Date().toISOString().split('T')[0];

  const findEvent = db.prepare('SELECT id FROM events WHERE LOWER(artist) = LOWER(?) AND LOWER(venue) = LOWER(?) AND date = ? LIMIT 1');
  const findHistory = db.prepare('SELECT id FROM price_history WHERE event_id = ? AND date = ? LIMIT 1');
  const insertHistory = db.prepare('INSERT INTO price_history (event_id, date, avg_price, min_price, max_price, volume) VALUES (?, ?, ?, ?, ?, ?)');
  const updateHistory = db.prepare('UPDATE price_history SET avg_price = ?, min_price = ?, max_price = ?, volume = ? WHERE id = ?');

  const txn = db.transaction((rows) => {
    for (const e of rows) {
      const ev = findEvent.get(e.artist, e.venue, e.date);
      if (!ev) continue;

      const avg = Math.round((e.min_price + e.max_price) / 2);
      const volume = Math.max(10, Math.round(e.demand_score * 1.8));
      const existing = findHistory.get(ev.id, today);

      if (existing) {
        updateHistory.run(avg, e.min_price, e.max_price, volume, existing.id);
      } else {
        insertHistory.run(ev.id, today, avg, e.min_price, e.max_price, volume);
      }
    }
  });

  txn(events);
}

/**
 * Recalculate demand intelligence based on accumulated data.
 * Events with more price history data points get better scoring.
 */
function updateDemandIntelligence() {
  try {
    // Boost demand for events with price increases over time
    const events = db.prepare(`
      SELECT e.id, e.demand_score, e.min_price, e.max_price,
        (SELECT COUNT(*) FROM price_history ph WHERE ph.event_id = e.id) as data_points,
        (SELECT ph.avg_price FROM price_history ph WHERE ph.event_id = e.id ORDER BY ph.date DESC LIMIT 1) as latest_avg,
        (SELECT ph.avg_price FROM price_history ph WHERE ph.event_id = e.id ORDER BY ph.date ASC LIMIT 1) as earliest_avg
      FROM events e
    `).all();

    const update = db.prepare('UPDATE events SET demand_score = ?, trending = ? WHERE id = ?');

    const txn = db.transaction(() => {
      for (const e of events) {
        if (e.data_points < 2 || !e.latest_avg || !e.earliest_avg) continue;

        // Price velocity: how fast are prices rising?
        const priceChange = (e.latest_avg - e.earliest_avg) / e.earliest_avg;
        let scoreBoost = 0;

        if (priceChange > 0.2) scoreBoost = 12;
        else if (priceChange > 0.1) scoreBoost = 8;
        else if (priceChange > 0.05) scoreBoost = 4;
        else if (priceChange < -0.1) scoreBoost = -5;

        // More data points = more confidence in the score
        if (e.data_points >= 7) scoreBoost += 3;
        else if (e.data_points >= 3) scoreBoost += 1;

        const newScore = Math.min(99, Math.max(35, Math.round(e.demand_score + scoreBoost)));
        const trending = newScore >= 75 ? 1 : 0;

        if (newScore !== Math.round(e.demand_score)) {
          update.run(newScore, trending, e.id);
        }
      }
    });

    txn();
  } catch (err) {
    console.error('[DemandIntelligence] Error:', err.message);
  }
}

module.exports = { aggregateFromAllSources, updateDemandIntelligence };
