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
      repeat_visit BOOLEAN DEFAULT false,
      visit_date TIMESTAMP DEFAULT NOW()
    );
  `);

  // VOLUNTEERS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS volunteers (
      id SERIAL PRIMARY KEY,
      name TEXT,
      role TEXT,
      shift_date DATE
    );
  `);

  // INVENTORY (CLEAN STRUCTURE)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT,
      boxes_start FLOAT DEFAULT 0,
      items_per_box INT DEFAULT 0,
      boxes_end FLOAT DEFAULT 0,
      source TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ Tables ready");
}
init();

// ================= PARTICIPANTS =================
app.post("/participants", async (req, res) => {
  const { name, household, zip, repeat_visit } = req.body;

  await pool.query(
    `INSERT INTO participants (name, household, zip, repeat_visit)
     VALUES ($1,$2,$3,$4)`,
    [name || "", household || 0, zip || "", repeat_visit || false]
  );

  res.json({ success: true });
});

app.get("/participants", async (req, res) => {
  const data = await pool.query(`SELECT * FROM participants ORDER BY id DESC`);
  res.json(data.rows);
});
// DELETE PARTICIPANT
app.delete("/participants/:id", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM participants WHERE id=$1`,
      [req.params.id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("❌ DELETE PARTICIPANT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
// ================= VOLUNTEERS =================
app.post("/volunteers", async (req, res) => {
  const { name, role, shift_date } = req.body;

  await pool.query(
    `INSERT INTO volunteers (name, role, shift_date)
     VALUES ($1,$2,$3)`,
    [name || "", role || "", shift_date]
  );

  res.json({ success: true });
});

app.get("/volunteers", async (req, res) => {
  const data = await pool.query(`SELECT * FROM volunteers ORDER BY id DESC`);
  res.json(data.rows);
});
app.delete("/volunteers/:id", async (req, res) => {
  await pool.query(
    `DELETE FROM volunteers WHERE id=$1`,
    [req.params.id]
  );

  res.json({ success: true });
});
// ================= INVENTORY =================

// ADD INVENTORY
app.post("/inventory", async (req, res) => {
  try {
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
    SELECT 
      id,
      name,
      boxes_start,
      items_per_box,
      boxes_end,
      created_at,

      (boxes_start * items_per_box) AS quantity_start,
      (boxes_end * items_per_box) AS quantity_end,
      ((boxes_start * items_per_box) - (boxes_end * items_per_box)) AS food_served

    FROM inventory
    ORDER BY id DESC
  `);

  res.json(data.rows);
});

// UPDATE END
app.post("/inventory/update-end", async (req, res) => {
  const { id, boxes_end } = req.body;

  await pool.query(
    `UPDATE inventory SET boxes_end=$1 WHERE id=$2`,
    [Number(boxes_end), id]
  );

  res.json({ success: true });
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

// ================= EXPORT =================
app.get("/reports/full", async (req, res) => {
  const participants = await pool.query(`SELECT * FROM participants`);
  const volunteers = await pool.query(`SELECT * FROM volunteers`);
  const inventory = await pool.query(`SELECT * FROM inventory`);

  res.json({
    participants: participants.rows,
    volunteers: volunteers.rows,
    inventory: inventory.rows,
    distribution: []
  });
});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});