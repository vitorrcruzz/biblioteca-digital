const express = require("express");
const router = express.Router();
const { getUserDb } = require("../database");

// GET /api/books
router.get("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  const { year, category, subcategory, status, search } = req.query;

  let query = "SELECT * FROM books WHERE 1=1";
  const params = [];

  if (year) { query += " AND year = ?"; params.push(Number(year)); }
  if (category) { query += " AND category = ?"; params.push(category); }
  if (subcategory) { query += " AND subcategory = ?"; params.push(subcategory); }
  if (status) { query += " AND status = ?"; params.push(status); }
  if (search) { query += " AND (title LIKE ? OR author LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  query += " ORDER BY created_at DESC";
  res.json(db.prepare(query).all(...params));
});

// GET /api/books/:id
router.get("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Livro não encontrado" });
  res.json(book);
});

// POST /api/books
router.post("/", (req, res) => {
  const db = getUserDb(req.user.uid);

  // Garante que a coluna subcategory existe
  try { db.exec("ALTER TABLE books ADD COLUMN subcategory TEXT DEFAULT ''"); } catch (e) { }

  const { title, author, category, subcategory, pages, year, status, start_date, end_date, rating, is_reread } = req.body;
  if (!title) return res.status(400).json({ error: "Título é obrigatório" });

  const result = db.prepare(`
    INSERT INTO books (title, author, category, subcategory, pages, year, status, start_date, end_date, rating, is_reread)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, author ?? "", category ?? "", subcategory ?? "", pages ?? 0, year ?? 0,
    status ?? "reading", start_date ?? null, end_date ?? null,
    rating ?? 0, is_reread ? 1 : 0);

  res.status(201).json(db.prepare("SELECT * FROM books WHERE id = ?").get(result.lastInsertRowid));
});

// PUT /api/books/:id
router.put("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);

  // Garante que a coluna subcategory existe
  try { db.exec("ALTER TABLE books ADD COLUMN subcategory TEXT DEFAULT ''"); } catch (e) { }

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Livro não encontrado" });

  const { title, author, category, subcategory, pages, year, status, start_date, end_date, rating, is_reread } = req.body;
  db.prepare(`
    UPDATE books SET
      title = ?, author = ?, category = ?, subcategory = ?, pages = ?, year = ?,
      status = ?, start_date = ?, end_date = ?, rating = ?,
      is_reread = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? book.title,
    author ?? book.author,
    category ?? book.category,
    subcategory ?? book.subcategory ?? "",
    pages ?? book.pages,
    year ?? book.year,
    status ?? book.status,
    start_date ?? book.start_date,
    end_date ?? book.end_date,
    rating ?? book.rating,
    is_reread !== undefined ? (is_reread ? 1 : 0) : book.is_reread,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id));
});

// DELETE /api/books/:id
router.delete("/:id", (req, res) => {
  const db = getUserDb(req.user.uid);
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Livro não encontrado" });
  db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  res.json({ message: "Livro removido com sucesso" });
});

// DELETE /api/books/year/:year
router.delete("/year/:year", (req, res) => {
  const db = getUserDb(req.user.uid);
  const year = Number(req.params.year);
  if (!year) return res.status(400).json({ error: "Ano inválido" });
  const result = db.prepare("DELETE FROM books WHERE year = ?").run(year);
  res.json({ deleted: result.changes });
});

module.exports = router;