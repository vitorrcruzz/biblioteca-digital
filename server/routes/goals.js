const express = require("express");
const router  = express.Router();
const { getUserDb } = require("../database");

// GET /api/goals
router.get("/", (req, res) => {
  const db    = getUserDb(req.user.uid);
  const goals = db.prepare("SELECT * FROM goals").all();
  res.json(goals);
});

// POST /api/goals
router.post("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const { year, target } = req.body;
  if (!year || !target) return res.status(400).json({ error: "Ano e meta são obrigatórios" });
  db.prepare(`
    INSERT INTO goals (year, target) VALUES (?, ?)
    ON CONFLICT(year) DO UPDATE SET target = excluded.target
  `).run(Number(year), Number(target));
  res.json({ year: Number(year), target: Number(target) });
});

// DELETE /api/goals/:year
router.delete("/:year", (req, res) => {
  const year = Number(req.params.year);
  if (!year) return res.status(400).json({ error: "Ano inválido" });
  const db = getUserDb(req.user.uid);
  db.prepare("DELETE FROM goals WHERE year = ?").run(year);
  res.json({ deleted: true });
});

module.exports = router;