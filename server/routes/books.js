const express = require("express");
const router = express.Router();
const { getUserDb } = require("../database");

const { booksPage, metadata, dashboard } = require('../library-queries');
const { getWork, describeWork, matchingWorks, searchWorks, saveReading, linkReading, mergeReadingGroups } = require('../book-identities');

// Searches span every year, returning at most eight book identities.
router.get('/suggestions', (req, res) => res.json(searchWorks(getUserDb(req.user.uid), req.query.search,
  Number(req.query.exclude) || 0, req.query.grouped !== 'false')));
router.get('/works/:id/readings', (req, res) => {
  const db = getUserDb(req.user.uid);
  const work = getWork(db, req.params.id);
  const { pagination } = require('../library-queries');
  const { page, pageSize } = pagination(req.query, 50);
  const total = db.prepare('SELECT COUNT(*) AS n FROM books WHERE book_id = ?').get(work.id).n;
  res.json({ items: db.prepare('SELECT * FROM books WHERE book_id = ? ORDER BY year DESC, id DESC LIMIT ? OFFSET ?')
    .all(work.id, pageSize, (page - 1) * pageSize), page, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});
router.get('/:id/identity', (req, res) => {
  const db = getUserDb(req.user.uid);
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leitura n?o encontrada' });
  res.json({ work: describeWork(db, getWork(db, row.book_id)), matches: matchingWorks(db, row, row.book_id) });
});
router.post('/:id/link', (req, res) => {
  if (!req.body.book_id) return res.status(400).json({ error: 'Selecione o livro a vincular' });
  res.json(linkReading(getUserDb(req.user.uid), req.params.id, req.body.book_id));
});
router.post('/:id/unlink', (req, res) => res.json(linkReading(getUserDb(req.user.uid), req.params.id, null)));
router.post('/:id/merge', (req, res) => res.json(mergeReadingGroups(getUserDb(req.user.uid), req.params.id, req.body.book_ids)));


router.get('/metadata', (req, res) => res.json(metadata(getUserDb(req.user.uid))));
router.get('/dashboard', (req, res) => res.json(dashboard(getUserDb(req.user.uid), Number(req.query.year))));

// GET /api/books (unpaged response retained for older app versions)
router.get("/", (req, res) => {
  const db = getUserDb(req.user.uid);
  if (req.query.page !== undefined || req.query.pageSize !== undefined) {
    return res.json(booksPage(db, req.query));
  }
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

// POST /api/books ? a new reading, optionally of an existing book.
router.post("/", (req, res, next) => {
  try { res.status(201).json(saveReading(getUserDb(req.user.uid), req.body)); }
  catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message, matches: err.matches });
    next(err);
  }
});

router.put("/:id", (req, res) => res.json(saveReading(getUserDb(req.user.uid), req.body, req.params.id)));

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
