const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================= INIT =================
async function init() {

  // PARTICIPANTS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      name TEXT,
      household INT,
      zip TEXT,
      repeat_visit BOOLEAN,
      visit_date TIMESTAMP DEFAULT NOW()
    );
  `);
await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS boxes_start INT`);
await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS items_per_box INT`);
await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS boxes_end INT DEFAULT 0`);
await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  // VOLUNTEERS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS volunteers (
      id SERIAL PRIMARY KEY,
      name TEXT,
      role TEXT,
      shift_date DATE
    );
  `);

  // INVENTORY (NEW SYSTEM)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT,
      boxes_start INT,
      items_per_box INT,
      boxes_end INT DEFAULT 0,
      source TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
// 🔥 FORCE FIX INVENTORY TABLE
await pool.query(`
  ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS boxes_start INT DEFAULT 0
`);

await pool.query(`
  ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS items_per_box INT DEFAULT 0
`);

await pool.query(`
  ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS boxes_end INT DEFAULT 0
`);

await pool.query(`
  ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
`);
  console.log("✅ Tables ready");
}
init();

// ================= PARTICIPANTS =================
app.post("/participants", async (req, res) => {
  try {
    const { name, household, zip, repeat_visit } = req.body;

    await pool.query(
      `INSERT INTO participants (name, household, zip, repeat_visit)
       VALUES ($1,$2,$3,$4)`,
      [
        name || "",
        parseInt(household) || 0,
        zip || "",
        repeat_visit || false
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Participant save failed" });
  }
});

app.get("/participants", async (req, res) => {
  const data = await pool.query(`SELECT * FROM participants ORDER BY id DESC`);
  res.json(data.rows);
});

app.delete("/participants/:id", async (req, res) => {
  await pool.query(`DELETE FROM participants WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
});

// ================= VOLUNTEERS =================
app.post("/volunteers", async (req, res) => {
  try {
    const { name, role, shift_date } = req.body;

    await pool.query(
      `INSERT INTO volunteers (name, role, shift_date)
       VALUES ($1,$2,$3)`,
      [name || "", role || "", shift_date]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Volunteer save failed" });
  }
});

app.get("/volunteers", async (req, res) => {
  const data = await pool.query(`SELECT * FROM volunteers ORDER BY id DESC`);
  res.json(data.rows);
});

app.delete("/volunteers/:id", async (req, res) => {
  await pool.query(`DELETE FROM volunteers WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
});

// ================= INVENTORY =================

// ADD INVENTORY
app.post("/inventory", async (req, res) => {
  try {
    console.log("🔥 INVENTORY BODY:", req.body);

    const { name, boxes_start, items_per_box, source } = req.body;

    await pool.query(
      `INSERT INTO inventory (name, boxes_start, items_per_box, source)
       VALUES ($1,$2,$3,$4)`,
      [
        name || "",
        Number(boxes_start),
        Number(items_per_box),
        source || ""
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("❌ INVENTORY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET INVENTORY
app.get("/inventory", async (req, res) => {
  const data = await pool.query(`
    SELECT *,
    (boxes_start * items_per_box) AS quantity_start,
    (COALESCE(boxes_end,0) * items_per_box) AS quantity_end,
    ((boxes_start * items_per_box) - (COALESCE(boxes_end,0) * items_per_box)) AS food_served
    FROM inventory
    ORDER BY id DESC
  `);

  res.json(data.rows);
});

// UPDATE END OF DAY
app.post("/inventory/update-end", async (req, res) => {
  try {
    const { id, boxes_end } = req.body;

    await pool.query(
      `UPDATE inventory SET boxes_end=$1 WHERE id=$2`,
      [parseInt(boxes_end) || 0, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// DELETE
app.delete("/inventory/:id", async (req, res) => {
  await pool.query(`DELETE FROM inventory WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
});

// ================= REPORT =================
app.get("/reports/summary", async (req, res) => {
  const data = await pool.query(`
    SELECT 
      id,
      name,
      (boxes_start * items_per_box) - (COALESCE(boxes_end,0) * items_per_box) AS total_used
    FROM inventory
  `);

  res.json(data.rows);
});

// ================= DASHBOARD =================
app.get("/reports/dashboard", async (req, res) => {

  const p = await pool.query(`
    SELECT COUNT(*) as households,
    COALESCE(SUM(household),0) as individuals
    FROM participants
  `);

  const d = await pool.query(`
    SELECT COALESCE(SUM((boxes_start * items_per_box) - (COALESCE(boxes_end,0) * items_per_box)),0) as total 
    FROM inventory
  `);

  res.json({
    households: parseInt(p.rows[0].households),
    individuals: parseInt(p.rows[0].individuals),
    total_distributed: parseInt(d.rows[0].total)
  });
});

// ================= EXPORT =================
app.get("/reports/full", async (req, res) => {
  try {
    const participants = await pool.query(`SELECT * FROM participants`);
    const volunteers = await pool.query(`SELECT * FROM volunteers`);

    const inventory = await pool.query(`
      SELECT 
        id,
        name,
        COALESCE(boxes_start,0) as boxes_start,
        COALESCE(items_per_box,0) as items_per_box,
        COALESCE(boxes_end,0) as boxes_end,
        created_at,

        (COALESCE(boxes_start,0) * COALESCE(items_per_box,0)) AS quantity_start,
        (COALESCE(boxes_end,0) * COALESCE(items_per_box,0)) AS quantity_end,
        ((COALESCE(boxes_start,0) * COALESCE(items_per_box,0)) 
        - (COALESCE(boxes_end,0) * COALESCE(items_per_box,0))) AS food_served

      FROM inventory
    `);

    res.json({
      participants: participants.rows,
      volunteers: volunteers.rows,
      inventory: inventory.rows,
      distribution: []   // 🔥 prevents frontend crash
    });

  } catch (err) {
    console.error("🔥 EXPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});