const db = require('../db');
let seatGeekSource = null;
try {
  // Optional provider: may not exist in minimal deployments.
  // In that case we simply skip resale ingestion with a warning.
  seatGeekSource = require('./sources/seatgeek');
} catch {
  seatGeekSource = null;
}

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const TICKETMASTER_DISCOVER_BASE_URL = 'https://www.ticketmaster.com/discover';
const MS_PER_DAY = 86400000;

const CATEGORY_TO_SEGMENT = {
  concerts: 'Music',
  sports: 'Sports',
  theater: 'Arts & Theatre',
  comedy: 'Arts & Theatre',
  family: 'Miscellaneous',
  festivals: 'Music',
  other: 'Miscellaneous',
};

const DISCOVER_CATEGORY_PATHS = {
  concerts: 'concerts',
  sports: 'sports',
  theater: 'arts-theater',
  comedy: 'comedy',
  family: 'family',
};

const DEFAULT_CATEGORY_SET = ['concerts', 'sports', 'theater', 'comedy', 'family'];

const LEAGUE_PATTERNS = [
  ['NFL', /\bnfl\b|national football league|super bowl|preseason/i],
  ['NCAA Football', /\bncaa\b.*football|college football|cfp\b/i],
  ['NBA', /\bnba\b|national basketball association/i],
  ['WNBA', /\bwnba\b/i],
  ['NCAA Basketball', /\bncaa\b.*basketball|march madness|final four/i],
  ['MLB', /\bmlb\b|major league baseball|world series/i],
  ['NHL', /\bnhl\b|national hockey league|stanley cup/i],
  ['MLS', /\bmls\b|major league soccer/i],
  ['EPL', /\bepl\b|premier league/i],
  ['UFC', /\bufc\b|ultimate fighting championship/i],
  ['MMA', /\bmma\b|mixed martial arts/i],
  ['Boxing', /\bboxing\b|title fight|welterweight|heavyweight/i],
  ['WWE', /\bwwe\b|wrestlemania|smackdown|\braw\b/i],
  ['Formula 1', /\bformula\s?1\b|\bf1\b|grand prix/i],
  ['NASCAR', /\bnascar\b|cup series/i],
  ['Tennis', /\btennis\b|\batp\b|\bwta\b|grand slam/i],
  ['Golf', /\bpga\b|\blpga\b|\bgolf\b/i],
];

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

function toTicketmasterDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
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
    Sports: 120,
    Theater: 115,
    Comedy: 95,
    Family: 90,
  };
  return defaults[genre] || 140;
}

function normalizeCountryCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCountryCodes(value) {
  const list = parseList(value)
    .map(normalizeCountryCode)
    .filter(Boolean);
  return [...new Set(list)];
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'all') return 'all';
  if (['concert', 'concerts', 'music', 'shows'].includes(raw)) return 'concerts';
  if (['sports', 'sport'].includes(raw)) return 'sports';
  if (['theater', 'theatre', 'arts', 'arts_theater', 'arts-theater', 'broadway'].includes(raw)) return 'theater';
  if (['comedy', 'standup', 'stand-up'].includes(raw)) return 'comedy';
  if (['family', 'kids'].includes(raw)) return 'family';
  if (['festival', 'festivals'].includes(raw)) return 'festivals';
  if (['boxing', 'mma', 'ufc', 'wrestling', 'fighting'].includes(raw)) return 'sports';
  return 'other';
}

function normalizeCategories(value) {
  const list = parseList(value)
    .map(normalizeCategory)
    .filter(Boolean);

  if (list.length === 0 || list.includes('all')) {
    return [...DEFAULT_CATEGORY_SET];
  }

  return [...new Set(list)];
}

function mapCategoriesToSegments(categories) {
  const normalized = normalizeCategories(categories);
  const segments = normalized
    .map((category) => CATEGORY_TO_SEGMENT[category])
    .filter(Boolean);
  return [...new Set(segments)];
}

function categoryLabel(category) {
  if (category === 'concerts') return 'Music';
  if (category === 'sports') return 'Sports';
  if (category === 'theater') return 'Theater';
  if (category === 'comedy') return 'Comedy';
  if (category === 'family') return 'Family';
  if (category === 'festivals') return 'Festival';
  return 'Other';
}

