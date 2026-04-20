const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ YOUR RENDER DATABASE (FIXED WITH SSL + PORT)
const pool = new Pool({
  connectionString: "postgresql://foodappdb_olki_user:Y6b4XjgkuJ1ph8DIrjezAJ0lMG2xVnVV@dpg-d7colffaqgkc73fdted0-a.virginia-postgres.render.com:5432/foodapp_db_vgik",
  ssl: { rejectUnauthorized: false }
});

// ================= INIT TABLES =================
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      name TEXT,
      household INT,
      zip TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS volunteers (
      id SERIAL PRIMARY KEY,
      name TEXT,
      role TEXT,
      shift_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT,
      number_of_boxes INT,
      items_per_box INT,
      quantity INT,
      remaining_quantity INT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id SERIAL PRIMARY KEY,
      inventory_id INT,
      name TEXT,
      used INT,
      log_date TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ Tables Ready");
}
init();

// ================= DATE FILTER =================
function filterDate(query, type) {
  if (type === "today")
    return `${query} WHERE created_at::date = CURRENT_DATE`;

  if (type === "week")
    return `${query} WHERE created_at >= NOW() - INTERVAL '7 days'`;

  if (type === "month")
    return `${query} WHERE created_at >= NOW() - INTERVAL '30 days'`;

  return query;
}

// ================= PARTICIPANTS =================
app.post("/participants", async (req, res) => {
  const { name, household, zip } = req.body;

  await pool.query(
    `INSERT INTO participants (name, household, zip)
     VALUES ($1,$2,$3)`,
    [name || null, household || 0, zip || null]
  );

  res.json({ success: true });
});

// ================= VOLUNTEERS =================
app.post("/volunteers", async (req, res) => {
  const { name, role, shift_date } = req.body;

  await pool.query(
    `INSERT INTO volunteers (name, role, shift_date)
     VALUES ($1,$2,$3)`,
    [name, role, shift_date]
  );

  res.json({ success: true });
});

// ================= INVENTORY =================
app.post("/inventory", async (req, res) => {
  try {
    const { name, number_of_boxes, items_per_box } = req.body;

    const boxes = parseInt(number_of_boxes) || 0;
    const perBox = parseInt(items_per_box) || 0;
    const total = boxes * perBox;

    await pool.query(
      `INSERT INTO inventory
       (name, number_of_boxes, items_per_box, quantity, remaining_quantity)
       VALUES ($1,$2,$3,$4,$4)`,
      [name || "", boxes, perBox, total]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Inventory save failed" });
  }
});

app.get("/inventory", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM inventory ORDER BY id DESC`
  );
  res.json(result.rows);
});

// ================= END OF DAY UPDATE =================
app.post("/inventory/reset", async (req, res) => {
  const { id, remaining_quantity } = req.body;

  const item = await pool.query(
    `SELECT * FROM inventory WHERE id=$1`,
    [id]
  );

  if (!item.rows.length) return res.status(404).send("Not found");

  const used = item.rows[0].quantity - remaining_quantity;

  await pool.query(
    `INSERT INTO usage_logs (inventory_id, name, used)
     VALUES ($1,$2,$3)`,
    [id, item.rows[0].name, used]
  );

  await pool.query(
    `UPDATE inventory SET remaining_quantity=$1 WHERE id=$2`,
    [remaining_quantity, id]
  );

  res.json({ success: true });
});

// ================= DASHBOARD =================
app.get("/reports/dashboard", async (req, res) => {
  const filter = req.query.filter || "all";

  const p = await pool.query(
    filterDate(
      `SELECT COUNT(*) as households,
       COALESCE(SUM(household),0) as individuals
       FROM participants`,
      filter
    )
  );

  const u = await pool.query(`
    SELECT COALESCE(SUM(used),0) as total FROM usage_logs
  `);

  res.json({
    households: parseInt(p.rows[0].households),
    individuals: parseInt(p.rows[0].individuals),
    total_distributed: parseInt(u.rows[0].total)
  });
});

// ================= REPORT =================
app.get("/reports/usage", async (req, res) => {
const result = await pool.query(`
  SELECT name,
  quantity as start,
  remaining_quantity as remaining,
  (quantity - remaining_quantity) as used,
  created_at as date
  FROM inventory
`);


  res.json(result.rows);
});

// ================= EXPORT CSV =================
app.get("/reports/export", async (req, res) => {
  const p = await pool.query(`SELECT * FROM participants`);
  const v = await pool.query(`SELECT * FROM volunteers`);
  const i = await pool.query(`
    SELECT name,
    quantity,
    remaining_quantity,
    (quantity - remaining_quantity) as used,
    created_at
    FROM inventory
  `);

  let csv = "";

  // PARTICIPANTS
  csv += "PARTICIPANTS\n";
  csv += "Name,Household,Zip,Date\n";
  p.rows.forEach(x => {
    csv += `${x.name},${x.household},${x.zip},${x.created_at}\n`;
  });

  csv += "\n";

  // VOLUNTEERS
  csv += "VOLUNTEERS\n";
  csv += "Name,Role,Shift Date\n";
  v.rows.forEach(x => {
    csv += `${x.name},${x.role},${x.shift_date}\n`;
  });

  csv += "\n";

  // INVENTORY
  csv += "INVENTORY USAGE\n";
  csv += "Item,Start,Remaining,Used,Date\n";
  i.rows.forEach(x => {
    csv += `${x.name},${x.quantity},${x.remaining_quantity},${x.used},${x.created_at}\n`;
  });

  res.header("Content-Type", "text/csv");
  res.attachment("foodapp_report.csv");
  res.send(csv);
});
// ================= SERVER =================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});