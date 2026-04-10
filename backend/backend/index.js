const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// ROOT
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
        household,
        zip,
        repeat_visit: repeat_visit || false,
      },
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/participants", async (req, res) => {
  const data = await prisma.participant.findMany();
  res.json(data);
});

//
// ================= INVENTORY (NEW STRUCTURE) =================
//
app.post("/inventory", async (req, res) => {
  try {
    const data = await prisma.inventory.create({
      data: {
        item_name: req.body.item_name,
        category: req.body.category,
        quantity_received: req.body.quantity_received,
        remaining_quantity: req.body.quantity_received,
        source: req.body.source,
        site: req.body.site,
        batch_number: req.body.batch_number,
        received_date: new Date(),
      },
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/inventory", async (req, res) => {
  const data = await prisma.inventory.findMany();
  res.json(data);
});

//
// ================= VOLUNTEERS =================
//
app.post("/volunteers", async (req, res) => {
  const data = await prisma.volunteer.create({ data: req.body });
  res.json(data);
});

app.get("/volunteers", async (req, res) => {
  const data = await prisma.volunteer.findMany();
  res.json(data);
});

//
// ================= DISTRIBUTION (CORE LOGIC) =================
//
app.post("/distribute", async (req, res) => {
  const { participantId, inventoryId, volunteerId, quantity } = req.body;

  try {
    // 1. CREATE DISTRIBUTION RECORD
    const record = await prisma.distribution.create({
      data: {
        participantId,
        inventoryId,
        volunteerId,
        quantity,
      },
    });

    // 2. UPDATE INVENTORY
    await prisma.inventory.update({
      where: { id: inventoryId },
      data: {
        remaining_quantity: {
          decrement: quantity,
        },
        quantity_distributed: {
          increment: quantity,
        },
        distributed_date: new Date(),
      },
    });

    res.json(record);
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