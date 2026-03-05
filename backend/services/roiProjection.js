const db = require('../db');

const MS_PER_DAY = 86400000;
const CONFIDENCE_SCORES = {
  low: 1,
  medium: 2,
  high: 3,
};

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundMoney(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDemandConfidenceLevel(demandScore) {
  if (Number(demandScore) >= 75) return 'high';
  if (Number(demandScore) >= 55) return 'medium';
  return 'low';
}

function minimumDemandScoreFromConfidence(confidence) {
  const normalized = String(confidence || '').trim().toLowerCase();
  if (normalized === 'high') return 75;
  if (normalized === 'medium') return 55;
  return 0;
}

function getDaysUntilOnSale(onSaleDate) {
  if (!onSaleDate) return null;
  const parsed = new Date(`${onSaleDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((parsed.getTime() - todayUTC) / MS_PER_DAY);
}

function getOnSaleWindow(daysUntilOnSale) {
  if (daysUntilOnSale === null || daysUntilOnSale < 0) return null;
  if (daysUntilOnSale <= 7) return '7d';
  if (daysUntilOnSale <= 14) return '14d';
  if (daysUntilOnSale <= 30) return '30d';
  return null;
}

function getSaleWindowPriority(window) {
  if (window === '7d') return 1;
  if (window === '14d') return 2;
  if (window === '30d') return 3;
  return 99;
}

function buildComparableKey(item) {
  return `${String(item.artist || '').toLowerCase()}|${String(item.venue || '').toLowerCase()}|${item.event_date || ''}`;
}

function stripComparableRows(payload) {
  const { comparables, ...rest } = payload;
  return rest;
}

function cloneComparablePayload(payload, includeComparableRows) {
  if (!payload) return payload;
  if (includeComparableRows) {
    return {
      ...payload,
      comparables: Array.isArray(payload.comparables)
        ? payload.comparables.map((item) => ({ ...item }))
        : [],
    };
  }
  return stripComparableRows(payload);
}

function classifyComparableConfidence(comparables) {
  if (!comparables.length) return 'low';

  const artistMatches = comparables.filter((comp) => comp.match_type === 'artist').length;
  const venueMatches = comparables.filter((comp) => comp.match_type === 'venue').length;
  const sampleSize = comparables.length;

  if (artistMatches >= 3) return 'high';
  if (artistMatches >= 1 || venueMatches >= 2 || sampleSize >= 4) return 'medium';
  return 'low';
}

function getHistoricalComparables(event, options = {}) {
  const limit = Number.isFinite(Number(options.limit))
    ? Math.min(Math.max(Number(options.limit), 1), 10)
    : 5;
  const includeComparableRows = !!options.includeComparableRows;
  const cache = options.cache;
  const cacheKey = `${String(event.artist || '').toLowerCase()}|${String(event.venue || '').toLowerCase()}|${String(event.genre || '').toLowerCase()}|${limit}`;

  if (cache && cache.has(cacheKey)) {
    return cloneComparablePayload(cache.get(cacheKey), includeComparableRows);
  }

  const byArtist = db.prepare(`
    SELECT artist, venue, genre, event_date, face_value, avg_resale_price, min_resale_price, max_resale_price, roi_actual, demand_score_at_sale
    FROM historical_comparables
    WHERE LOWER(artist) = LOWER(?)
    ORDER BY event_date DESC
    LIMIT ?
  `).all(event.artist, limit).map((comp) => ({ ...comp, match_type: 'artist' }));

  const byVenue = db.prepare(`
    SELECT artist, venue, genre, event_date, face_value, avg_resale_price, min_resale_price, max_resale_price, roi_actual, demand_score_at_sale
    FROM historical_comparables
    WHERE LOWER(venue) = LOWER(?) AND LOWER(artist) != LOWER(?)
    ORDER BY event_date DESC
    LIMIT ?
  `).all(event.venue, event.artist, limit).map((comp) => ({ ...comp, match_type: 'venue' }));

  const byGenre = db.prepare(`
    SELECT artist, venue, genre, event_date, face_value, avg_resale_price, min_resale_price, max_resale_price, roi_actual, demand_score_at_sale
    FROM historical_comparables
    WHERE LOWER(genre) = LOWER(?)
      AND LOWER(artist) != LOWER(?)
      AND LOWER(venue) != LOWER(?)
    ORDER BY roi_actual DESC
    LIMIT ?
  `).all(event.genre, event.artist, event.venue, limit).map((comp) => ({ ...comp, match_type: 'genre' }));

  const allComparables = [...byArtist, ...byVenue, ...byGenre];
  const seen = new Set();
  const uniqueComparables = [];
  for (const comp of allComparables) {
    const key = buildComparableKey(comp);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueComparables.push(comp);
    if (uniqueComparables.length >= limit) break;
  }

  if (!uniqueComparables.length) {
    const emptyPayload = {
      available: false,
      match_type: 'none',
      confidence: 'low',
      sample_size: 0,
      projected_resale: null,
      projected_resale_low: null,
      projected_resale_high: null,
      avg_historical_roi: null,
      avg_demand_at_sale: null,
      comparables: [],
    };
    if (cache) cache.set(cacheKey, emptyPayload);
    return cloneComparablePayload(emptyPayload, includeComparableRows);
  }

  const matchType =
    uniqueComparables.find((comp) => comp.match_type === 'artist') ? 'artist'
      : uniqueComparables.find((comp) => comp.match_type === 'venue') ? 'venue'
        : 'genre';

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const resaleValues = uniqueComparables.map((comp) => toPositiveNumber(comp.avg_resale_price)).filter(Boolean);
  const minValues = uniqueComparables.map((comp) => toPositiveNumber(comp.min_resale_price)).filter(Boolean);
  const maxValues = uniqueComparables.map((comp) => toPositiveNumber(comp.max_resale_price)).filter(Boolean);
  const roiValues = uniqueComparables.map((comp) => Number(comp.roi_actual)).filter(Number.isFinite);
  const demandValues = uniqueComparables.map((comp) => Number(comp.demand_score_at_sale)).filter(Number.isFinite);

  const projectedResale = resaleValues.length ? roundMoney(average(resaleValues)) : null;
  const projectedResaleLow = minValues.length
    ? roundMoney(Math.min(...minValues))
    : projectedResale ? roundMoney(projectedResale * 0.82) : null;
  const projectedResaleHigh = maxValues.length
    ? roundMoney(Math.max(...maxValues))
    : projectedResale ? roundMoney(projectedResale * 1.25) : null;

  const payload = {
    available: true,
    match_type: matchType,
    confidence: classifyComparableConfidence(uniqueComparables),
    sample_size: uniqueComparables.length,
    projected_resale: projectedResale,
    projected_resale_low: projectedResaleLow,
    projected_resale_high: projectedResaleHigh,
    avg_historical_roi: roiValues.length ? Math.round(average(roiValues)) : null,
    avg_demand_at_sale: demandValues.length ? Number(average(demandValues).toFixed(1)) : null,
    comparables: uniqueComparables,
  };

  if (cache) cache.set(cacheKey, payload);
  return cloneComparablePayload(payload, includeComparableRows);
}

function confidenceFromScore(score) {
  if (score >= 2.6) return 'high';
  if (score >= 1.75) return 'medium';
  return 'low';
}

function getHistoricalWeight(confidence) {
  if (confidence === 'high') return 0.6;
  if (confidence === 'medium') return 0.45;
  return 0.3;
}

function inferEstimateStatus(hasMarketData, hasHistoricalData) {
  if (hasMarketData && hasHistoricalData) return 'blended';
  if (hasMarketData) return 'market_only';
  if (hasHistoricalData) return 'historical_modeled';
  return 'unverified';
}

function mergeRanges(primaryLow, primaryHigh, secondaryLow, secondaryHigh, secondaryWeight) {
  if (primaryLow !== null && primaryHigh !== null && secondaryLow !== null && secondaryHigh !== null) {
    return {
      low: roundMoney(primaryLow * (1 - secondaryWeight) + secondaryLow * secondaryWeight),
      high: roundMoney(primaryHigh * (1 - secondaryWeight) + secondaryHigh * secondaryWeight),
    };
  }
  if (secondaryLow !== null && secondaryHigh !== null) {
    return { low: secondaryLow, high: secondaryHigh };
  }
  if (primaryLow !== null && primaryHigh !== null) {
    return { low: primaryLow, high: primaryHigh };
  }
  return { low: null, high: null };
}

function buildRoiProjection(event, options = {}) {
  const includeHistorical = options.includeHistorical !== false;
  const cache = options.cache;

  const faceValue = toPositiveNumber(event.face_value);
  const minPrice = toPositiveNumber(event.min_price);
  const maxPrice = toPositiveNumber(event.max_price);
  const projectedEntryPrice = roundMoney(minPrice || faceValue || 0) || 0;

  const marketResale = maxPrice ? roundMoney(maxPrice * 0.85) : null;
  const marketResaleLow = minPrice ? roundMoney(minPrice * 0.92) : (marketResale ? roundMoney(marketResale * 0.88) : null);
  const marketResaleHigh = maxPrice ? roundMoney(maxPrice * 0.92) : (marketResale ? roundMoney(marketResale * 1.12) : null);

  const historical = includeHistorical
    ? getHistoricalComparables(event, { cache, includeComparableRows: false })
    : {
      available: false,
      confidence: 'low',
      projected_resale: null,
      projected_resale_low: null,
      projected_resale_high: null,
      avg_historical_roi: null,
      sample_size: 0,
      match_type: 'none',
    };

  const hasMarketData = marketResale !== null;
  const hasHistoricalData = !!historical.available && historical.projected_resale !== null;
  const historicalWeight = getHistoricalWeight(historical.confidence);
  const estimateStatus = inferEstimateStatus(hasMarketData, hasHistoricalData);

  let projectedResalePrice = projectedEntryPrice;
  if (hasMarketData && hasHistoricalData) {
    projectedResalePrice = roundMoney(
      marketResale * (1 - historicalWeight) + historical.projected_resale * historicalWeight
    ) || projectedEntryPrice;
  } else if (hasMarketData) {
    projectedResalePrice = marketResale;
  } else if (hasHistoricalData) {
    projectedResalePrice = historical.projected_resale;
  }

  const resaleRange = mergeRanges(
    marketResaleLow,
    marketResaleHigh,
    historical.projected_resale_low,
    historical.projected_resale_high,
    historicalWeight
  );

  let projectedResaleLow = resaleRange.low;
  let projectedResaleHigh = resaleRange.high;
  if (projectedResaleLow === null || projectedResaleHigh === null) {
    projectedResaleLow = roundMoney(projectedResalePrice * 0.9);
    projectedResaleHigh = roundMoney(projectedResalePrice * 1.12);
  }
  if (projectedResaleLow > projectedResaleHigh) {
    [projectedResaleLow, projectedResaleHigh] = [projectedResaleHigh, projectedResaleLow];
  }

  const projectedEntryRangeLow = roundMoney(minPrice || projectedEntryPrice * 0.95);
  const projectedEntryRangeHigh = roundMoney(maxPrice || projectedEntryPrice * 1.08);
  const projectedFaceRangeLow = faceValue ? roundMoney(faceValue * 0.9) : null;
  const projectedFaceRangeHigh = faceValue ? roundMoney(faceValue * 1.1) : null;

  const estimatedFees = roundMoney(projectedEntryPrice * 0.12) || 0;
  const estimatedProfit = projectedResalePrice - projectedEntryPrice - estimatedFees;
  const estimatedRoi = projectedEntryPrice > 0
    ? Math.round((estimatedProfit / projectedEntryPrice) * 100)
    : 0;

  const demandConfidence = getDemandConfidenceLevel(event.demand_score);
  let confidenceScore = CONFIDENCE_SCORES[demandConfidence];
  if (hasHistoricalData) {
    confidenceScore = (confidenceScore + CONFIDENCE_SCORES[historical.confidence]) / 2;
  }
  if (estimateStatus === 'blended') confidenceScore += 0.4;
  if (estimateStatus === 'historical_modeled') confidenceScore -= 0.1;
  if (estimateStatus === 'unverified') confidenceScore = 1;
  confidenceScore = clamp(confidenceScore, 1, 3);

  const priceEstimateConfidence = confidenceFromScore(confidenceScore);
  const resalePotential = faceValue && faceValue > 0
    ? Math.round(((projectedResalePrice - faceValue) / faceValue) * 100)
    : estimatedRoi;

  return {
    projected_entry_price: projectedEntryPrice,
    projected_entry_range_low: projectedEntryRangeLow,
    projected_entry_range_high: projectedEntryRangeHigh,
    projected_face_range_low: projectedFaceRangeLow,
    projected_face_range_high: projectedFaceRangeHigh,
    projected_resale_price: projectedResalePrice,
    projected_resale_range_low: projectedResaleLow,
    projected_resale_range_high: projectedResaleHigh,
    estimated_fees: estimatedFees,
    estimated_profit: estimatedProfit,
    estimated_roi: estimatedRoi,
    roi_confidence: demandConfidence,
    resale_potential: resalePotential,
    price_estimate_status: estimateStatus,
    price_estimate_confidence: priceEstimateConfidence,
    historical_match_type: historical.available ? historical.match_type : null,
    historical_sample_size: historical.sample_size || 0,
    historical_avg_roi: historical.avg_historical_roi,
  };
}

module.exports = {
  buildRoiProjection,
  getDemandConfidenceLevel,
  getDaysUntilOnSale,
  getOnSaleWindow,
  getSaleWindowPriority,
  getHistoricalComparables,
  minimumDemandScoreFromConfidence,
};
