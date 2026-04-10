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
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:foodapp@localhost:5432/foodapp",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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

// GET ALL
app.get("/participants", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Participant" ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("DB ERROR:", err.message);
    res.status(500).send("Database error");
  }
});

// ADD PARTICIPANT
app.post("/participants", async (req, res) => {
  try {
    const { name, household, zip, repeat_visit } = req.body;

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM "Participant"
      WHERE DATE(visit_date) = CURRENT_DATE
    `);

    const dailyId = parseInt(countResult.rows[0].count) + 1;

    const result = await pool.query(
      `INSERT INTO "Participant"
       (name, household, zip, repeat_visit, visit_date)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [name || null, household, zip, repeat_visit || false]
    );

    res.json({
      ...result.rows[0],
      daily_id: dailyId
    });

  } catch (err) {
    console.error("INSERT ERROR:", err.message);
    res.status(500).send("Insert error");
  }
});

// =========================
// INVENTORY
// =========================

// GET INVENTORY
// =========================
// INVENTORY
// =========================

// GET INVENTORY
app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Inventory" ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("INVENTORY ERROR:", err.message);
    res.status(500).send("Inventory error");
  }
});

// ADD INVENTORY (FIXED TO MATCH FRONTEND)
app.post("/inventory", async (req, res) => {
  try {
    const { name, quantity_received, source } = req.body;

    console.log("Incoming inventory:", req.body);

    const result = await pool.query(
      `INSERT INTO "Inventory" (name, quantity_received, remaining_quantity, source)
       VALUES ($1, $2, $2, $3)
       RETURNING *`,
      [name, quantity_received, source]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("INVENTORY INSERT ERROR:", err.message);
    res.status(500).send("Insert error");
  }
});

// 🔥 ADD THIS (YOU DID NOT HAVE IT BEFORE)
app.post("/inventory/distribute", async (req, res) => {
  try {
    const { inventory_id, quantity_used } = req.body;

    console.log("Distribute:", req.body);

    await pool.query(
      `UPDATE "Inventory"
       SET remaining_quantity = remaining_quantity - $1
       WHERE id = $2`,
      [quantity_used, inventory_id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("DISTRIBUTE ERROR:", err.message);
    res.status(500).send("Distribute error");
  }
});

// ADD INVENTORY ITEM
app.post("/inventory", async (req, res) => {
  try {
    const { name, category, quantity, expiry } = req.body;

    const result = await pool.query(
      `INSERT INTO "Inventory" (name, category, quantity, expiry)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, category, quantity, expiry]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("INVENTORY INSERT ERROR:", err.message);
    res.status(500).send("Insert error");
  }
});

// =========================
// VOLUNTEERS / SHIFTS
// =========================

// GET SHIFTS
app.get("/shifts", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Volunteers" ORDER BY shift_date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("SHIFT ERROR:", err.message);
    res.status(500).send("Shift error");
  }
});

// ADD SHIFT
app.post("/shifts", async (req, res) => {
  try {
    const { name, role, shift_date, capacity } = req.body;

    const result = await pool.query(
      `INSERT INTO "Volunteers"(name, role, shift_date, capacity)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name || "Volunteer", role, shift_date, capacity || 0]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("SHIFT INSERT ERROR:", err.message);
    res.status(500).send("Insert error");
  }
});

// =========================
// SERVER START (IMPORTANT)
// =========================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});