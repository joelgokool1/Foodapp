const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("API Running");
});

//
// ================= PARTICIPANTS =================
//
app.post("/participants", async (req, res) => {
  try {
    const { name, household, zip, repeat_visit } = req.body;

    const data = await prisma.participant.create({
      data: {
        name: name || null,
        household: household ? parseInt(household) : null,
        zip: zip || null,
        repeat_visit: repeat_visit || false,
        visit_date: new Date()
      },
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/participants", async (req, res) => {
  const data = await prisma.participant.findMany({
    orderBy: { visit_date: "desc" }
  });
  res.json(data);
});

//
// ================= VOLUNTEERS =================
//
app.post("/volunteers", async (req, res) => {
  try {
    const { name, role, shift_date } = req.body;

    const data = await prisma.volunteer.create({
      data: {
        name,
        role,
        shift_date: new Date(shift_date)
      }
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/volunteers", async (req, res) => {
  const data = await prisma.volunteer.findMany({
    orderBy: { shift_date: "desc" }
  });
  res.json(data);
});

//
// ================= INVENTORY (BOX MODEL) =================
//
app.post("/inventory", async (req, res) => {
  try {
    let { name, number_of_boxes, items_per_box, source } = req.body;

    number_of_boxes = parseInt(number_of_boxes);
    items_per_box = parseInt(items_per_box);

    if (!name || isNaN(number_of_boxes) || isNaN(items_per_box)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const total_quantity = number_of_boxes * items_per_box;

    const data = await prisma.inventory.create({
      data: {
        name,
        number_of_boxes,
        items_per_box,
        quantity: total_quantity,
        remaining_quantity: total_quantity,
        source: source || "unknown",
        created_at: new Date()
      }
    });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/inventory", async (req, res) => {
  const data = await prisma.inventory.findMany({
    orderBy: { created_at: "desc" }
  });
  res.json(data);
});

//
// ================= UPDATE REMAINING (KEY FEATURE) =================
//
app.post("/inventory/reset", async (req, res) => {
  try {
    const { id, remaining_quantity } = req.body;

    if (!id || remaining_quantity === undefined) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const updated = await prisma.inventory.update({
      where: { id },
      data: {
        remaining_quantity: parseInt(remaining_quantity)
      }
    });

    res.json(updated);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ================= DISTRIBUTION (LOG USAGE PER DAY) =================
//
app.post("/distribute", async (req, res) => {
  const { inventoryId, quantity_used } = req.body;

  try {
    // 1. CREATE DISTRIBUTION LOG
    const record = await prisma.distribution.create({
      data: {
        inventoryId,
        quantity_used,
        distributed_at: new Date()
      }
    });

    // 2. UPDATE INVENTORY
    await prisma.inventory.update({
      where: { id: inventoryId },
      data: {
        remaining_quantity: {
          decrement: quantity_used
        }
      }
    });

    res.json(record);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ================= REPORTS =================
//
app.get("/reports/dashboard", async (req, res) => {
  try {
    const participants = await prisma.participant.aggregate({
      _count: { id: true },
      _sum: { household: true }
    });

    const distribution = await prisma.distribution.aggregate({
      _sum: { quantity_used: true }
    });

    res.json({
      households: participants._count.id || 0,
      individuals: participants._sum.household || 0,
      total_distributed: distribution._sum.quantity_used || 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ================= SERVER =================
//
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});