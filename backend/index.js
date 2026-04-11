const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// DATABASE CONNECTION
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =========================
// TEST ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("API running");
});

// =========================
// PARTICIPANTS
// =========================
app.get("/participants", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM "Participant" ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("PARTICIPANT ERROR:", err);
    res.status(500).send("Database error");
  }
});

app.post("/participants", async (req, res) => {
  try {
    const { name, household, zip, repeat_visit } = req.body;

    const result = await pool.query(
      `INSERT INTO "Participant"
       (name, household, zip, repeat_visit, visit_date)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [name || null, household, zip, repeat_visit || false]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("INSERT ERROR:", err);
    res.status(500).send("Insert error");
  }
});

// =========================
// VOLUNTEERS
// =========================
app.get("/volunteers", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM "Volunteers" ORDER BY shift_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("VOL ERROR:", err);
    res.status(500).send("Error");
  }
});

app.post("/volunteers", async (req, res) => {
  try {
    const { name, role, shift_date } = req.body;

    const result = await pool.query(
      `INSERT INTO "Volunteers"(name, role, shift_date)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name || "Volunteer", role, shift_date]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("VOL INSERT ERROR:", err);
    res.status(500).send("Error");
  }
});

// =========================
// INVENTORY
// =========================

// GET INVENTORY
app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM "Inventory" ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("INVENTORY ERROR:", err);
    res.status(500).send("Inventory error");
  }
});

// ADD INVENTORY
app.post("/inventory", async (req, res) => {
  try {
    let { name, quantity_received, source } = req.body;

    console.log("Incoming inventory:", req.body);

    quantity_received = parseInt(quantity_received);

    if (!name || isNaN(quantity_received)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    const result = await pool.query(
      `INSERT INTO "Inventory"
       (name, quantity_received, remaining_quantity, source)
       VALUES ($1, $2, $2, $3)
       RETURNING *`,
      [name, quantity_received, source || "unknown"]
    );

    console.log("SAVED TO DB:", result.rows[0]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error("INSERT FAILED:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DISTRIBUTE INVENTORY
app.post("/inventory/distribute", async (req, res) => {
  try {
    const { inventory_id, quantity_used } = req.body;

    if (!inventory_id || !quantity_used) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await pool.query(
      `UPDATE "Inventory"
       SET remaining_quantity = remaining_quantity - $1
       WHERE id = $2`,
      [quantity_used, inventory_id]
    );

    await pool.query(
      `INSERT INTO "Distribution"(inventory_id, quantity_used)
       VALUES ($1,$2)`,
      [inventory_id, quantity_used]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("DISTRIBUTE ERROR:", err);
    res.status(500).send("Error");
  }
});

// REPORT
app.get("/reports/summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.name,
        SUM(d.quantity_used) as total_used
      FROM "Distribution" d
      JOIN "Inventory" i ON i.id = d.inventory_id
      GROUP BY i.name
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("REPORT ERROR:", err);
    res.status(500).send("Error generating report");
  }
});

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});