function deriveCategory({ segmentName, genreName, subGenreName, fallbackCategory }) {
  const segment = String(segmentName || '').toLowerCase();
  const genre = String(genreName || '').toLowerCase();
  const subGenre = String(subGenreName || '').toLowerCase();

  if (segment.includes('sports')) return 'sports';
  if (segment.includes('music')) return 'concerts';
  if (segment.includes('comedy')) return 'comedy';
  if (segment.includes('family')) return 'family';
  if (segment.includes('arts')) return 'theater';

  if (genre.includes('boxing') || subGenre.includes('boxing')) return 'sports';
  if (genre.includes('mma') || subGenre.includes('mma')) return 'sports';
  if (genre.includes('wrestling') || subGenre.includes('wrestling')) return 'sports';
  if (genre.includes('comedy') || subGenre.includes('comedy')) return 'comedy';
  if (genre.includes('theater') || genre.includes('theatre') || subGenre.includes('broadway')) return 'theater';
  if (genre.includes('festival') || subGenre.includes('festival')) return 'festivals';
  if (genre.includes('family') || subGenre.includes('children')) return 'family';
  if (genre.includes('rock') || genre.includes('pop') || genre.includes('hip-hop') || genre.includes('country')) {
    return 'concerts';
  }

  return normalizeCategory(fallbackCategory || 'other');
}

function deriveCategoryFromGenre(genre, fallbackCategory = 'other') {
  const normalized = String(genre || '').toLowerCase();
  if (!normalized) return normalizeCategory(fallbackCategory);
  if (normalized.includes('sport') || normalized.includes('fighting')) return 'sports';
  if (normalized.includes('comedy')) return 'comedy';
  if (normalized.includes('theater') || normalized.includes('theatre')) return 'theater';
  if (normalized.includes('family')) return 'family';
  if (normalized.includes('festival')) return 'festivals';
  if (
    normalized.includes('pop')
    || normalized.includes('rock')
    || normalized.includes('hip-hop')
    || normalized.includes('r&b')
    || normalized.includes('country')
    || normalized.includes('latin')
    || normalized.includes('electronic')
  ) {
    return 'concerts';
  }
  return normalizeCategory(fallbackCategory);
}

