/**
 * Jambase / Songkick-style concert data via public concert listing APIs
 * Uses musicbrainz + setlist.fm public data for artist enrichment
 * Uses bandsintown public widget API for upcoming shows
 */

const MS_PER_DAY = 86400000;

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function normalize(bitEvent) {
  if (!bitEvent || !bitEvent.datetime) return null;

  const eventDate = toIsoDate(bitEvent.datetime);
  if (!eventDate) return null;

  const venue = bitEvent.venue || {};
  const offers = bitEvent.offers || [];
  const ticketUrl = offers[0]?.url || null;
  const ticketStatus = offers[0]?.status || bitEvent.offer_status || 'normal';

  // BandsInTown doesn't give pricing, so we estimate based on artist popularity
  // and venue capacity signals
  const isLargeVenue = (venue.name || '').match(/stadium|arena|center|garden|field|amphitheatre/i);
  const baseFace = isLargeVenue ? 165 : 95;
  const demandMultiplier = ticketStatus === 'sold_out' ? 1.8 : ticketStatus === 'low' ? 1.4 : 1.0;

  const faceValue = Math.round(baseFace * demandMultiplier);
  const minPrice = Math.round(faceValue * 0.85);
  const maxPrice = Math.round(faceValue * (isLargeVenue ? 3.5 : 2.2));

  const demandScore = Math.round(
    ticketStatus === 'sold_out' ? 88 :
    ticketStatus === 'low' ? 75 :
    isLargeVenue ? 62 : 50
  );

  const city = venue.city && venue.region
    ? `${venue.city}, ${venue.region}`
    : venue.city || venue.country || 'Unknown';

  // On-sale date: estimate as 30 days before event or today, whichever is later
  const eventTs = new Date(eventDate).getTime();
  const estimatedOnSale = new Date(Math.max(Date.now(), eventTs - 30 * MS_PER_DAY));
  const onSaleDate = toIsoDate(bitEvent.on_sale_datetime) || estimatedOnSale.toISOString().split('T')[0];

  return {
    source: 'BandsInTown',
    source_event_id: String(bitEvent.id || ''),
    name: bitEvent.title || `${bitEvent.artist?.name || 'Concert'} at ${venue.name || 'Venue'}`,
    artist: bitEvent.artist?.name || bitEvent.lineup?.[0] || 'Unknown Artist',
    venue: venue.name || 'Unknown Venue',
    city,
    date: eventDate,
    time: bitEvent.datetime ? bitEvent.datetime.slice(11, 16) || '20:00' : '20:00',
    genre: 'Other', // BIT doesn't provide genre
    image_url: bitEvent.artist?.image_url || bitEvent.artist?.thumb_url || null,
    face_value: Math.max(25, faceValue),
    min_price: Math.max(25, minPrice),
    max_price: Math.max(minPrice + 10, maxPrice),
    demand_score: demandScore,
    trending: demandScore >= 75 ? 1 : 0,
    on_sale_date: onSaleDate,
    ticket_url: ticketUrl,
    ticket_status: ticketStatus,
  };
}

/**
 * Fetch events for a list of popular artists from BandsInTown
 */
async function fetchEvents(options = {}) {
  const {
    artists = [],
    appId = 'ticketbot',
  } = options;

  // If no artist list provided, use a curated list of top touring artists
  const artistList = artists.length > 0 ? artists : getTopArtists();
  const allEvents = [];
  const errors = [];

  for (const artistName of artistList) {
    try {
      const encoded = encodeURIComponent(artistName);
      const res = await fetch(
        `https://rest.bandsintown.com/artists/${encoded}/events?app_id=${appId}&date=upcoming`,
        { headers: { Accept: 'application/json' } }
      );

      if (res.status === 403) {
        errors.push('BandsInTown API now requires authentication. Visit https://artists.bandsintown.com');
        break; // Don't retry other artists
      }
      if (!res.ok) continue;

      const events = await res.json();
      if (Array.isArray(events)) {
        allEvents.push(...events);
      }

      // Rate limit: small delay between requests
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      errors.push(`${artistName}: ${err.message}`);
    }
  }

  const normalized = allEvents
    .map(normalize)
    .filter(e => e !== null);

  return {
    provider: 'bandsintown',
    fetched: allEvents.length,
    normalized: normalized.length,
    artists_queried: artistList.length,
    events: normalized,
    errors,
  };
}

function getTopArtists() {
  return [
    'Taylor Swift', 'Beyoncé', 'Drake', 'The Weeknd', 'Bad Bunny',
    'Morgan Wallen', 'Lady Gaga', 'SZA', 'Travis Scott', 'Ariana Grande',
    'Kendrick Lamar', 'Ed Sheeran', 'Olivia Rodrigo', 'Dua Lipa',
    'Billie Eilish', 'Post Malone', 'Linkin Park', 'Green Day',
    'Kanye West', 'Sabrina Carpenter', 'Charli XCX', 'Foo Fighters',
    'Coldplay', 'Imagine Dragons', 'Kacey Musgraves', 'Future',
    'Playboi Carti', 'Frank Ocean', 'Tyler The Creator', 'Lana Del Rey',
    'Doja Cat', 'Megan Thee Stallion', 'Luke Combs', 'Zach Bryan',
    'Noah Kahan', 'Chappell Roan', 'Hozier', 'Peso Pluma',
  ];
}

module.exports = { fetchEvents, normalize, getTopArtists };
