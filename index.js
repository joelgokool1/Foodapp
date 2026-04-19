// ✅ KEEP YOUR EXISTING IMPORTS
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =========================
// PARTICIPANTS (UPDATED)
// =========================

// ❌ REMOVE FRONTEND DISPLAY NEED → KEEP API FOR REPORTING ONLY
app.get("/participants", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM "Participant" ORDER BY visit_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Error");
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
      [
        name || null,
        household ? parseInt(household) : null, // ✅ OPTIONAL
        zip || null,
        repeat_visit || false
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

// =========================
// INVENTORY (UPDATED MODEL)
// =========================

app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM "Inventory" ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/inventory", async (req, res) => {
  try {
    let { name, number_of_boxes, items_per_box, source } = req.body;

    number_of_boxes = parseInt(number_of_boxes);
    items_per_box = parseInt(items_per_box);

    if (!name || isNaN(number_of_boxes) || isNaN(items_per_box)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const total_quantity = number_of_boxes * items_per_box;

    const result = await pool.query(
      `INSERT INTO "Inventory"
      (name, number_of_boxes, items_per_box, quantity, remaining_quantity, source, created_at)
      VALUES ($1,$2,$3,$4,$4,$5,NOW())
      RETURNING *`,
      [name, number_of_boxes, items_per_box, total_quantity, source || "unknown"]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

// =========================
// DISTRIBUTION (ADD TIMESTAMP)
// =========================
app.post("/inventory/distribute", async (req, res) => {
  try {
    const { inventory_id, quantity_used } = req.body;

    await pool.query(
      `UPDATE "Inventory"
       SET remaining_quantity = remaining_quantity - $1
       WHERE id = $2`,
      [quantity_used, inventory_id]
    );

    await pool.query(
      `INSERT INTO "Distribution"
      (inventory_id, quantity_used, distributed_at)
      VALUES ($1,$2,NOW())`,
      [inventory_id, quantity_used]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("Error");
  }
});

// =========================
// REPORTS (UNCHANGED BUT SAFE)
// =========================
app.get("/reports/dashboard", async (req, res) => {
  try {
    const participants = await pool.query(`
      SELECT COUNT(*) as households,
      COALESCE(SUM(household),0) as individuals
      FROM "Participant"
    `);

    const distribution = await pool.query(`
      SELECT COALESCE(SUM(quantity_used),0) as total_distributed
      FROM "Distribution"
    `);

    res.json({
      households: participants.rows[0].households,
      individuals: participants.rows[0].individuals,
      total_distributed: distribution.rows[0].total_distributed
    });

  } catch (err) {
    res.status(500).send("Error");
  }
});

// =========================
// SERVER
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});