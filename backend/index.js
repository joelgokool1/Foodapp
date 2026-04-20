const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ DATABASE
const pool = new Pool({
  connectionString: "postgresql://foodappdb_olki_user:Y6b4XjgkuJ1ph8DIrjezAJ0lMG2xVnVV@dpg-d7colffaqgkc73fdted0-a.virginia-postgres.render.com:5432/foodapp_db_vgik",
  ssl: { rejectUnauthorized: false }
});

// ================= INIT =================
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      name TEXT,
      household INT,
      zip TEXT,
      repeat_visit BOOLEAN,
      visit_date TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS volunteers (
      id SERIAL PRIMARY KEY,
      name TEXT,
      role TEXT,
      shift_date DATE
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT,
      quantity_received INT,
      remaining_quantity INT,
      source TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS distribution (
      id SERIAL PRIMARY KEY,
      inventory_id INT,
      quantity_used INT,
      distributed_at TIMESTAMP DEFAULT NOW()
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
    [name, household, zip, repeat_visit]
  );

  res.json({ success: true });
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
  const { name, role, shift_date } = req.body;

  await pool.query(
    `INSERT INTO volunteers (name, role, shift_date)
     VALUES ($1,$2,$3)`,
    [name, role, shift_date]
  );

  res.json({ success: true });
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
app.post("/inventory", async (req, res) => {
  const { name, quantity_received, source } = req.body;

  await pool.query(
    `INSERT INTO inventory (name, quantity_received, remaining_quantity, source)
     VALUES ($1,$2,$2,$3)`,
    [name, quantity_received, source]
  );

  res.json({ success: true });
});

app.get("/inventory", async (req, res) => {
  const data = await pool.query(`SELECT * FROM inventory ORDER BY id DESC`);
  res.json(data.rows);
});

app.delete("/inventory/:id", async (req, res) => {
  await pool.query(`DELETE FROM inventory WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
});

// ================= DISTRIBUTE =================
app.post("/inventory/distribute", async (req, res) => {
  const { inventory_id, quantity_used } = req.body;

  await pool.query(
    `INSERT INTO distribution (inventory_id, quantity_used)
     VALUES ($1,$2)`,
    [inventory_id, quantity_used]
  );

  await pool.query(
    `UPDATE inventory
     SET remaining_quantity = remaining_quantity - $1
     WHERE id=$2`,
    [quantity_used, inventory_id]
  );

  res.json({ success: true });
});

// ================= REPORT =================
app.get("/reports/summary", async (req, res) => {
  const data = await pool.query(`
    SELECT i.id, i.name,
    COALESCE(SUM(d.quantity_used),0) as total_used
    FROM inventory i
    LEFT JOIN distribution d ON i.id=d.inventory_id
    GROUP BY i.id
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
    SELECT COALESCE(SUM(quantity_used),0) as total FROM distribution
  `);

  res.json({
    households: parseInt(p.rows[0].households),
    individuals: parseInt(p.rows[0].individuals),
    total_distributed: parseInt(d.rows[0].total)
  });
});

// ================= FULL EXPORT =================
app.get("/reports/full", async (req, res) => {
  const participants = await pool.query(`SELECT * FROM participants`);
  const volunteers = await pool.query(`SELECT * FROM volunteers`);
  const inventory = await pool.query(`SELECT * FROM inventory`);
  const distribution = await pool.query(`SELECT * FROM distribution`);

  res.json({
    participants: participants.rows,
    volunteers: volunteers.rows,
    inventory: inventory.rows,
    distribution: distribution.rows
  });
});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});