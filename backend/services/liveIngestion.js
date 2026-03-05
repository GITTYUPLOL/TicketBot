const db = require('../db');

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const TICKETMASTER_DISCOVER_URL = 'https://www.ticketmaster.com/discover/concerts';
const MS_PER_DAY = 86400000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function toLocalTime(value) {
  if (!value) return '20:00';
  if (typeof value === 'string' && value.includes(':') && value.length <= 8) {
    return value.slice(0, 5);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '20:00';
  return date.toISOString().slice(11, 16);
}

function pickBestImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => {
    const aSize = (a.width || 0) * (a.height || 0);
    const bSize = (b.width || 0) * (b.height || 0);
    return bSize - aSize;
  });
  return sorted[0]?.url || null;
}

function inferFaceValue(genre) {
  const defaults = {
    Pop: 165,
    Rock: 145,
    'Hip-Hop': 170,
    'R&B': 150,
    Country: 130,
    Latin: 155,
  };
  return defaults[genre] || 140;
}

function computeDemandScore({ minPrice, maxPrice, daysUntilOnSale, statusCode }) {
  let score = 56;

  if (statusCode === 'onsale') score += 10;
  if (statusCode === 'offsale' || statusCode === 'cancelled') score -= 18;

  if (daysUntilOnSale <= 7) score += 12;
  else if (daysUntilOnSale <= 14) score += 8;
  else if (daysUntilOnSale <= 30) score += 4;

  if (minPrice > 0 && maxPrice > minPrice) {
    const spreadRatio = maxPrice / minPrice;
    if (spreadRatio >= 2.1) score += 10;
    else if (spreadRatio >= 1.6) score += 6;
    else if (spreadRatio >= 1.25) score += 3;
  }

  return Math.round(clamp(score, 35, 95) * 10) / 10;
}

function toTicketbotEventFromDiscovery(ticketmasterEvent) {
  const venue = ticketmasterEvent?._embedded?.venues?.[0];
  const attraction = ticketmasterEvent?._embedded?.attractions?.[0];
  const classification = ticketmasterEvent?.classifications?.[0];
  const salesPublic = ticketmasterEvent?.sales?.public;
  const start = ticketmasterEvent?.dates?.start;
  const statusCode = ticketmasterEvent?.dates?.status?.code || 'onsale';

  const eventDate = start?.localDate || toIsoDate(start?.dateTime);
  const onSaleDate = toIsoDate(salesPublic?.startDateTime);
  if (!eventDate || !onSaleDate) return null;

  const minPrices = (ticketmasterEvent?.priceRanges || [])
    .map((range) => parseNumber(range?.min))
    .filter((value) => value !== null);
  const maxPrices = (ticketmasterEvent?.priceRanges || [])
    .map((range) => parseNumber(range?.max))
    .filter((value) => value !== null);

  const minPriceRaw = minPrices.length ? Math.min(...minPrices) : null;
  const maxPriceRaw = maxPrices.length ? Math.max(...maxPrices) : null;
  const genre = classification?.segment?.name || classification?.genre?.name || 'Other';
  const faceValue = Math.max(25, Math.round(minPriceRaw || inferFaceValue(genre)));
  const minPrice = Math.max(25, Math.round(minPriceRaw || faceValue));
  const maxPrice = Math.max(minPrice, Math.round(maxPriceRaw || minPrice * 1.45));

  const onSaleTimestamp = new Date(`${onSaleDate}T00:00:00Z`).getTime();
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysUntilOnSale = Math.max(0, Math.ceil((onSaleTimestamp - todayUTC) / MS_PER_DAY));
  const demandScore = computeDemandScore({ minPrice, maxPrice, daysUntilOnSale, statusCode });

  const cityName = venue?.city?.name || 'Unknown';
  const stateOrCountry = venue?.state?.stateCode || venue?.country?.countryCode || '';
  const city = stateOrCountry ? `${cityName}, ${stateOrCountry}` : cityName;

  return {
    source: 'Ticketmaster',
    source_event_id: ticketmasterEvent?.id || null,
    name: ticketmasterEvent?.name || 'Unnamed Event',
    artist: attraction?.name || ticketmasterEvent?.name || 'Unknown Artist',
    venue: venue?.name || 'Unknown Venue',
    city,
    date: eventDate,
    time: toLocalTime(start?.localTime || start?.dateTime),
    genre,
    image_url: pickBestImage(ticketmasterEvent?.images),
    face_value: faceValue,
    min_price: minPrice,
    max_price: maxPrice,
    demand_score: demandScore,
    trending: demandScore >= 75 ? 1 : 0,
    on_sale_date: onSaleDate,
  };
}

