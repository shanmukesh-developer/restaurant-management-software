const path = require('path');
const fs = require('fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

let db;

// In production (Render), use the persistent disk mount at /data
// Locally, use a /data folder inside the project
const DATA_DIR = process.env.RENDER ? '/data' : path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'besta.db');

// Create the data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function getDb() {
  if (db) return db;
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      table_number INTEGER NOT NULL,
      label TEXT DEFAULT '',
      UNIQUE(restaurant_id, table_number),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS restaurant_menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      is_veg INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      available INTEGER DEFAULT 1,
      spice_level TEXT DEFAULT 'Medium',
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS restaurant_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      table_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      total_price REAL DEFAULT 0,
      special_request TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS restaurant_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      customization TEXT DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES restaurant_orders(id)
    );

    CREATE TABLE IF NOT EXISTS tables_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER UNIQUE NOT NULL,
      label TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      total_price REAL DEFAULT 0,
      special_request TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      customization TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS staff_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      token TEXT NOT NULL,
      UNIQUE(role, token)
    );

    CREATE TABLE IF NOT EXISTS staff_pins (
      role TEXT PRIMARY KEY,
      pin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      guests INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'Confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema migrations for performance analytics
  try { await db.exec('ALTER TABLE orders ADD COLUMN preparing_at DATETIME'); } catch (e) {}
  try { await db.exec('ALTER TABLE orders ADD COLUMN ready_at DATETIME'); } catch (e) {}
  try { await db.exec('ALTER TABLE restaurant_orders ADD COLUMN preparing_at DATETIME'); } catch (e) {}
  try { await db.exec('ALTER TABLE restaurant_orders ADD COLUMN ready_at DATETIME'); } catch (e) {}

  // Seed tables 1-20
  const tableCount = await db.get('SELECT COUNT(*) as count FROM tables_list');
  if (tableCount.count === 0) {
    for (let i = 1; i <= 20; i++) {
      await db.run('INSERT INTO tables_list (table_number, label) VALUES (?, ?)', [i, `Table ${i}`]);
    }
  }

  // Seed default staff PINs
  const pinCount = await db.get('SELECT COUNT(*) as count FROM staff_pins');
  if (pinCount.count === 0) {
    await db.run("INSERT INTO staff_pins (role, pin) VALUES ('admin', '1234')");
    await db.run("INSERT INTO staff_pins (role, pin) VALUES ('kitchen', '5678')");
    await db.run("INSERT INTO staff_pins (role, pin) VALUES ('waiter', '4321')");
  }

  // Seed menu items (real Besta menu data)
  const menuCount = await db.get('SELECT COUNT(*) as count FROM menu_items');
  if (menuCount.count === 0) {
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
      await db.run(
        'INSERT INTO menu_items (name, price, category, is_veg, description, spice_level) VALUES (?, ?, ?, ?, ?, ?)',
        item
      );
    }
  }

  return db;
}

module.exports = { getDb };
