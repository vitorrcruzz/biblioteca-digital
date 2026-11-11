// A work identifies the book; books retains each individual reading and its public API.
// Shared columns in books are compatibility snapshots, synchronized by a trigger.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');

function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function migrateBookIdentities(db) {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS book_works (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT NOT NULL,
      title_key TEXT NOT NULL, author_key TEXT NOT NULL, saga_id INTEGER, saga_order REAL
    )`);
    if (!db.prepare('PRAGMA table_info(books)').all().some(c => c.name === 'book_id')) {
      db.exec('ALTER TABLE books ADD COLUMN book_id INTEGER REFERENCES book_works(id)');
    }
    const insert = db.prepare(`INSERT INTO book_works(title, author, title_key, author_key, saga_id, saga_order)
      VALUES (?, ?, ?, ?, ?, ?)`);
    const assign = db.prepare('UPDATE books SET book_id = ? WHERE id = ?');
    for (const row of db.prepare('SELECT * FROM books WHERE book_id IS NULL').all()) {
      const work = insert.run(row.title, row.author, normalize(row.title), normalize(row.author), row.saga_id, row.saga_order);
      assign.run(work.lastInsertRowid, row.id);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS books_identity_idx ON books(book_id);
      CREATE INDEX IF NOT EXISTS work_match_idx ON book_works(title_key, author_key, saga_id);
      CREATE INDEX IF NOT EXISTS work_saga_idx ON book_works(saga_id, saga_order);
      CREATE TRIGGER IF NOT EXISTS work_shared_update AFTER UPDATE OF title, author, saga_id, saga_order ON book_works
      BEGIN
        UPDATE books SET title = NEW.title, author = NEW.author, saga_id = NEW.saga_id,
          saga_order = NEW.saga_order, updated_at = datetime('now') WHERE book_id = NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS work_cleanup_delete AFTER DELETE ON books BEGIN
        DELETE FROM book_works WHERE id = OLD.book_id AND NOT EXISTS (SELECT 1 FROM books WHERE book_id = OLD.book_id);
      END;
      CREATE TRIGGER IF NOT EXISTS work_cleanup_move AFTER UPDATE OF book_id ON books BEGIN
        DELETE FROM book_works WHERE id = OLD.book_id AND NOT EXISTS (SELECT 1 FROM books WHERE book_id = OLD.book_id);
      END;
      CREATE TRIGGER IF NOT EXISTS work_saga_delete AFTER DELETE ON sagas BEGIN
        UPDATE book_works SET saga_id = NULL, saga_order = NULL WHERE saga_id = OLD.id;
      END;`);
  })();
}

function getWork(db, id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('Livro inválido');
  const work = db.prepare('SELECT * FROM book_works WHERE id = ?').get(Number(id));
  if (!work) fail('Livro não encontrado nesta conta', 404);
  return work;
}

function describeWork(db, work) {
  const latest = db.prepare('SELECT * FROM books WHERE book_id = ? ORDER BY year DESC, id DESC LIMIT 1').get(work.id);
  const counts = db.prepare(`SELECT COUNT(*) AS reading_count, SUM(status = 'finished') AS finished_count
    FROM books WHERE book_id = ?`).get(work.id);
  const unfinished = db.prepare(`SELECT id, year, status FROM books WHERE book_id = ? AND status != 'finished'
    ORDER BY year DESC, id DESC LIMIT 1`).get(work.id);
  return { ...latest, ...counts, book_id: work.id, title: work.title, author: work.author,
    saga_id: work.saga_id, saga_order: work.saga_order,
    saga_name: db.prepare('SELECT name FROM sagas WHERE id = ?').get(work.saga_id)?.name || '',
    unfinished: unfinished || null };
}

// Collapse suggestions only. Existing identities/readings are never merged by a search.
function describeSuggestion(db, work) {
  const result = describeWork(db, work);
  const from = `FROM books b JOIN book_works w ON w.id = b.book_id
    WHERE w.title_key = ? AND w.author_key = ? AND w.saga_id IS ? AND w.saga_order IS ?`;
  const params = [work.title_key, work.author_key, work.saga_id, work.saga_order];
  const latest = db.prepare(`SELECT b.* ${from} ORDER BY b.year DESC, b.id DESC LIMIT 1`).get(...params);
  const unfinished = db.prepare(`SELECT b.id, b.year, b.status ${from} AND b.status != 'finished'
    ORDER BY b.year DESC, b.id DESC LIMIT 1`).get(...params);
  return { ...result, pages: latest.pages, category: latest.category, subcategory: latest.subcategory,
    unfinished: unfinished || null };
}