function detectLeague(...parts) {
  const merged = parts
    .filter(Boolean)
    .map((value) => String(value))
    .join(' | ');

  for (const [name, pattern] of LEAGUE_PATTERNS) {
    if (pattern.test(merged)) return name;
  }

  return null;
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

  const segmentName = classification?.segment?.name || null;
  const genreName = classification?.genre?.name || null;
  const subGenreName = classification?.subGenre?.name || null;
  const category = deriveCategory({ segmentName, genreName, subGenreName });
  const genre = subGenreName || genreName || categoryLabel(category);

  const minPriceRaw = minPrices.length ? Math.min(...minPrices) : null;
  const maxPriceRaw = maxPrices.length ? Math.max(...maxPrices) : null;
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
  const countryCode = normalizeCountryCode(venue?.country?.countryCode);
  const league = detectLeague(
    ticketmasterEvent?.name,
    attraction?.name,
    segmentName,
    genreName,
    subGenreName
  );

  return {
    source: 'Ticketmaster',
    source_provider: 'ticketmaster_discovery',
    source_market: 'primary',
    source_event_id: ticketmasterEvent?.id || null,
    name: ticketmasterEvent?.name || 'Unnamed Event',
    artist: attraction?.name || ticketmasterEvent?.name || 'Unknown Artist',
    venue: venue?.name || 'Unknown Venue',
    city,
    country_code: countryCode,
    date: eventDate,
    time: toLocalTime(start?.localTime || start?.dateTime),
    category,
    subcategory: subGenreName || genreName || null,
    league,
    genre,
    image_url: pickBestImage(ticketmasterEvent?.images),
    face_value: faceValue,
    min_price: minPrice,
    max_price: maxPrice,
    currency: ticketmasterEvent?.priceRanges?.[0]?.currency || 'USD',
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

function toTicketbotEventFromDiscoverList(discoverEvent, fallbackCategory = 'other') {
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
  const category = deriveCategory({
    segmentName: discoverEvent?.segmentName,
    genreName: discoverEvent?.genre,
    subGenreName: discoverEvent?.subGenre,
    fallbackCategory,
  });

  const genre = discoverEvent?.subGenre || discoverEvent?.genre || categoryLabel(category);
  let faceValue = inferFaceValue(genre);
  if (limited) faceValue = Math.round(faceValue * 1.1);
  if (soldOut) faceValue = Math.round(faceValue * 1.2);
  const minPrice = Math.max(25, Math.round(faceValue * 0.92));
  const maxPrice = Math.max(minPrice, Math.round(faceValue * 1.35));

  const statusCode = soldOut ? 'offsale' : 'onsale';
  const demandScore = computeDemandScore({ minPrice, maxPrice, daysUntilOnSale, statusCode });
  const league = detectLeague(discoverEvent?.title, artist, discoverEvent?.genre, discoverEvent?.subGenre);

  return {
    source: 'TicketmasterWeb',
    source_provider: 'ticketmaster_web',
    source_market: 'primary',
    source_event_id: discoverEvent?.id || discoverEvent?.discoveryId || null,
    name: discoverEvent?.title || 'Unnamed Event',
    artist,
    venue: venue?.name || 'Unknown Venue',
    city,
    country_code: normalizeCountryCode(venue?.countryCode),
    date: eventDate,
    time: toLocalTime(discoverEvent?.dates?.startDate),
    category,
    subcategory: discoverEvent?.subGenre || discoverEvent?.genre || null,
    league,
    genre,
    image_url: venue?.imageUrl || null,
    face_value: faceValue,
    min_price: minPrice,
    max_price: maxPrice,
    currency: 'USD',
    demand_score: demandScore,
    trending: demandScore >= 75 ? 1 : 0,
    on_sale_date: onSaleDate,
  };
}

function toTicketbotEventFromSeatGeek(seatGeekEvent) {
  if (!seatGeekEvent?.date || !seatGeekEvent?.on_sale_date) return null;

  const category = deriveCategoryFromGenre(seatGeekEvent.genre);
  const league = detectLeague(seatGeekEvent.name, seatGeekEvent.artist, seatGeekEvent.genre);

  return {
    source: seatGeekEvent.source || 'SeatGeek',
    source_provider: 'seatgeek',
    source_market: 'resale',
    source_event_id: seatGeekEvent.source_event_id || null,
    name: seatGeekEvent.name || 'Unnamed Event',
    artist: seatGeekEvent.artist || seatGeekEvent.name || 'Unknown Artist',
    venue: seatGeekEvent.venue || 'Unknown Venue',
    city: seatGeekEvent.city || 'Unknown',
    country_code: normalizeCountryCode(seatGeekEvent.country_code),
    date: seatGeekEvent.date,
    time: seatGeekEvent.time || '20:00',
    category,
    subcategory: seatGeekEvent.genre || null,
    league,
    genre: seatGeekEvent.genre || categoryLabel(category),
    image_url: seatGeekEvent.image_url || null,
    face_value: Math.max(25, Math.round(Number(seatGeekEvent.face_value || seatGeekEvent.min_price || 0))),
    min_price: Math.max(25, Math.round(Number(seatGeekEvent.min_price || 0))),
    max_price: Math.max(25, Math.round(Number(seatGeekEvent.max_price || seatGeekEvent.min_price || 0))),
    currency: 'USD',
    demand_score: Number(seatGeekEvent.demand_score || 50),
    trending: seatGeekEvent.trending ? 1 : 0,
    on_sale_date: seatGeekEvent.on_sale_date,
  };
}

async function fetchTicketmasterEvents(options) {
  const {
    apiKey,
    countryCodes,
    size = 200,
    maxPages = 8,
    daysAhead = 30,
    keyword,
    segmentNames,
  } = options;

  const normalizedSize = clamp(Number(size) || 200, 1, 200);
  const normalizedPages = clamp(Number(maxPages) || 8, 1, 80);
  const normalizedDays = clamp(Number(daysAhead) || 30, 1, 365);
  const startDateTime = toTicketmasterDateTime(Date.now());
  const endDateTime = toTicketmasterDateTime(Date.now() + normalizedDays * MS_PER_DAY);

  const countries = normalizeCountryCodes(countryCodes);
  const segments = parseList(segmentNames).filter(Boolean);
  const scopeCountries = countries.length ? countries : [null];
  const scopeSegments = segments.length ? segments : [null];
  const scopeCount = scopeCountries.length * scopeSegments.length;

  const pagesPerScopeFloor = Math.max(1, Math.floor(normalizedPages / scopeCount));
  const pagesPerScopeExtra = normalizedPages - pagesPerScopeFloor * scopeCount;

  const eventsById = new Map();
  let pagesFetched = 0;
  let scopeOrdinal = 0;

  for (const countryCode of scopeCountries) {
    for (const segmentName of scopeSegments) {
      const allowedPages = pagesPerScopeFloor + (scopeOrdinal < pagesPerScopeExtra ? 1 : 0);
      scopeOrdinal += 1;
      let page = 0;
      let totalPages = 1;

      while (page < allowedPages && page < totalPages && pagesFetched < normalizedPages) {
        const params = new URLSearchParams({
          apikey: apiKey,
          size: String(normalizedSize),
          page: String(page),
          sort: 'date,asc',
          startDateTime,
          endDateTime,
          includeTBA: 'no',
          includeTBD: 'no',
        });

        if (countryCode) params.set('countryCode', countryCode);
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

        for (const event of pageEvents) {
          const eventId = event?.id;
          if (!eventId) continue;
          eventsById.set(eventId, event);
        }

        pagesFetched += 1;
        page += 1;

        if (pageEvents.length === 0) break;
      }

      if (pagesFetched >= normalizedPages) break;
    }

    if (pagesFetched >= normalizedPages) break;
  }

  return { events: [...eventsById.values()], pagesFetched };
}

async function fetchTicketmasterDiscoverEvents(options) {
  const maxPages = clamp(Number(options.maxPages) || 8, 1, 50);
  const categories = normalizeCategories(options.categories);
  const discoverCategories = categories.filter((category) => DISCOVER_CATEGORY_PATHS[category]);
  const scopedCategories = discoverCategories.length ? discoverCategories : DEFAULT_CATEGORY_SET;

  const pagesPerCategory = Math.max(1, Math.ceil(maxPages / scopedCategories.length));
  const eventsById = new Map();
  let pagesFetched = 0;

  for (const category of scopedCategories) {
    const path = DISCOVER_CATEGORY_PATHS[category];
    if (!path) continue;

    for (let page = 0; page < pagesPerCategory && pagesFetched < maxPages; page += 1) {
      const url = `${TICKETMASTER_DISCOVER_BASE_URL}/${path}?page=${page}`;
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
        eventsById.set(eventId, { event, fallbackCategory: category });
      }

      pagesFetched += 1;
    }

    if (pagesFetched >= maxPages) break;
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

  const findExistingBySourceId = db.prepare(`
    SELECT id FROM events
    WHERE source_provider = ? AND source_event_id = ?
    LIMIT 1
  `);

  const findExistingByIdentity = db.prepare(`
    SELECT id FROM events
    WHERE name = ? AND artist = ? AND venue = ? AND date = ?
    LIMIT 1
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (
      name, artist, venue, city, country_code, date, time,
      category, subcategory, league, genre, image_url,
      face_value, min_price, max_price, currency,
      source_market, source_provider, source_event_id,
      demand_score, trending, on_sale_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateEvent = db.prepare(`
    UPDATE events SET
      city = ?,
      country_code = COALESCE(?, country_code),
      time = ?,
      category = COALESCE(?, category),
      subcategory = COALESCE(?, subcategory),
      league = COALESCE(?, league),
      genre = ?,
      image_url = ?,
      face_value = ?,
      min_price = ?,
      max_price = ?,
      currency = COALESCE(?, currency),
      source_market = COALESCE(?, source_market),
      source_provider = COALESCE(?, source_provider),
      source_event_id = COALESCE(?, source_event_id),
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

      let existing = null;
      if (row.source_provider && row.source_event_id) {
        existing = findExistingBySourceId.get(row.source_provider, row.source_event_id);
      }
      if (!existing) {
        existing = findExistingByIdentity.get(row.name, row.artist, row.venue, row.date);
      }

      let eventId;

      if (existing?.id) {
        updateEvent.run(
          row.city,
          row.country_code || null,
          row.time,
          row.category || null,
          row.subcategory || null,
          row.league || null,
          row.genre,
          row.image_url,
          row.face_value,
          row.min_price,
          row.max_price,
          row.currency || null,
          row.source_market || null,
          row.source_provider || null,
          row.source_event_id || null,
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
          row.country_code || null,
          row.date,
          row.time,
          row.category || 'other',
          row.subcategory || null,
          row.league || null,
          row.genre,
          row.image_url,
          row.face_value,
          row.min_price,
          row.max_price,
          row.currency || null,
          row.source_market || 'primary',
          row.source_provider || row.source || null,
          row.source_event_id || null,
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
  const categories = normalizeCategories(options.categories);
  const countryCodes = options.countryCodes
    || options.countryCode
    || process.env.TICKETMASTER_COUNTRY_CODES
    || process.env.TICKETMASTER_COUNTRY_CODE;

  const summary = {
    provider: 'ticketmaster_discovery',
    fetched: 0,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    pages_fetched: 0,
    categories,
    country_codes: normalizeCountryCodes(countryCodes),
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
      countryCodes,
      size: options.size || process.env.TICKETMASTER_PAGE_SIZE || 200,
      maxPages: options.maxPages || process.env.TICKETMASTER_MAX_PAGES || 12,
      daysAhead: options.daysAhead || process.env.TICKETMASTER_DAYS_AHEAD || 45,
      keyword: options.keyword,
      segmentNames: options.segmentNames || mapCategoriesToSegments(categories),
    });

    summary.fetched = events.length;
    summary.pages_fetched = pagesFetched;

    const normalized = events
      .map(toTicketbotEventFromDiscovery)
      .filter((event) => event && event.on_sale_date);

    const categoryAllowList = new Set(categories);
    const filtered = normalized.filter((event) => {
      if (categoryAllowList.size === 0) return true;
      return categoryAllowList.has(event.category);
    });

    summary.normalized = filtered.length;
    summary.skipped += summary.fetched - summary.normalized;

    const writes = upsertEventData(filtered);
    summary.inserted += writes.inserted;
    summary.updated += writes.updated;
    summary.skipped += writes.skipped;
  } catch (error) {
    summary.errors.push(error.message || 'Unknown provider failure');
  }

  return summary;
}

async function ingestTicketmasterWebProvider(options) {
  const categories = normalizeCategories(options.categories);

  const summary = {
    provider: 'ticketmaster_web',
    fetched: 0,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    pages_fetched: 0,
    categories,
    errors: [],
    notes: ['Price data is estimated when using ticketmaster_web fallback'],
  };

  try {
    const { events, pagesFetched } = await fetchTicketmasterDiscoverEvents({
      maxPages: options.maxPages || process.env.TICKETMASTER_MAX_PAGES || 12,
      categories,
    });

    summary.fetched = events.length;
    summary.pages_fetched = pagesFetched;

    const normalized = events
      .map(({ event, fallbackCategory }) => toTicketbotEventFromDiscoverList(event, fallbackCategory))
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

async function ingestSeatGeekProvider(options) {
  const categories = normalizeCategories(options.categories);
  const seatgeekClientId = options.seatgeekClientId || process.env.SEATGEEK_CLIENT_ID;

  const summary = {
    provider: 'seatgeek_resale',
    fetched: 0,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    pages_fetched: 0,
    categories,
    errors: [],
    warnings: [],
  };

  if (!seatgeekClientId) {
    summary.warnings.push('SEATGEEK_CLIENT_ID not set; seatgeek_resale skipped');
    return summary;
  }
  if (!seatgeekSource || typeof seatGeekSource.fetchEvents !== 'function') {
    summary.warnings.push('SeatGeek provider module not available; seatgeek_resale skipped');
    return summary;
  }

  try {
    const result = await seatGeekSource.fetchEvents({
      clientId: seatgeekClientId,
      daysAhead: options.daysAhead || 60,
      maxPages: options.maxPages || 5,
      perPage: options.size || 100,
    });

    summary.fetched = Number(result?.fetched || 0);
    summary.pages_fetched = options.maxPages || 5;
    if (Array.isArray(result?.errors) && result.errors.length > 0) {
      summary.warnings.push(...result.errors);
    }

    const normalized = (result?.events || [])
      .map(toTicketbotEventFromSeatGeek)
      .filter((event) => event && event.on_sale_date);

    const categoryAllowList = new Set(categories);
    const filtered = normalized.filter((event) => categoryAllowList.has(event.category));

    summary.normalized = filtered.length;
    summary.skipped += summary.fetched - summary.normalized;

    const writes = upsertEventData(filtered);
    summary.inserted += writes.inserted;
    summary.updated += writes.updated;
    summary.skipped += writes.skipped;
  } catch (error) {
    summary.errors.push(error.message || 'SeatGeek provider failed');
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

  const defaultProviders = ['ticketmaster_discovery', 'ticketmaster_web'];
  if (process.env.SEATGEEK_CLIENT_ID) defaultProviders.push('seatgeek_resale');

  const providers = Array.isArray(options.providers) && options.providers.length
    ? options.providers
    : defaultProviders;

  if (providers.includes('ticketmaster_discovery')) {
    const summary = await ingestTicketmasterProvider(options);
    result.providers.push(summary);
  }

  if (providers.includes('ticketmaster_web')) {
    const summary = await ingestTicketmasterWebProvider(options);
    result.providers.push(summary);
  }

  if (providers.includes('seatgeek_resale')) {
    const summary = await ingestSeatGeekProvider(options);
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

module.exports = {
  ingestLiveData,
  normalizeCategories,
  normalizeCountryCodes,
};
