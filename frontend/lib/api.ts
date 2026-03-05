const ENV_KEY = 'ticketbot-env';

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  // Browser: proxy through Next.js to avoid cross-origin issues
  if (typeof window !== 'undefined') return '/api/proxy';
  return 'http://127.0.0.1:3001/api';
}

function getApiEnvironment() {
  if (typeof window === 'undefined') return 'test';
  const value = localStorage.getItem(ENV_KEY);
  return value === 'live' ? 'live' : 'test';
}

async function fetchAPI(path: string, options?: RequestInit) {
  const base = getApiBase();
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-ticketbot-env', getApiEnvironment());

  const request: RequestInit = {
    ...options,
    headers,
  };

  if (!request.cache) request.cache = 'no-store';

  const res = await fetch(`${base}${path}`, request);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Events
export const getEvents = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI(`/events${qs}`);
};
export const getEvent = (id: string | number) => fetchAPI(`/events/${id}`);
export const getGenres = () => fetchAPI('/events/genres');
export const getEventFilters = () => fetchAPI('/events/filters');

// Tickets
export const getTickets = (eventId: string | number, params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI(`/tickets/${eventId}${qs}`);
};
export const purchaseTicket = (ticketId: number, data: { card_id?: number; quantity?: number }) =>
  fetchAPI(`/tickets/${ticketId}/purchase`, { method: 'POST', body: JSON.stringify(data) });

// Analytics
export const getTrending = () => fetchAPI('/analytics/trending');
export const getPriceHistory = (eventId: string | number) => fetchAPI(`/analytics/price-history/${eventId}`);
export const getMarketHeatmap = () => fetchAPI('/analytics/market-heatmap');
export const getBestTimeToBuy = (eventId: string | number) => fetchAPI(`/analytics/best-time-to-buy/${eventId}`);
export const getSupplyDemand = () => fetchAPI('/analytics/supply-demand');
export const getUpcomingOpportunities = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI(`/analytics/upcoming-opportunities${qs}`);
};
export const getDashboardQuickView = () => fetchAPI('/analytics/quick-view');
export const ingestLiveData = (data?: Record<string, unknown>) =>
  fetchAPI('/live/ingest', { method: 'POST', body: JSON.stringify(data || {}) });
export const syncLiveData = async (data?: Record<string, unknown>) => {
  const payload = JSON.stringify(data || {});
  try {
    return await fetchAPI('/live/sync', { method: 'POST', body: payload });
  } catch (error) {
    if (error instanceof Error && error.message === 'API error: 404') {
      return fetchAPI('/live/ingest', { method: 'POST', body: payload });
    }
    throw error;
  }
};
export const getRoiCalculator = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI(`/analytics/roi-calculator${qs}`);
};

// Autobuy
export const getAutobuyRules = () => fetchAPI('/autobuy');
export const createAutobuyRule = (data: Record<string, unknown>) =>
  fetchAPI('/autobuy', { method: 'POST', body: JSON.stringify(data) });
export const updateAutobuyRule = (id: number, data: Record<string, unknown>) =>
  fetchAPI(`/autobuy/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteAutobuyRule = (id: number) =>
  fetchAPI(`/autobuy/${id}`, { method: 'DELETE' });

// Cards
export const getCards = () => fetchAPI('/cards');
export const addCard = (data: Record<string, unknown>) =>
  fetchAPI('/cards', { method: 'POST', body: JSON.stringify(data) });
export const setDefaultCard = (id: number) =>
  fetchAPI(`/cards/${id}/default`, { method: 'PATCH' });
export const deleteCard = (id: number) =>
  fetchAPI(`/cards/${id}`, { method: 'DELETE' });

// Orders
export const getOrders = () => fetchAPI('/orders');
export const getOrderStats = () => fetchAPI('/orders/stats');

// Accounts
export const getAccounts = (platform?: string) => {
  const qs = platform ? `?platform=${platform}` : '';
  return fetchAPI(`/accounts${qs}`);
};
export const getPlatforms = () => fetchAPI('/accounts/platforms');
export const getAccountStats = () => fetchAPI('/accounts/stats');
export const addAccount = (data: Record<string, unknown>) =>
  fetchAPI('/accounts', { method: 'POST', body: JSON.stringify(data) });
export const bulkAddAccounts = (accounts: Record<string, unknown>[]) =>
  fetchAPI('/accounts/bulk', { method: 'POST', body: JSON.stringify({ accounts }) });
export const bulkAddAccountsText = (platform: string, text: string) =>
  fetchAPI('/accounts/bulk-text', { method: 'POST', body: JSON.stringify({ platform, text }) });
export const updateAccount = (id: number, data: Record<string, unknown>) =>
  fetchAPI(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteAccount = (id: number) =>
  fetchAPI(`/accounts/${id}`, { method: 'DELETE' });

// Sniper
export const getSniperSessions = () => fetchAPI('/sniper/sessions');
export const createSniperSession = (data: Record<string, unknown>) =>
  fetchAPI('/sniper/sessions', { method: 'POST', body: JSON.stringify(data) });
export const updateSniperSession = (id: number, data: Record<string, unknown>) =>
  fetchAPI(`/sniper/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const resolveSniperInput = (id: number) =>
  fetchAPI(`/sniper/sessions/${id}/resolve`, { method: 'POST' });
export const deleteSniperSession = (id: number) =>
  fetchAPI(`/sniper/sessions/${id}`, { method: 'DELETE' });
export const createDemoSessions = () =>
  fetchAPI('/sniper/demo', { method: 'POST' });

// Readiness
export const getEventReadiness = (eventId: string | number) =>
  fetchAPI(`/readiness/${eventId}`);
export const getBatchReadiness = (eventIds: number[]) =>
  fetchAPI(`/readiness?event_ids=${eventIds.join(',')}`);

// Data sourcing
export const triggerDataRefresh = () =>
  syncLiveData({});
export const getSourceStatus = () => fetchAPI('/sources/status');