function extractNextDataJSON(html) {
  if (!html) return null;
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function toTicketbotEventFromDiscoverList(discoverEvent) {
  const eventDate = toIsoDate(discoverEvent?.dates?.startDate);
  const onSaleDate = toIsoDate(discoverEvent?.dates?.onsaleDate);
  if (!eventDate || !onSaleDate) return null;

  const venue = discoverEvent?.venue || {};
  const cityName = venue?.city || 'Unknown';
  const stateOrCountry = venue?.state || venue?.countryCode || '';
  const city = stateOrCountry ? `${cityName}, ${stateOrCountry}` : cityName;
  const artist = discoverEvent?.artists?.[0]?.name || discoverEvent?.title || 'Unknown Artist';

  const onSaleTimestamp = new Date(`${onSaleDate}T00:00:00Z`).getTime();
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysUntilOnSale = Math.max(0, Math.ceil((onSaleTimestamp - todayUTC) / MS_PER_DAY));

  const limited = Boolean(discoverEvent?.limitedAvailability);
  const soldOut = Boolean(discoverEvent?.soldOut);
  let faceValue = inferFaceValue('Other');
  if (limited) faceValue = Math.round(faceValue * 1.1);
  if (soldOut) faceValue = Math.round(faceValue * 1.2);
  const minPrice = Math.max(25, Math.round(faceValue * 0.92));
  const maxPrice = Math.max(minPrice, Math.round(faceValue * 1.35));

  const statusCode = soldOut ? 'offsale' : 'onsale';
  const demandScore = computeDemandScore({ minPrice, maxPrice, daysUntilOnSale, statusCode });

  return {
    source: 'TicketmasterWeb',
    source_event_id: discoverEvent?.id || discoverEvent?.discoveryId || null,
    name: discoverEvent?.title || 'Unnamed Event',
    artist,
    venue: venue?.name || 'Unknown Venue',
    city,
    date: eventDate,
    time: toLocalTime(discoverEvent?.dates?.startDate),
    genre: 'Other',
    image_url: venue?.imageUrl || null,
    face_value: faceValue,
    min_price: minPrice,
    max_price: maxPrice,
    demand_score: demandScore,
    trending: demandScore >= 75 ? 1 : 0,
    on_sale_date: onSaleDate,
  };
}

async function fetchTicketmasterEvents(options) {
  const {
    apiKey,
    countryCode = 'US',
    size = 200,
    maxPages = 8,
    daysAhead = 30,
    keyword,
    segmentName,
  } = options;

  const normalizedSize = clamp(Number(size) || 200, 1, 200);
  const normalizedPages = clamp(Number(maxPages) || 8, 1, 50);
  const normalizedDays = clamp(Number(daysAhead) || 30, 1, 180);
  const startDateTime = new Date().toISOString();
  const endDateTime = new Date(Date.now() + normalizedDays * MS_PER_DAY).toISOString();

  const allEvents = [];
  let pagesFetched = 0;
  let totalPages = 1;

  while (pagesFetched < normalizedPages && pagesFetched < totalPages) {
    const params = new URLSearchParams({
      apikey: apiKey,
      countryCode,
      size: String(normalizedSize),
      page: String(pagesFetched),
      sort: 'date,asc',
      startDateTime,
      endDateTime,
      includeTBA: 'no',
      includeTBD: 'no',
    });

    if (keyword) params.set('keyword', keyword);
    if (segmentName) params.set('segmentName', segmentName);

    const response = await fetch(`${TICKETMASTER_BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ticketmaster API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const pageEvents = data?._embedded?.events || [];
    const reportedPages = Number(data?.page?.totalPages);
    if (Number.isFinite(reportedPages) && reportedPages > 0) {
      totalPages = reportedPages;
    }

    allEvents.push(...pageEvents);
    pagesFetched += 1;

    if (pageEvents.length === 0) break;
  }

  return { events: allEvents, pagesFetched };
}

async function fetchTicketmasterDiscoverEvents(options) {
  const maxPages = clamp(Number(options.maxPages) || 8, 1, 50);
  const eventsById = new Map();
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const url = `${TICKETMASTER_DISCOVER_URL}?page=${page}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; TicketbotLiveIngest/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Ticketmaster discover page error ${response.status}`);
    }

    const html = await response.text();
    const nextData = extractNextDataJSON(html);
    const queries = nextData?.props?.pageProps?.initialReduxState?.api?.queries || {};
    const categoryEventsQueryKey = Object.keys(queries).find((key) => key.startsWith('categoryEvents('));
    const pageEvents = categoryEventsQueryKey
      ? queries[categoryEventsQueryKey]?.data?.events || []
      : [];

    if (!Array.isArray(pageEvents) || pageEvents.length === 0) {
      break;
    }

    for (const event of pageEvents) {
      const eventId = event?.id || event?.discoveryId;
      if (!eventId) continue;
      eventsById.set(eventId, event);
    }

    pagesFetched += 1;
  }

  return {
    events: [...eventsById.values()],
    pagesFetched,
  };
}

function upsertEventData(events) {
  if (!events.length) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const findExistingEvent = db.prepare(`
    SELECT id FROM events
    WHERE name = ? AND artist = ? AND venue = ? AND date = ?
    LIMIT 1
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (
      name, artist, venue, city, date, time, genre, image_url,
      face_value, min_price, max_price, demand_score, trending, on_sale_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateEvent = db.prepare(`
    UPDATE events SET
      city = ?,
      time = ?,
      genre = ?,
      image_url = ?,
      face_value = ?,
      min_price = ?,
      max_price = ?,
      demand_score = ?,
      trending = ?,
      on_sale_date = ?
    WHERE id = ?
  `);

  const findPriceHistory = db.prepare(`
    SELECT id FROM price_history
    WHERE event_id = ? AND date = ?
    LIMIT 1
  `);

  const insertPriceHistory = db.prepare(`
    INSERT INTO price_history (event_id, date, avg_price, min_price, max_price, volume)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updatePriceHistory = db.prepare(`
    UPDATE price_history
    SET avg_price = ?, min_price = ?, max_price = ?, volume = ?
    WHERE id = ?
  `);

  const findTicket = db.prepare(`
    SELECT id FROM tickets
    WHERE event_id = ? AND source = ? AND section = 'Market'
    LIMIT 1
  `);

  const insertTicket = db.prepare(`
    INSERT INTO tickets (event_id, source, section, row, seat, price, fees, quantity, listing_url, is_best_deal, is_highest_resale)
    VALUES (?, ?, 'Market', '-', '-', ?, ?, 2, NULL, 1, 1)
  `);

  const updateTicket = db.prepare(`
    UPDATE tickets
    SET price = ?, fees = ?, quantity = 2
    WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const today = new Date().toISOString().split('T')[0];

  const writeTransaction = db.transaction((rows) => {
    for (const row of rows) {
      if (!row.name || !row.artist || !row.venue || !row.date || !row.on_sale_date) {
        skipped += 1;
        continue;
      }

      const existing = findExistingEvent.get(row.name, row.artist, row.venue, row.date);
      let eventId;

      if (existing?.id) {
        updateEvent.run(
          row.city,
          row.time,
          row.genre,
          row.image_url,
          row.face_value,
          row.min_price,
          row.max_price,
          row.demand_score,
          row.trending,
          row.on_sale_date,
          existing.id
        );
        eventId = existing.id;
        updated += 1;
      } else {
        const insertedRow = insertEvent.run(
          row.name,
          row.artist,
          row.venue,
          row.city,
          row.date,
          row.time,
          row.genre,
          row.image_url,
          row.face_value,
          row.min_price,
          row.max_price,
          row.demand_score,
          row.trending,
          row.on_sale_date
        );
        eventId = insertedRow.lastInsertRowid;
        inserted += 1;
      }

      const avgPrice = Math.round((row.min_price + row.max_price) / 2);
      const volume = Math.max(25, Math.round(row.demand_score * 2.1));
      const history = findPriceHistory.get(eventId, today);
      if (history?.id) {
        updatePriceHistory.run(avgPrice, row.min_price, row.max_price, volume, history.id);
      } else {
        insertPriceHistory.run(eventId, today, avgPrice, row.min_price, row.max_price, volume);
      }

      const ticket = findTicket.get(eventId, row.source);
      const estimatedFees = Math.round(row.min_price * 0.12);
      if (ticket?.id) {
        updateTicket.run(row.min_price, estimatedFees, ticket.id);
      } else {
        insertTicket.run(eventId, row.source, row.min_price, estimatedFees);
      }
    }
  });

  writeTransaction(events);
  return { inserted, updated, skipped };
}

async function ingestTicketmasterProvider(options) {
  const apiKey = options.ticketmasterApiKey || process.env.TICKETMASTER_API_KEY;
  const summary = {
    provider: 'ticketmaster_discovery',
    fetched: 0,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    pages_fetched: 0,
    errors: [],
    warnings: [],
  };

  if (!apiKey) {
    summary.warnings.push('TICKETMASTER_API_KEY not set; ticketmaster_discovery skipped');
    return summary;
  }

  try {
    const { events, pagesFetched } = await fetchTicketmasterEvents({
      apiKey,
      countryCode: options.countryCode || process.env.TICKETMASTER_COUNTRY_CODE || 'US',
      size: options.size || process.env.TICKETMASTER_PAGE_SIZE || 200,
      maxPages: options.maxPages || process.env.TICKETMASTER_MAX_PAGES || 8,
      daysAhead: options.daysAhead || process.env.TICKETMASTER_DAYS_AHEAD || 30,
      keyword: options.keyword,
      segmentName: options.segmentName,
    });

    summary.fetched = events.length;
    summary.pages_fetched = pagesFetched;

    const normalized = events
      .map(toTicketbotEventFromDiscovery)
      .filter((event) => event && event.on_sale_date);

    summary.normalized = normalized.length;
    summary.skipped += summary.fetched - summary.normalized;

    const writes = upsertEventData(normalized);
    summary.inserted += writes.inserted;
    summary.updated += writes.updated;
    summary.skipped += writes.skipped;
  } catch (error) {
    summary.errors.push(error.message || 'Unknown provider failure');
  }

  return summary;
}

async function ingestTicketmasterWebProvider(options) {
  const summary = {
    provider: 'ticketmaster_web',
    fetched: 0,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    pages_fetched: 0,
    errors: [],
    notes: ['Price data is estimated when using ticketmaster_web fallback'],
  };

  try {
    const { events, pagesFetched } = await fetchTicketmasterDiscoverEvents({
      maxPages: options.maxPages || process.env.TICKETMASTER_MAX_PAGES || 8,
    });

    summary.fetched = events.length;
    summary.pages_fetched = pagesFetched;

    const normalized = events
      .map(toTicketbotEventFromDiscoverList)
      .filter((event) => event && event.on_sale_date);

    summary.normalized = normalized.length;
    summary.skipped += summary.fetched - summary.normalized;

    const writes = upsertEventData(normalized);
    summary.inserted += writes.inserted;
    summary.updated += writes.updated;
    summary.skipped += writes.skipped;
  } catch (error) {
    summary.errors.push(error.message || 'Ticketmaster web fallback failed');
  }

  return summary;
}

async function ingestLiveData(options = {}) {
  const environment = db.getCurrentEnvironment();
  if (environment !== 'live') {
    throw new Error('Live ingestion requires LIVE environment context');
  }

  const result = {
    environment,
    started_at: new Date().toISOString(),
    providers: [],
    totals: { fetched: 0, normalized: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
  };

  const providers = Array.isArray(options.providers) && options.providers.length
    ? options.providers
    : ['ticketmaster_discovery', 'ticketmaster_web'];

  if (providers.includes('ticketmaster_discovery')) {
    const summary = await ingestTicketmasterProvider(options);
    result.providers.push(summary);
  }

  if (providers.includes('ticketmaster_web')) {
    const summary = await ingestTicketmasterWebProvider(options);
    result.providers.push(summary);
  }

  for (const provider of result.providers) {
    result.totals.fetched += provider.fetched || 0;
    result.totals.normalized += provider.normalized || 0;
    result.totals.inserted += provider.inserted || 0;
    result.totals.updated += provider.updated || 0;
    result.totals.skipped += provider.skipped || 0;
    result.totals.errors += Array.isArray(provider.errors) ? provider.errors.length : 0;
  }

  result.completed_at = new Date().toISOString();
  return result;
}

module.exports = { ingestLiveData };
