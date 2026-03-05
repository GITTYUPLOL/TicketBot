const Database = require('better-sqlite3');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const ENVIRONMENTS = new Set(['live', 'test']);
const FALLBACK_ENV = 'test';
const environmentContext = new AsyncLocalStorage();

const schemaSQL = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    venue TEXT NOT NULL,
    city TEXT NOT NULL,
    country_code TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    subcategory TEXT,
    league TEXT,
    genre TEXT NOT NULL,
    image_url TEXT,
    face_value REAL NOT NULL,
    min_price REAL,
    max_price REAL,
    currency TEXT,
    source_market TEXT DEFAULT 'primary',
    source_provider TEXT,
    source_event_id TEXT,
    demand_score REAL DEFAULT 0,
    trending INTEGER DEFAULT 0,
    on_sale_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    section TEXT,
    row TEXT,
    seat TEXT,
    price REAL NOT NULL,
    fees REAL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    listing_url TEXT,
    is_best_deal INTEGER DEFAULT 0,
    is_highest_resale INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    avg_price REAL NOT NULL,
    min_price REAL NOT NULL,
    max_price REAL NOT NULL,
    volume INTEGER DEFAULT 0,
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS autobuy_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    event_name TEXT,
    mode TEXT NOT NULL CHECK(mode IN ('alert', 'auto', 'snipe')),
    max_price REAL,
    target_price REAL,
    section_filter TEXT,
    quantity INTEGER DEFAULT 1,
    card_id INTEGER,
    enabled INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    last_checked TEXT,
    last_executed TEXT,
    execution_log TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    last_four TEXT NOT NULL,
    expiry TEXT NOT NULL,
    card_type TEXT DEFAULT 'visa',
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    ticket_id INTEGER,
    card_id INTEGER,
    quantity INTEGER DEFAULT 1,
    price_paid REAL NOT NULL,
    fees REAL DEFAULT 0,
    total REAL NOT NULL,
    resale_value REAL,
    profit REAL,
    status TEXT DEFAULT 'completed',
    source TEXT,
    purchased_via TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT,
    status TEXT DEFAULT 'active',
    last_login TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS snipe_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER,
    account_id INTEGER,
    event_name TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    needs_input INTEGER DEFAULT 0,
    input_type TEXT,
    browser_url TEXT,
    screenshot_url TEXT,
    log TEXT,
    started_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rule_id) REFERENCES autobuy_rules(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS historical_comparables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT,
    venue TEXT,
    genre TEXT,
    event_date TEXT,
    face_value REAL,
    avg_resale_price REAL,
    min_resale_price REAL,
    max_resale_price REAL,
    roi_actual REAL,
    demand_score_at_sale REAL,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scraped_selectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    page_type TEXT NOT NULL,
    selectors TEXT NOT NULL,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(site_name, page_type)
  );

  CREATE TABLE IF NOT EXISTS ingestion_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    environment TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    providers TEXT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    expires_at TEXT,
    fetched INTEGER DEFAULT 0,
    normalized INTEGER DEFAULT 0,
    inserted INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    summary_json TEXT
  );
`;

function addColumnIfMissing(db, tableName, columnName, definition) {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = tableInfo.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function applyMigrations(db) {
  addColumnIfMissing(db, 'events', 'country_code', 'TEXT');
  addColumnIfMissing(db, 'events', 'category', "TEXT DEFAULT 'other'");
  addColumnIfMissing(db, 'events', 'subcategory', 'TEXT');
  addColumnIfMissing(db, 'events', 'league', 'TEXT');
  addColumnIfMissing(db, 'events', 'currency', 'TEXT');
  addColumnIfMissing(db, 'events', 'source_market', "TEXT DEFAULT 'primary'");
  addColumnIfMissing(db, 'events', 'source_provider', 'TEXT');
  addColumnIfMissing(db, 'events', 'source_event_id', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      environment TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      providers TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      expires_at TEXT,
      fetched INTEGER DEFAULT 0,
      normalized INTEGER DEFAULT 0,
      inserted INTEGER DEFAULT 0,
      updated INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      summary_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_on_sale_date ON events(on_sale_date);
    CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    CREATE INDEX IF NOT EXISTS idx_events_league ON events(league);
    CREATE INDEX IF NOT EXISTS idx_events_country_code ON events(country_code);
    CREATE INDEX IF NOT EXISTS idx_ingestion_runs_scope ON ingestion_runs(environment, scope_key, completed_at);
  `);
}

function normalizeEnvironment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ENVIRONMENTS.has(normalized) ? normalized : FALLBACK_ENV;
}

const DEFAULT_ENV = normalizeEnvironment(process.env.TICKETBOT_DEFAULT_ENV || FALLBACK_ENV);

function createDatabase(environment) {
  const dbFile = path.join(__dirname, `ticketbot-${environment}.db`);
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schemaSQL);
  applyMigrations(db);
  return db;
}

const databases = {
  live: createDatabase('live'),
  test: createDatabase('test'),
};

function getDbForEnvironment(environment) {
  return databases[normalizeEnvironment(environment)];
}

function getCurrentEnvironment() {
  const scopedEnvironment = environmentContext.getStore()?.environment;
  return normalizeEnvironment(scopedEnvironment || DEFAULT_ENV);
}

function getCurrentDb() {
  return getDbForEnvironment(getCurrentEnvironment());
}

function withEnvironment(environment, callback) {
  return environmentContext.run(
    { environment: normalizeEnvironment(environment) },
    callback
  );
}

const dbProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'withEnvironment') return withEnvironment;
      if (prop === 'getDbForEnvironment') return getDbForEnvironment;
      if (prop === 'getCurrentEnvironment') return getCurrentEnvironment;
      if (prop === 'normalizeEnvironment') return normalizeEnvironment;
      if (prop === 'DEFAULT_ENV') return DEFAULT_ENV;

      const db = getCurrentDb();
      const value = db[prop];
      return typeof value === 'function' ? value.bind(db) : value;
    },
  }
);

module.exports = dbProxy;
