const express = require("express");
const router  = express.Router();
const { getUserDb } = require("../database");

// GET /api/categories — lista todas com subcategorias
router.get("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const parents = db.prepare("SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name").all();
  const result  = parents.map(p => ({
    ...p,
    subcategories: db.prepare("SELECT * FROM categories WHERE parent_id = ? ORDER BY name").all(p.id)
  }));
  res.json(result);
});

// POST /api/categories — cria categoria ou subcategoria
router.post("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const { name, parent_id } = req.body;
  if (!name || name.trim() === "") return res.status(400).json({ error: "Nome é obrigatório" });

  // Verifica duplicata no mesmo nível
  const existing = db.prepare(
    "SELECT id FROM categories WHERE name = ? AND (parent_id IS ? OR parent_id = ?)"
  ).get(name.trim(), parent_id ?? null, parent_id ?? null);
  if (existing) return res.status(400).json({ error: "Categoria já existe" });

  const result = db.prepare(
    "INSERT INTO categories (name, parent_id) VALUES (?, ?)"
  ).run(name.trim(), parent_id ?? null);

  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    parent_id: parent_id ?? null
  });
});

// DELETE /api/categories/:id — remove categoria e subcategorias
router.delete("/:id", (req, res) => {
  const db  = getUserDb(req.user.uid);
  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!cat) return res.status(404).json({ error: "Categoria não encontrada" });
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;