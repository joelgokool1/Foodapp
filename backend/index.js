const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DATA STORAGE (IN MEMORY) =================
let participants = [];
let volunteers = [];
let inventory = [];

// ================= HELPERS =================
function now() {
  return new Date().toISOString();
}

function isSameDay(d1, d2){
  return new Date(d1).toDateString() === new Date(d2).toDateString();
}

// ================= PARTICIPANTS =================
app.post("/participants", (req, res) => {
  const { name, household, zip } = req.body;

  const record = {
    id: participants.length + 1,
    name,
    household: household || 0,
    zip,
    created_at: now()
  };

  participants.push(record);
  res.json(record);
});

app.get("/participants", (req, res) => {
  res.json(participants);
});

// ================= VOLUNTEERS =================
app.post("/volunteers", (req, res) => {
  const { name, role, shift_date } = req.body;

  const record = {
    id: volunteers.length + 1,
    name,
    role,
    shift_date,
    created_at: now()
  };

  volunteers.push(record);
  res.json(record);
});

app.get("/volunteers", (req, res) => {
  res.json(volunteers);
});

// ================= INVENTORY =================
app.post("/inventory", (req, res) => {
  const { name, number_of_boxes, items_per_box, source } = req.body;

  const qty = number_of_boxes * items_per_box;

  const record = {
    id: inventory.length + 1,
    name,
    number_of_boxes,
    items_per_box,
    quantity: qty,
    remaining_quantity: qty,
    source,
    created_at: now()
  };

  inventory.push(record);
  res.json(record);
});

app.get("/inventory", (req, res) => {
  res.json(inventory);
});

// ================= UPDATE END-OF-DAY USAGE =================
app.post("/inventory/reset", (req, res) => {
  const { id, remaining_quantity } = req.body;

  const item = inventory.find(i => i.id == id);
  if (!item) return res.status(404).send("Not found");

  item.remaining_quantity = parseInt(remaining_quantity);

  res.json(item);
});

// ================= DASHBOARD =================
app.get("/reports/dashboard", (req, res) => {
  const households = participants.length;

  const individuals = participants.reduce((sum, p) => {
    return sum + (p.household || 0);
  }, 0);

  const total_distributed = inventory.reduce((sum, i) => {
    return sum + (i.quantity - i.remaining_quantity);
  }, 0);

  res.json({
    households,
    individuals,
    total_distributed
  });
});

// ================= REPORT (USAGE TABLE) =================
app.get("/reports/usage", (req, res) => {
  const report = inventory.map(i => ({
    name: i.name,
    start_boxes: i.number_of_boxes,
    remaining_boxes: Math.ceil(i.remaining_quantity / i.items_per_box),
    used_boxes: i.number_of_boxes - Math.ceil(i.remaining_quantity / i.items_per_box)
  }));

  res.json(report);
});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("Server running on port 5000");
});