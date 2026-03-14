const { Pool } = require('pg');

let dbWrapper;

// ─── SQLite-compatible wrapper over node-postgres ───────────────
// Exposes .all(), .get(), .run() so route files need zero changes.

function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

function createWrapper(pool) {
  return {
    async all(sql, params = []) {
      const result = await pool.query(convertPlaceholders(sql), params);
      return result.rows;
    },
    async get(sql, params = []) {
      const result = await pool.query(convertPlaceholders(sql), params);
      return result.rows[0] || undefined;
    },
    async run(sql, params = []) {
      const pgSql = convertPlaceholders(sql);
      // For INSERT, append RETURNING id to get lastID
      let finalSql = pgSql;
      const isInsert = /^\s*INSERT\s/i.test(sql);
      if (isInsert && !/RETURNING/i.test(pgSql)) {
        finalSql = pgSql + ' RETURNING id';
      }
      const result = await pool.query(finalSql, params);
      return {
        lastID: isInsert && result.rows.length > 0 ? result.rows[0].id : undefined,
        changes: result.rowCount
      };
    },
    async exec(sql) {
      await pool.query(sql);
    }
  };
}

async function getDb() {
  if (dbWrapper) return dbWrapper;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.RENDER
      ? { rejectUnauthorized: false }
      : false
  });

  dbWrapper = createWrapper(pool);

  // ─── Create tables (PostgreSQL syntax) ────────────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      cuisine TEXT DEFAULT '',
      city TEXT DEFAULT '',
      tagline TEXT DEFAULT '',
      brand_color TEXT DEFAULT '#C9A84C',
      table_count INTEGER DEFAULT 10,
      pin TEXT NOT NULL,
      owner_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      table_number INTEGER NOT NULL,
      label TEXT DEFAULT '',
      UNIQUE(restaurant_id, table_number)
    );

    CREATE TABLE IF NOT EXISTS restaurant_menu_items (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      is_veg INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      available INTEGER DEFAULT 1,
      spice_level TEXT DEFAULT 'Medium'
    );

    CREATE TABLE IF NOT EXISTS restaurant_orders (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      table_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      total_price REAL DEFAULT 0,
      special_request TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      preparing_at TIMESTAMP,
      ready_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS restaurant_order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES restaurant_orders(id),
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      customization TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tables_list (
      id SERIAL PRIMARY KEY,
      table_number INTEGER UNIQUE NOT NULL,
      label TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      is_veg INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      available INTEGER DEFAULT 1,
      spice_level TEXT DEFAULT 'Medium'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      total_price REAL DEFAULT 0,
      special_request TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      preparing_at TIMESTAMP,
      ready_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      customization TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS staff_tokens (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL,
      token TEXT NOT NULL,
      UNIQUE(role, token)
    );

    CREATE TABLE IF NOT EXISTS staff_pins (
      role TEXT PRIMARY KEY,
      pin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      guests INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'Confirmed',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // ─── Seed tables 1-20 ────────────────────────────────────────
  const tableCount = await dbWrapper.get('SELECT COUNT(*) as count FROM tables_list');
  if (parseInt(tableCount.count) === 0) {
    for (let i = 1; i <= 20; i++) {
      await dbWrapper.run('INSERT INTO tables_list (table_number, label) VALUES (?, ?)', [i, `Table ${i}`]);
    }
  }

  // ─── Seed default staff PINs ─────────────────────────────────
  const pinCount = await dbWrapper.get('SELECT COUNT(*) as count FROM staff_pins');
  if (parseInt(pinCount.count) === 0) {
    await dbWrapper.run("INSERT INTO staff_pins (role, pin) VALUES (?, ?)", ['admin', '1234']);
    await dbWrapper.run("INSERT INTO staff_pins (role, pin) VALUES (?, ?)", ['kitchen', '5678']);
    await dbWrapper.run("INSERT INTO staff_pins (role, pin) VALUES (?, ?)", ['waiter', '4321']);
  }

  // ─── Seed menu items ─────────────────────────────────────────
  const menuCount = await dbWrapper.get('SELECT COUNT(*) as count FROM menu_items');
  if (parseInt(menuCount.count) === 0) {
    const menuItems = [
      // Biryani
      ['Chicken Dum Biryani', 539, 'Biryani', 0, 'Slow-cooked aromatic basmati rice with tender chicken', 'Medium'],
      ['Chicken Fry Biryani', 539, 'Biryani', 0, 'Biryani layered with crispy fried chicken pieces', 'Spicy'],
      ['Tangdi Biryani', 539, 'Biryani', 0, 'Juicy tangdi chicken cooked into fragrant biryani', 'Medium'],
      ['Chicken Tikka Biryani', 539, 'Biryani', 0, 'Chargrilled tikka chicken infused in biryani', 'Medium'],
      ['Mughlai Biryani', 539, 'Biryani', 0, 'Rich Mughal-style biryani with aromatic spices', 'Mild'],
      ['Ulavacharu Biryani (Chicken)', 549, 'Biryani', 0, 'Unique horse gram curry-based biryani — Besta special', 'Spicy'],
      ['Ulavacharu Biryani (Mutton)', 829, 'Biryani', 0, 'Tender mutton in signature ulavacharu biryani', 'Spicy'],
      ['Mutton Kheema Biryani', 819, 'Biryani', 0, 'Minced mutton cooked in layers of spiced basmati', 'Spicy'],
      ['Prawns Biryani', 689, 'Biryani', 0, 'Fresh prawns layered in aromatic biryani rice', 'Medium'],
      ['Bezawada Boneless Biryani', 589, 'Biryani', 0, 'Vijayawada-style spicy boneless chicken biryani', 'Very Spicy'],
      ['Egg Biryani', 489, 'Biryani', 0, 'Fluffy eggs cooked into fragrant biryani rice', 'Medium'],
      ['Mushroom Biryani', 479, 'Biryani', 1, 'Fresh mushrooms slow-cooked in aromatic basmati rice', 'Medium'],
      ['Ulavacharu Biryani (Veg)', 509, 'Biryani', 1, 'Signature horse gram curry biryani — vegetarian style', 'Medium'],
      // Appetizers
      ['Chicken Majestic', 389, 'Appetizers', 0, 'Crispy fried chicken tossed in spicy yogurt sauce — Hyderabadi classic', 'Spicy'],
      ['Dynamite Chicken', 349, 'Appetizers', 0, 'Fiery fried chicken with chilli sauce and sesame', 'Very Spicy'],
      ['Chicken 65', 299, 'Appetizers', 0, 'Classic Indian deep-fried spicy chicken starter', 'Spicy'],
      ['Gobi Manchurian', 249, 'Appetizers', 1, 'Crispy cauliflower tossed in Indo-Chinese manchurian sauce', 'Medium'],
      ['Veg Spring Rolls', 199, 'Appetizers', 1, 'Crispy golden rolls filled with spiced vegetables', 'Mild'],
      // Tandoori
      ['Murgh Malai Tikka', 449, 'Tandoori', 0, 'Creamy white marinade chicken cooked in tandoor oven', 'Mild'],
      ['Tandoori Chicken (Half)', 399, 'Tandoori', 0, 'Classic half chicken marinated and roasted in tandoor', 'Medium'],
      ['Tandoori Chicken (Full)', 749, 'Tandoori', 0, 'Full chicken slow-roasted to perfection in tandoor', 'Medium'],
      ['Paneer Tikka', 349, 'Tandoori', 1, 'Marinated cottage cheese cubes chargrilled in tandoor', 'Medium'],
      // Curries
      ['Butter Chicken', 399, 'Curries', 0, 'Tender chicken in a rich, creamy tomato-butter gravy', 'Mild'],
      ['Paneer Tikka Masala', 349, 'Curries', 1, 'Grilled paneer in spiced onion-tomato masala gravy', 'Medium'],
      ['Meethi Chaman', 299, 'Curries', 1, 'Cottage cheese in a sweet, aromatic fenugreek gravy', 'Mild'],
      ['Dal Tadka', 249, 'Curries', 1, 'Yellow lentils tempered with cumin, garlic and chilli', 'Medium'],
      ['Chicken Curry', 349, 'Curries', 0, 'Home-style spiced chicken in thick onion-tomato gravy', 'Spicy'],
      // Soups
      ['Manchow Soup (Chicken)', 199, 'Soups', 0, 'Spicy Indo-Chinese noodle soup with chicken', 'Spicy'],
      ['Manchow Soup (Veg)', 169, 'Soups', 1, 'Spicy Indo-Chinese noodle soup with vegetables', 'Spicy'],
      ['Sweet Corn Soup', 149, 'Soups', 1, 'Creamy sweet corn soup', 'Mild'],
      // Breads
      ['Butter Naan', 60, 'Breads', 1, 'Soft leavened bread baked in tandoor with butter', 'Mild'],
      ['Garlic Naan', 70, 'Breads', 1, 'Tandoor-baked naan topped with garlic and butter', 'Mild'],
      ['Laccha Paratha', 55, 'Breads', 1, 'Layered whole-wheat paratha from the tandoor', 'Mild'],
      ['Tandoori Roti', 40, 'Breads', 1, 'Whole wheat roti baked in tandoor oven', 'Mild'],
      // Desserts
      ['Gulab Jamun', 120, 'Desserts', 1, 'Soft milk-solid dumplings soaked in rose-flavored syrup', 'Mild'],
      ['Phirni', 149, 'Desserts', 1, 'Chilled ground rice pudding with cardamom and saffron', 'Mild'],
      ['Kulfi', 129, 'Desserts', 1, 'Traditional Indian ice cream — pistachio & cardamom', 'Mild'],
      // Beverages
      ['Mango Lassi', 149, 'Beverages', 1, 'Chilled mango yogurt drink — thick and refreshing', 'Mild'],
      ['Sweet Lassi', 99, 'Beverages', 1, 'Chilled sweet yogurt drink with rose water', 'Mild'],
      ['Masala Chai', 49, 'Beverages', 1, 'Classic spiced Indian tea with ginger and cardamom', 'Mild'],
      ['Fresh Lime Soda', 79, 'Beverages', 1, 'Fresh lime juice with soda — sweet or salted', 'Mild'],
    ];
    for (const item of menuItems) {
      await dbWrapper.run(
        'INSERT INTO menu_items (name, price, category, is_veg, description, spice_level) VALUES (?, ?, ?, ?, ?, ?)',
        item
      );
    }
  }

  return dbWrapper;
}

module.exports = { getDb };
