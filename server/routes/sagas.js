const express = require("express");
const router = express.Router();
const { getUserDb } = require("../database");

// GET /api/sagas — lista todas as sagas com os livros vinculados, em ordem de volume
router.get("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const sagas = db.prepare("SELECT * FROM sagas ORDER BY name").all();
  const result = sagas.map((s) => ({
    ...s,
    books: db.prepare(
      "SELECT * FROM books WHERE saga_id = ? ORDER BY (saga_order IS NULL), saga_order, created_at"
    ).all(s.id),
  }));
  res.json(result);
});

// POST /api/sagas — cria uma saga
router.post("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const { name } = req.body;
  if (!name || name.trim() === "") return res.status(400).json({ error: "Nome é obrigatório" });

  const existing = db.prepare("SELECT id FROM sagas WHERE name = ?").get(name.trim());
  if (existing) return res.status(400).json({ error: "Já existe uma saga com esse nome" });

  const result = db.prepare("INSERT INTO sagas (name) VALUES (?)").run(name.trim());
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
});

// PUT /api/sagas/:id — renomeia a saga
router.put("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);
  const { name } = req.body;
  if (!name || name.trim() === "") return res.status(400).json({ error: "Nome é obrigatório" });

  const saga = db.prepare("SELECT * FROM sagas WHERE id = ?").get(req.params.id);
  if (!saga) return res.status(404).json({ error: "Saga não encontrada" });

  const newName = name.trim();
  const existing = db.prepare("SELECT id FROM sagas WHERE name = ? AND id != ?").get(newName, saga.id);
  if (existing) return res.status(400).json({ error: "Já existe uma saga com esse nome" });

  db.prepare("UPDATE sagas SET name = ? WHERE id = ?").run(newName, saga.id);
  res.json({ id: saga.id, name: newName });
});

// DELETE /api/sagas/:id — remove a saga (os livros continuam existindo, apenas desvinculados)
router.delete("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);
  const saga = db.prepare("SELECT * FROM sagas WHERE id = ?").get(req.params.id);
  if (!saga) return res.status(404).json({ error: "Saga não encontrada" });

  db.prepare("UPDATE books SET saga_id = NULL, saga_order = NULL WHERE saga_id = ?").run(saga.id);
  db.prepare("DELETE FROM sagas WHERE id = ?").run(saga.id);
  res.json({ success: true });
});

module.exports = router;