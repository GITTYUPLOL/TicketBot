const dbModule = require('../db');
const db = dbModule.getDbForEnvironment('test');

function seed() {
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  if (eventCount > 0) return;

  console.log('Seeding database...');

  const events = [
    { name: 'The Eras Tour - Final Shows', artist: 'Taylor Swift', venue: 'SoFi Stadium', city: 'Los Angeles, CA', date: '2026-06-15', time: '19:00', genre: 'Pop', face_value: 250, image_url: '/images/taylor-swift.jpg' },
    { name: 'Renaissance World Tour', artist: 'Beyoncé', venue: 'MetLife Stadium', city: 'East Rutherford, NJ', date: '2026-07-20', time: '20:00', genre: 'Pop', face_value: 300, image_url: '/images/beyonce.jpg' },
    { name: 'Music of the Spheres', artist: 'Coldplay', venue: 'Wembley Stadium', city: 'London, UK', date: '2026-08-10', time: '19:30', genre: 'Rock', face_value: 150, image_url: '/images/coldplay.jpg' },
    { name: 'The Marathon Tour', artist: 'Drake', venue: 'Scotiabank Arena', city: 'Toronto, ON', date: '2026-05-22', time: '20:30', genre: 'Hip-Hop', face_value: 200, image_url: '/images/drake.jpg' },
    { name: 'Midnights Til Dawn', artist: 'The Weeknd', venue: 'Madison Square Garden', city: 'New York, NY', date: '2026-04-18', time: '21:00', genre: 'R&B', face_value: 180, image_url: '/images/weeknd.jpg' },
    { name: 'Happier Than Ever Tour', artist: 'Billie Eilish', venue: 'The Forum', city: 'Inglewood, CA', date: '2026-09-05', time: '20:00', genre: 'Pop', face_value: 120, image_url: '/images/billie.jpg' },
    { name: 'After Hours Nightmare', artist: 'Bad Bunny', venue: 'Hard Rock Stadium', city: 'Miami, FL', date: '2026-07-04', time: '19:00', genre: 'Latin', face_value: 175, image_url: '/images/bad-bunny.jpg' },
    { name: 'Stadium Tour 2026', artist: 'Morgan Wallen', venue: 'Nissan Stadium', city: 'Nashville, TN', date: '2026-06-28', time: '19:30', genre: 'Country', face_value: 130, image_url: '/images/morgan-wallen.jpg' },
    { name: 'Chromatica Ball II', artist: 'Lady Gaga', venue: 'Dodger Stadium', city: 'Los Angeles, CA', date: '2026-08-22', time: '20:00', genre: 'Pop', face_value: 220, image_url: '/images/lady-gaga.jpg' },
    { name: 'Long Live Tour', artist: 'SZA', venue: 'Barclays Center', city: 'Brooklyn, NY', date: '2026-05-10', time: '20:00', genre: 'R&B', face_value: 140, image_url: '/images/sza.jpg' },
    { name: 'Utopia Circus', artist: 'Travis Scott', venue: 'NRG Stadium', city: 'Houston, TX', date: '2026-04-25', time: '21:00', genre: 'Hip-Hop', face_value: 190, image_url: '/images/travis-scott.jpg' },
    { name: 'Eternal Sunshine Tour', artist: 'Ariana Grande', venue: 'United Center', city: 'Chicago, IL', date: '2026-07-12', time: '20:00', genre: 'Pop', face_value: 200, image_url: '/images/ariana.jpg' },
    { name: 'The Big Steppers Tour', artist: 'Kendrick Lamar', venue: 'Crypto.com Arena', city: 'Los Angeles, CA', date: '2026-06-01', time: '20:30', genre: 'Hip-Hop', face_value: 210, image_url: '/images/kendrick.jpg' },
    { name: 'Divide & Conquer Tour', artist: 'Ed Sheeran', venue: 'Rose Bowl', city: 'Pasadena, CA', date: '2026-09-20', time: '19:00', genre: 'Pop', face_value: 160, image_url: '/images/ed-sheeran.jpg' },
    { name: 'GUTS World Tour', artist: 'Olivia Rodrigo', venue: 'TD Garden', city: 'Boston, MA', date: '2026-05-30', time: '19:30', genre: 'Pop', face_value: 110, image_url: '/images/olivia.jpg' },
    { name: 'World Tour 2026', artist: 'Dua Lipa', venue: 'O2 Arena', city: 'London, UK', date: '2026-08-15', time: '20:00', genre: 'Pop', face_value: 140, image_url: '/images/dua-lipa.jpg' },
    { name: 'From Zero World Tour', artist: 'Linkin Park', venue: 'Fenway Park', city: 'Boston, MA', date: '2026-07-08', time: '19:00', genre: 'Rock', face_value: 155, image_url: '/images/linkin-park.jpg' },
    { name: 'Stadium Run', artist: 'Post Malone', venue: 'AT&T Stadium', city: 'Arlington, TX', date: '2026-06-20', time: '20:00', genre: 'Pop', face_value: 135, image_url: '/images/post-malone.jpg' },
    { name: 'Vultures Tour', artist: 'Kanye West', venue: 'Allegiant Stadium', city: 'Las Vegas, NV', date: '2026-10-01', time: '21:00', genre: 'Hip-Hop', face_value: 280, image_url: '/images/kanye.jpg' },
    { name: 'Saviors World Tour', artist: 'Green Day', venue: 'Citi Field', city: 'New York, NY', date: '2026-08-05', time: '19:00', genre: 'Rock', face_value: 125, image_url: '/images/green-day.jpg' },
    { name: 'Cowboy Carter Tour', artist: 'Beyoncé', venue: 'AT&T Stadium', city: 'Arlington, TX', date: '2026-09-12', time: '20:00', genre: 'Country', face_value: 350, image_url: '/images/beyonce-country.jpg' },
    { name: 'Purple Reign', artist: 'Future & Metro Boomin', venue: 'State Farm Arena', city: 'Atlanta, GA', date: '2026-04-30', time: '20:30', genre: 'Hip-Hop', face_value: 160, image_url: '/images/future-metro.jpg' },
    { name: 'In Utero Anniversary', artist: 'Foo Fighters', venue: 'The Gorge', city: 'George, WA', date: '2026-07-25', time: '18:00', genre: 'Rock', face_value: 145, image_url: '/images/foo-fighters.jpg' },
    { name: 'Short n Sweet Tour', artist: 'Sabrina Carpenter', venue: 'Prudential Center', city: 'Newark, NJ', date: '2026-05-15', time: '19:30', genre: 'Pop', face_value: 95, image_url: '/images/sabrina.jpg' },
    { name: 'Brat Tour', artist: 'Charli XCX', venue: 'Brooklyn Steel', city: 'Brooklyn, NY', date: '2026-04-12', time: '20:00', genre: 'Pop', face_value: 85, image_url: '/images/charli.jpg' },
    { name: 'Deeper Well Tour', artist: 'Kacey Musgraves', venue: 'Ryman Auditorium', city: 'Nashville, TN', date: '2026-06-08', time: '19:30', genre: 'Country', face_value: 110, image_url: '/images/kacey.jpg' },
    { name: 'Hit Me Hard Tour', artist: 'Billie Eilish', venue: 'Chase Center', city: 'San Francisco, CA', date: '2026-10-10', time: '20:00', genre: 'Pop', face_value: 130, image_url: '/images/billie2.jpg' },
    { name: 'Everything I Wanted Arena Tour', artist: 'Imagine Dragons', venue: 'T-Mobile Arena', city: 'Las Vegas, NV', date: '2026-08-30', time: '20:00', genre: 'Rock', face_value: 140, image_url: '/images/imagine-dragons.jpg' },
    { name: 'Trilogy Night', artist: 'The Weeknd', venue: 'Climate Pledge Arena', city: 'Seattle, WA', date: '2026-06-10', time: '21:00', genre: 'R&B', face_value: 195, image_url: '/images/weeknd2.jpg' },
    { name: 'Carnival Tour', artist: 'Playboi Carti', venue: 'Barclays Center', city: 'Brooklyn, NY', date: '2026-05-05', time: '21:00', genre: 'Hip-Hop', face_value: 120, image_url: '/images/carti.jpg' },
    { name: 'Damn. 10 Year Anniversary', artist: 'Kendrick Lamar', venue: 'The Forum', city: 'Inglewood, CA', date: '2026-04-14', time: '20:00', genre: 'Hip-Hop', face_value: 250, image_url: '/images/kendrick2.jpg' },
    { name: 'Coachella Weekend 1 - Headliner Set', artist: 'Frank Ocean', venue: 'Empire Polo Club', city: 'Indio, CA', date: '2026-04-10', time: '22:00', genre: 'R&B', face_value: 500, image_url: '/images/frank-ocean.jpg' },
  ];

  const sources = ['Ticketmaster', 'StubHub', 'SeatGeek', 'AXS'];
  const sections = ['Floor', 'GA', 'Section 100', 'Section 200', 'Section 300', 'VIP', 'Pit', 'Balcony'];

  const insertEvent = db.prepare(`
    INSERT INTO events (name, artist, venue, city, date, time, genre, face_value, image_url, min_price, max_price, demand_score, trending, on_sale_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTicket = db.prepare(`
    INSERT INTO tickets (event_id, source, section, row, price, fees, quantity, is_best_deal, is_highest_resale)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPriceHistory = db.prepare(`
    INSERT INTO price_history (event_id, date, avg_price, min_price, max_price, volume)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertCard = db.prepare(`
    INSERT INTO cards (name, last_four, expiry, card_type, is_default)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertOrder = db.prepare(`
    INSERT INTO orders (event_id, ticket_id, card_id, quantity, price_paid, fees, total, resale_value, profit, source, purchased_via, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSelector = db.prepare(`
    INSERT OR REPLACE INTO scraped_selectors (site_name, page_type, selectors, last_updated)
    VALUES (?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    // Seed events
    for (const e of events) {
      const demandScore = Math.round((Math.random() * 60 + 40) * 10) / 10;
      const multiplier = 1 + (demandScore / 100) * 3;
      const minPrice = Math.round(e.face_value * (0.8 + Math.random() * 0.5));
      const maxPrice = Math.round(e.face_value * multiplier * (1 + Math.random()));
      const trending = demandScore > 75 ? 1 : 0;
      let daysUntilOnSale;
      const saleWindowRoll = Math.random();
      if (saleWindowRoll < 0.5) daysUntilOnSale = Math.floor(Math.random() * 8); // 0-7 days
      else if (saleWindowRoll < 0.8) daysUntilOnSale = 8 + Math.floor(Math.random() * 7); // 8-14
      else daysUntilOnSale = 15 + Math.floor(Math.random() * 16); // 15-30

      const onSaleDate = new Date(Date.now() + daysUntilOnSale * 86400000).toISOString().split('T')[0];

      const result = insertEvent.run(
        e.name, e.artist, e.venue, e.city, e.date, e.time, e.genre,
        e.face_value, e.image_url, minPrice, maxPrice, demandScore, trending, onSaleDate
      );
      const eventId = result.lastInsertRowid;

      // Generate 6-12 ticket listings per event
      const ticketCount = 6 + Math.floor(Math.random() * 7);
      const ticketPrices = [];
      for (let t = 0; t < ticketCount; t++) {
        const source = sources[Math.floor(Math.random() * sources.length)];
        const section = sections[Math.floor(Math.random() * sections.length)];
        const row = String.fromCharCode(65 + Math.floor(Math.random() * 20));
        const price = Math.round(minPrice + Math.random() * (maxPrice - minPrice));
        const fees = Math.round(price * (0.1 + Math.random() * 0.15));
        const quantity = 1 + Math.floor(Math.random() * 4);

        ticketPrices.push({ price, id: t });
        insertTicket.run(eventId, source, section, row, price, fees, quantity, 0, 0);
      }

      // Mark best deal and highest resale
      ticketPrices.sort((a, b) => a.price - b.price);
      if (ticketPrices.length > 0) {
        db.prepare('UPDATE tickets SET is_best_deal = 1 WHERE event_id = ? AND price = ?')
          .run(eventId, ticketPrices[0].price);
        db.prepare('UPDATE tickets SET is_highest_resale = 1 WHERE event_id = ? AND price = ?')
          .run(eventId, ticketPrices[ticketPrices.length - 1].price);
      }

      // Generate 30-day price history
      const today = new Date();
      for (let d = 30; d >= 0; d--) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split('T')[0];

        const trend = demandScore > 70 ? 1.02 : demandScore > 50 ? 1.005 : 0.995;
        const dayFactor = Math.pow(trend, 30 - d);
        const noise = 0.9 + Math.random() * 0.2;

        const avgPrice = Math.round(e.face_value * dayFactor * noise);
        const dayMin = Math.round(avgPrice * (0.7 + Math.random() * 0.15));
        const dayMax = Math.round(avgPrice * (1.2 + Math.random() * 0.3));
        const volume = Math.floor(Math.random() * 200 + 20);

        insertPriceHistory.run(eventId, dateStr, avgPrice, dayMin, dayMax, volume);
      }
    }

    // Seed payment cards
    insertCard.run('Personal Visa', '4242', '12/27', 'visa', 1);
    insertCard.run('Business Amex', '1001', '06/28', 'amex', 0);
    insertCard.run('Chase Sapphire', '8899', '03/27', 'mastercard', 0);

    // Seed a few sample orders
    const sampleOrders = [
      { eventId: 1, ticketId: 1, cardId: 1, qty: 2, price: 450, fees: 65, source: 'StubHub', via: 'manual', daysAgo: 5, resaleValue: 620 },
      { eventId: 4, ticketId: 15, cardId: 1, qty: 1, price: 310, fees: 45, source: 'Ticketmaster', via: 'autobuy', daysAgo: 3, resaleValue: 280 },
      { eventId: 10, ticketId: 40, cardId: 2, qty: 2, price: 180, fees: 28, source: 'SeatGeek', via: 'manual', daysAgo: 10, resaleValue: 220 },
      { eventId: 5, ticketId: 22, cardId: 1, qty: 1, price: 275, fees: 40, source: 'AXS', via: 'snipe', daysAgo: 1, resaleValue: 350 },
    ];

    for (const o of sampleOrders) {
      const total = o.price * o.qty + o.fees;
      const profit = o.resaleValue ? (o.resaleValue * o.qty - total) : null;
      const date = new Date();
      date.setDate(date.getDate() - o.daysAgo);
      insertOrder.run(o.eventId, o.ticketId, o.cardId, o.qty, o.price, o.fees, total, o.resaleValue, profit, o.source, o.via, date.toISOString());
    }

    // Seed scraped selectors
    const selectors = [
      { site: 'ticketmaster', page: 'event_listing', selectors: { buyButton: 'button[data-testid="buy-button"]', priceElement: '.ticket-price', sectionPicker: 'select.section-select', quantityDropdown: 'select.qty-select', captchaContainer: '#recaptcha-container' }},
      { site: 'ticketmaster', page: 'checkout', selectors: { submitOrder: 'button.complete-purchase', totalPrice: '.order-total', cardInput: '#card-number', expiryInput: '#expiry', cvvInput: '#cvv' }},
      { site: 'stubhub', page: 'event_listing', selectors: { buyButton: '.buy-btn', priceElement: '[data-testid="price"]', sectionFilter: '.section-filter', sortDropdown: '.sort-by' }},
      { site: 'stubhub', page: 'checkout', selectors: { placeOrder: '#place-order', totalAmount: '.total-amount', paymentForm: '.payment-form' }},
      { site: 'seatgeek', page: 'event_listing', selectors: { buyButton: '.EventAction-button', priceElement: '.TicketPrice', seatMap: '.SeatMap', filterBar: '.FilterBar' }},
      { site: 'seatgeek', page: 'checkout', selectors: { confirmPurchase: '.confirm-purchase-btn', orderSummary: '.order-summary' }},
      { site: 'axs', page: 'event_listing', selectors: { buyButton: '.btn-buy-tickets', priceRange: '.price-range', availabilityIndicator: '.availability' }},
      { site: 'axs', page: 'checkout', selectors: { completePurchase: '#complete-purchase', cartTotal: '.cart-total' }},
    ];

    for (const s of selectors) {
      insertSelector.run(s.site, s.page, JSON.stringify(s.selectors), new Date().toISOString());
    }

    // Seed some autobuy rules
    const insertRule = db.prepare(`
      INSERT INTO autobuy_rules (event_id, event_name, mode, max_price, target_price, section_filter, quantity, card_id, enabled, status, execution_log)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRule.run(1, 'The Eras Tour - Final Shows', 'auto', 400, null, 'Floor', 2, 1, 1, 'active', JSON.stringify([{ time: new Date().toISOString(), msg: 'Rule created' }]));
    insertRule.run(5, 'Midnights Til Dawn', 'alert', null, 150, null, 1, 1, 1, 'watching', JSON.stringify([{ time: new Date().toISOString(), msg: 'Watching for price drop' }]));
    insertRule.run(32, 'Coachella Weekend 1', 'snipe', 600, null, 'GA', 2, 2, 0, 'scheduled', JSON.stringify([{ time: new Date().toISOString(), msg: 'Scheduled for on-sale' }]));

    // Seed accounts
    const insertAccount = db.prepare(
      'INSERT INTO accounts (platform, email, username, password_hash, status) VALUES (?, ?, ?, ?, ?)'
    );
    insertAccount.run('ticketmaster', 'john.doe@gmail.com', 'johndoe', 'hashed_pw_1', 'active');
    insertAccount.run('ticketmaster', 'jane.smith@outlook.com', 'janesmith', 'hashed_pw_2', 'active');
    insertAccount.run('stubhub', 'john.doe@gmail.com', 'johndoe_sh', 'hashed_pw_3', 'active');
    insertAccount.run('stubhub', 'buyer2024@yahoo.com', null, 'hashed_pw_4', 'active');
    insertAccount.run('seatgeek', 'john.doe@gmail.com', 'jd_seatgeek', 'hashed_pw_5', 'active');
    insertAccount.run('axs', 'jane.smith@outlook.com', 'janeaxs', 'hashed_pw_6', 'inactive');
    insertAccount.run('seatgeek', 'scalperking@proton.me', 'scalperking', 'hashed_pw_7', 'active');
    insertAccount.run('vividseats', 'john.doe@gmail.com', 'johndoe_vv', 'hashed_pw_8', 'active');

    // Seed historical comparables for ROI projection
    const insertComp = db.prepare(`
      INSERT INTO historical_comparables (artist, venue, genre, event_date, face_value, avg_resale_price, min_resale_price, max_resale_price, roi_actual, demand_score_at_sale, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const historicalData = [
      // Taylor Swift comps
      { artist: 'Taylor Swift', venue: 'SoFi Stadium', genre: 'Pop', date: '2024-08-09', face: 250, avg: 890, min: 450, max: 2200, roi: 210, demand: 98, source: 'stubhub' },
      { artist: 'Taylor Swift', venue: 'MetLife Stadium', genre: 'Pop', date: '2024-05-26', face: 250, avg: 1100, min: 500, max: 3500, roi: 290, demand: 99, source: 'ticketmaster' },
      { artist: 'Taylor Swift', venue: 'Gillette Stadium', genre: 'Pop', date: '2024-06-14', face: 250, avg: 950, min: 400, max: 2800, roi: 240, demand: 97, source: 'seatgeek' },
      // Beyonce comps
      { artist: 'Beyoncé', venue: 'MetLife Stadium', genre: 'Pop', date: '2023-07-29', face: 300, avg: 680, min: 280, max: 1800, roi: 95, demand: 92, source: 'stubhub' },
      { artist: 'Beyoncé', venue: 'SoFi Stadium', genre: 'Pop', date: '2023-09-01', face: 300, avg: 720, min: 300, max: 2000, roi: 110, demand: 94, source: 'ticketmaster' },
      // Drake comps
      { artist: 'Drake', venue: 'Barclays Center', genre: 'Hip-Hop', date: '2023-11-15', face: 200, avg: 380, min: 180, max: 900, roi: 62, demand: 78, source: 'ticketmaster' },
      { artist: 'Drake', venue: 'Scotiabank Arena', genre: 'Hip-Hop', date: '2023-10-05', face: 200, avg: 420, min: 200, max: 1100, roi: 78, demand: 85, source: 'stubhub' },
      // Kendrick comps
      { artist: 'Kendrick Lamar', venue: 'Crypto.com Arena', genre: 'Hip-Hop', date: '2024-06-19', face: 210, avg: 550, min: 250, max: 1400, roi: 130, demand: 90, source: 'ticketmaster' },
      { artist: 'Kendrick Lamar', venue: 'The Forum', genre: 'Hip-Hop', date: '2024-04-17', face: 210, avg: 620, min: 280, max: 1600, roi: 155, demand: 93, source: 'seatgeek' },
      // Billie Eilish comps
      { artist: 'Billie Eilish', venue: 'The Forum', genre: 'Pop', date: '2024-04-10', face: 120, avg: 240, min: 110, max: 600, roi: 72, demand: 75, source: 'ticketmaster' },
      { artist: 'Billie Eilish', venue: 'Madison Square Garden', genre: 'Pop', date: '2024-10-08', face: 120, avg: 280, min: 130, max: 700, roi: 95, demand: 80, source: 'stubhub' },
      // Venue comps (SoFi Stadium)
      { artist: 'Bad Bunny', venue: 'SoFi Stadium', genre: 'Latin', date: '2024-03-02', face: 175, avg: 340, min: 160, max: 850, roi: 68, demand: 82, source: 'stubhub' },
      { artist: 'Ed Sheeran', venue: 'Rose Bowl', genre: 'Pop', date: '2023-09-23', face: 160, avg: 290, min: 140, max: 650, roi: 55, demand: 72, source: 'ticketmaster' },
      // Genre comps (Rock)
      { artist: 'Foo Fighters', venue: 'Wrigley Field', genre: 'Rock', date: '2024-07-17', face: 145, avg: 220, min: 120, max: 500, roi: 35, demand: 65, source: 'ticketmaster' },
      { artist: 'Green Day', venue: 'Wrigley Field', genre: 'Rock', date: '2024-09-14', face: 125, avg: 195, min: 100, max: 420, roi: 38, demand: 60, source: 'seatgeek' },
      // The Weeknd comps
      { artist: 'The Weeknd', venue: 'MetLife Stadium', genre: 'R&B', date: '2024-07-28', face: 180, avg: 390, min: 170, max: 950, roi: 85, demand: 82, source: 'ticketmaster' },
      { artist: 'The Weeknd', venue: 'SoFi Stadium', genre: 'R&B', date: '2024-11-16', face: 180, avg: 420, min: 190, max: 1050, roi: 100, demand: 86, source: 'stubhub' },
      // Country comps
      { artist: 'Morgan Wallen', venue: 'Nissan Stadium', genre: 'Country', date: '2024-06-22', face: 130, avg: 280, min: 110, max: 650, roi: 85, demand: 78, source: 'ticketmaster' },
      { artist: 'Kacey Musgraves', venue: 'Ryman Auditorium', genre: 'Country', date: '2024-03-10', face: 110, avg: 190, min: 95, max: 380, roi: 48, demand: 62, source: 'seatgeek' },
      // Lady Gaga comps
      { artist: 'Lady Gaga', venue: 'Dodger Stadium', genre: 'Pop', date: '2024-08-15', face: 220, avg: 480, min: 200, max: 1200, roi: 90, demand: 88, source: 'ticketmaster' },
      // SZA comps
      { artist: 'SZA', venue: 'Barclays Center', genre: 'R&B', date: '2024-02-14', face: 140, avg: 310, min: 130, max: 750, roi: 92, demand: 84, source: 'stubhub' },
      // Ariana Grande comps
      { artist: 'Ariana Grande', venue: 'United Center', genre: 'Pop', date: '2024-10-20', face: 200, avg: 440, min: 190, max: 1100, roi: 88, demand: 86, source: 'ticketmaster' },
      // Travis Scott comps
      { artist: 'Travis Scott', venue: 'NRG Stadium', genre: 'Hip-Hop', date: '2024-12-20', face: 190, avg: 410, min: 180, max: 1000, roi: 82, demand: 85, source: 'stubhub' },
      // Frank Ocean comps
      { artist: 'Frank Ocean', venue: 'Coachella', genre: 'R&B', date: '2023-04-16', face: 500, avg: 1200, min: 600, max: 3000, roi: 110, demand: 95, source: 'stubhub' },
    ];

    for (const h of historicalData) {
      insertComp.run(h.artist, h.venue, h.genre, h.date, h.face, h.avg, h.min, h.max, h.roi, h.demand, h.source);
    }
  });

  seedAll();
  console.log('Database seeded successfully!');
}

module.exports = seed;