function matchingWorks(db, data, exclude = 0, grouped = false) {
  // Pages, year, dates and rating intentionally do not participate in matching.
  return db.prepare(`SELECT * FROM book_works WHERE title_key = ? AND author_key = ?
    AND saga_id IS ? AND (saga_order IS NULL OR ? IS NULL OR saga_order = ?) AND id != ?
    ${grouped ? 'GROUP BY title_key, author_key, saga_id, saga_order HAVING id = MIN(id)' : ''}
    ORDER BY id LIMIT 10`)
    .all(normalize(data.title), normalize(data.author), data.saga_id ?? null,
      data.saga_order ?? null, data.saga_order ?? null, exclude).map(w => grouped ? describeSuggestion(db, w) : describeWork(db, w));
}

function searchWorks(db, term, exclude = 0, grouped = true) {
  if (typeof term !== 'string' || term.trim().length < 2) return [];
  const key = normalize(term).slice(0, 200);
  return db.prepare(`SELECT * FROM book_works WHERE id != ? AND (instr(title_key, ?) > 0 OR instr(author_key, ?) > 0)
    ${grouped ? 'GROUP BY title_key, author_key, saga_id, saga_order HAVING id = MIN(id)' : ''}
    ORDER BY CASE WHEN title_key = ? THEN 0 ELSE 1 END, title_key, id LIMIT 8`)
    .all(exclude, key, key, key).map(w => grouped ? describeSuggestion(db, w) : describeWork(db, w));
}

function sharedFields(db, data) {
  if (typeof data.title !== 'string' || !data.title.trim()) fail('Título é obrigatório');
  if (typeof data.author !== 'string') fail('Autor inválido');
  const saga_id = data.saga_id === '' || data.saga_id == null ? null : Number(data.saga_id);
  const saga_order = saga_id == null || data.saga_order === '' || data.saga_order == null ? null : Number(data.saga_order);
  if (saga_id != null && (!Number.isSafeInteger(saga_id) || !db.prepare('SELECT id FROM sagas WHERE id = ?').get(saga_id))) fail('Saga inválida');
  if (saga_order != null && (!Number.isFinite(saga_order) || saga_order < 0)) fail('Volume inválido');
  return { title: data.title.trim(), author: data.author.trim(), saga_id, saga_order };
}

function insertWork(db, fields) {
  return db.prepare(`INSERT INTO book_works(title, author, title_key, author_key, saga_id, saga_order)
    VALUES (?, ?, ?, ?, ?, ?)`).run(fields.title, fields.author, normalize(fields.title), normalize(fields.author),
      fields.saga_id, fields.saga_order).lastInsertRowid;
}

function readingFields(data, old = {}) {
  const row = { category: '', subcategory: '', pages: 0, year: 0, status: 'reading', start_date: null,
    end_date: null, rating: 0, is_reread: 0, ...old, ...data };
  if (!['reading', 'finished', 'paused'].includes(row.status)) fail('Status inválido');
  for (const key of ['pages', 'year']) {
    if (!Number.isSafeInteger(row[key]) || row[key] < 0) fail('Páginas e ano devem ser números inteiros positivos');
  }
  if (typeof row.rating !== 'number' || !Number.isFinite(row.rating) || row.rating < 0 || row.rating > 5) fail('Avaliação inválida');
  for (const key of ['category', 'subcategory']) if (typeof row[key] !== 'string') fail('Categoria inválida');
  for (const key of ['start_date', 'end_date']) {
    if (row[key] === '') row[key] = null;
    if (row[key] !== null && (typeof row[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row[key]))) fail('Data inválida');
  }
  row.is_reread = row.is_reread ? 1 : 0;
  return row;
}

