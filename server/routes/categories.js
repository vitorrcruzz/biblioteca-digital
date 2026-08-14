const express = require("express");
const router = express.Router();
const { getUserDb } = require("../database");

// GET /api/categories — lista todas com subcategorias
router.get("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const parents = db.prepare("SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name").all();
  const result = parents.map(p => ({
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

// PUT /api/categories/:id — renomeia categoria ou subcategoria
router.put("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);
  const { name } = req.body;
  if (!name || name.trim() === "") return res.status(400).json({ error: "Nome é obrigatório" });

  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!cat) return res.status(404).json({ error: "Categoria não encontrada" });

  const newName = name.trim();

  // Verifica duplicata no mesmo nível (ignorando o próprio registro)
  const existing = db.prepare(
    "SELECT id FROM categories WHERE name = ? AND (parent_id IS ? OR parent_id = ?) AND id != ?"
  ).get(newName, cat.parent_id, cat.parent_id, cat.id);
  if (existing) return res.status(400).json({ error: "Já existe uma categoria com esse nome" });

  const oldName = cat.name;
  db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(newName, cat.id);

  // Propaga o novo nome para os livros que já usam essa categoria/subcategoria
  if (cat.parent_id === null) {
    db.prepare("UPDATE books SET category = ? WHERE category = ?").run(newName, oldName);
  } else {
    const parent = db.prepare("SELECT name FROM categories WHERE id = ?").get(cat.parent_id);
    if (parent) {
      db.prepare("UPDATE books SET subcategory = ? WHERE category = ? AND subcategory = ?")
        .run(newName, parent.name, oldName);
    }
  }

  res.json({ id: cat.id, name: newName, parent_id: cat.parent_id });
});

// DELETE /api/categories/:id — remove categoria (e subcategorias) e limpa os livros vinculados
router.delete("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);
  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!cat) return res.status(404).json({ error: "Categoria não encontrada" });

  // Evita deixar livros com uma categoria/subcategoria "fantasma" após a exclusão
  if (cat.parent_id === null) {
    db.prepare("UPDATE books SET category = '', subcategory = '' WHERE category = ?").run(cat.name);
  } else {
    const parent = db.prepare("SELECT name FROM categories WHERE id = ?").get(cat.parent_id);
    if (parent) {
      db.prepare("UPDATE books SET subcategory = '' WHERE category = ? AND subcategory = ?")
        .run(parent.name, cat.name);
    }
  }

  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id); // ON DELETE CASCADE remove subcategorias
  res.json({ success: true });
});

module.exports = router;