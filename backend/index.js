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
    console.error(err);
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
      [name || null, household, zip, repeat_visit || false]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
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
    console.error(err);
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
    console.error(err);
    res.status(500).send("Error");
  }
});

// =========================
// INVENTORY
// =========================
app.get("/inventory", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM "Inventory" ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.post("/inventory", async (req, res) => {
  try {
    let { name, quantity_received, source } = req.body;

    quantity_received = parseInt(quantity_received);

    if (!name || isNaN(quantity_received)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const result = await pool.query(
      `INSERT INTO "Inventory"
       (name, quantity_received, remaining_quantity, source)
       VALUES ($1, $2, $2, $3)
       RETURNING *`,
      [name, quantity_received, source || "unknown"]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// =========================
// DISTRIBUTION
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
      `INSERT INTO "Distribution"(inventory_id, quantity_used)
       VALUES ($1,$2)`,
      [inventory_id, quantity_used]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// =========================
// REPORTS
// =========================
app.get("/reports/summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.name, SUM(d.quantity_used) as total_used
      FROM "Distribution" d
      JOIN "Inventory" i ON i.id = d.inventory_id
      GROUP BY i.name
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.get("/reports/dashboard", async (req, res) => {
  try {
    const participants = await pool.query(`
      SELECT COUNT(*) as households, SUM(household) as individuals
      FROM "Participant"
    `);

    const distribution = await pool.query(`
      SELECT SUM(quantity_used) as total_distributed
      FROM "Distribution"
    `);

    res.json({
      households: participants.rows[0].households || 0,
      individuals: participants.rows[0].individuals || 0,
      total_distributed: distribution.rows[0].total_distributed || 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.get("/reports/full", async (req, res) => {
  try {
    const participants = await pool.query('SELECT * FROM "Participant"');
    const volunteers = await pool.query('SELECT * FROM "Volunteers"');
    const inventory = await pool.query('SELECT * FROM "Inventory"');
    const distribution = await pool.query('SELECT * FROM "Distribution"');

    res.json({
      participants: participants.rows,
      volunteers: volunteers.rows,
      inventory: inventory.rows,
      distribution: distribution.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// =========================
// DELETE ROUTES
// =========================
app.delete("/participants/:id", async (req,res)=>{
  await pool.query('DELETE FROM "Participant" WHERE id=$1',[req.params.id]);
  res.json({success:true});
});

app.delete("/volunteers/:id", async (req,res)=>{
  await pool.query('DELETE FROM "Volunteers" WHERE id=$1',[req.params.id]);
  res.json({success:true});
});

app.delete("/inventory/:id", async (req,res)=>{
  await pool.query('DELETE FROM "Inventory" WHERE id=$1',[req.params.id]);
  res.json({success:true});
});

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});