function saveReading(db, data, id = null) {
  return db.transaction(() => {
    const old = id == null ? null : db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    if (id != null && !old) fail('Leitura não encontrada', 404);
    const reading = readingFields(data, old || {});
    let work;
    if (old) {
      if (data.book_id !== undefined && Number(data.book_id) !== old.book_id) fail('Use a opção de vincular leituras para trocar o livro');
      work = sharedFields(db, { ...old, ...data });
      if (['title', 'author', 'saga_id', 'saga_order'].some(key => work[key] !== old[key])) {
        db.prepare(`UPDATE book_works SET title = ?, author = ?, title_key = ?, author_key = ?, saga_id = ?, saga_order = ? WHERE id = ?`)
          .run(work.title, work.author, normalize(work.title), normalize(work.author), work.saga_id, work.saga_order, old.book_id);
      }
      work.id = old.book_id;
    } else if (data.book_id != null) {
      work = getWork(db, data.book_id);
      // Existing book information is authoritative. A reread only adds reading-specific data.
      reading.is_reread = 1;
    } else {
      work = sharedFields(db, { author: '', ...data });
      const matches = matchingWorks(db, work, 0, true);
      if (data.create_separate !== true && matches.length) {
        const e = new Error('Este livro já pode estar no seu acervo. Escolha uma leitura existente ou confirme um livro diferente.');
        e.status = 409; e.matches = matches; throw e;
      }
      work.id = insertWork(db, work);
    }
    const values = [work.title, work.author, reading.category, reading.subcategory, reading.pages, reading.year,
      reading.status, reading.start_date, reading.end_date, reading.rating, reading.is_reread, work.saga_id, work.saga_order, work.id];
    let readingId = id;
    if (old) {
      db.prepare(`UPDATE books SET title=?, author=?, category=?, subcategory=?, pages=?, year=?, status=?,
        start_date=?, end_date=?, rating=?, is_reread=?, saga_id=?, saga_order=?, book_id=?, updated_at=datetime('now') WHERE id=?`).run(...values, id);
    } else {
      readingId = db.prepare(`INSERT INTO books(title, author, category, subcategory, pages, year, status,
        start_date, end_date, rating, is_reread, saga_id, saga_order, book_id) VALUES (${values.map(() => '?').join(',')})`).run(...values).lastInsertRowid;
    }
    return db.prepare('SELECT * FROM books WHERE id = ?').get(readingId);
  })();
}

// Explicit user choice only. The reading's pages, dates, rating and year never change.
function linkReading(db, id, targetId) {
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    if (!row) fail('Leitura não encontrada', 404);
    const target = targetId == null ? { ...row, id: insertWork(db, row) } : getWork(db, targetId);
    db.prepare(`UPDATE books SET book_id=?, title=?, author=?, saga_id=?, saga_order=?, updated_at=datetime('now') WHERE id=?`)
      .run(target.id, target.title, target.author, target.saga_id, target.saga_order, id);
    return db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  })();
}

// Merge whole groups, rather than moving just one reading away from its history.
function mergeReadingGroups(db, readingId, bookIds) {
  if (!Array.isArray(bookIds) || !bookIds.length || bookIds.length > 50 ||
      bookIds.some(id => !Number.isSafeInteger(id) || id < 1)) fail('Selecione os registros do mesmo livro');
  return db.transaction(() => {
    const reading = db.prepare('SELECT * FROM books WHERE id = ?').get(readingId);
    if (!reading) fail('Leitura não encontrada', 404);
    const target = getWork(db, reading.book_id);
    // Validate every source before updating anything, scoped to this user's database.
    const sources = [...new Set(bookIds)].filter(id => id !== target.id).map(id => getWork(db, id));
    const move = db.prepare(`UPDATE books SET book_id=?, title=?, author=?, saga_id=?, saga_order=?,
      updated_at=datetime('now') WHERE book_id=?`);
    for (const source of sources) {
      move.run(target.id, target.title, target.author, target.saga_id, target.saga_order, source.id);
    }
    return describeWork(db, target);
  })();
}

module.exports = { migrateBookIdentities, getWork, describeWork, matchingWorks, searchWorks, saveReading, linkReading, mergeReadingGroups };
