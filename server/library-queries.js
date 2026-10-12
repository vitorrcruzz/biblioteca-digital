// Queries shared by paginated routes and dashboard summaries.
const bookOrder = "COALESCE(NULLIF(end_date, ''), NULLIF(start_date, ''), '') DESC, created_at DESC, id DESC";

function pagination(query, maxSize) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? maxSize : Number(query.pageSize);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > maxSize) {
    const error = new Error(`Invalid pagination: page >= 1, pageSize between 1 and ${maxSize}`);
    error.status = 400;
    throw error;
  }
  return { page, pageSize };
}

function pageQuery(db, from, params, order, query, maxSize, columns = '*') {
  const requested = pagination(query, maxSize);
  const total = db.prepare(`SELECT COUNT(*) AS total ${from}`).get(...params).total;
  const totalPages = Math.max(1, Math.ceil(total / requested.pageSize));
  const page = Math.min(requested.page, totalPages);
  const items = db.prepare(`SELECT ${columns} ${from} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, requested.pageSize, (page - 1) * requested.pageSize);
  return { items, total, page, pageSize: requested.pageSize, totalPages };
}

function booksPage(db, query) {
  let from = 'FROM books WHERE 1=1';
  const params = [];
  for (const key of ['year', 'category', 'subcategory', 'status', 'saga_id']) {
    if (query[key] !== undefined && query[key] !== '') {
      if (typeof query[key] !== 'string') {
        const error = new Error('Invalid filter'); error.status = 400; throw error;
      }
      from += ` AND ${key} = ?`;
      params.push(query[key]);
    }
  }
  if (query.search) {
    if (typeof query.search !== 'string') {
      const error = new Error('Invalid search'); error.status = 400; throw error;
    }
    // Match the old JS search: Unicode case folding and literal substrings (no LIKE wildcards).
    db.function('library_contains', { deterministic: true }, (value, term) =>
      String(value || '').toLowerCase().includes(term.toLowerCase()) ? 1 : 0);
    from += ' AND (library_contains(title, ?) OR library_contains(author, ?))';
    params.push(query.search, query.search);
  }
  const order = query.saga_id ? '(saga_order IS NULL), saga_order, created_at, id' : bookOrder;
  return pageQuery(db, from, params, order, query, 50);
}

function metadata(db) {
  return {
    years: db.prepare('SELECT DISTINCT year FROM books ORDER BY year DESC').all().map(row => row.year),
    categories: db.prepare("SELECT DISTINCT category FROM books WHERE category != '' ORDER BY category").all().map(row => row.category),
    categoryCounts: db.prepare('SELECT category, subcategory, COUNT(*) AS total FROM books GROUP BY category, subcategory').all(),
  };
}

function dashboard(db, year) {
  if (!Number.isSafeInteger(year) || year < 1) {
    const error = new Error('Invalid year'); error.status = 400; throw error;
  }
  const stats = db.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(status = 'finished'), 0) AS finished,
    COALESCE(SUM(status = 'reading'), 0) AS reading,
    COALESCE(SUM(CASE WHEN status = 'finished' THEN pages ELSE 0 END), 0) AS pages,
    COALESCE(AVG(CASE WHEN status = 'finished' AND rating > 0 THEN rating END), 0) AS rating,
    COALESCE(AVG(CASE WHEN status = 'finished' AND start_date != '' AND end_date != ''
      THEN julianday(end_date) - julianday(start_date) + 1 END), 0) AS duration
    FROM books WHERE year = ?`).get(year);
  const months = Array(12).fill(0);
  db.prepare(`SELECT CAST(substr(end_date, 6, 2) AS INTEGER) AS month, COUNT(*) AS total
    FROM books WHERE year = ? AND status = 'finished' AND end_date IS NOT NULL GROUP BY month`).all(year)
    .forEach(row => { if (row.month >= 1 && row.month <= 12) months[row.month - 1] = row.total; });
  return {
    stats, months,
    categories: db.prepare(`SELECT category, COUNT(*) AS total FROM books
      WHERE year = ? AND status = 'finished' AND category != '' GROUP BY category ORDER BY category`).all(year),
    recent: db.prepare(`SELECT * FROM books WHERE year = ? ORDER BY ${bookOrder} LIMIT 8`).all(year),
  };
}

function sagasPage(db, query) {
  return pageQuery(db, 'FROM sagas s', [], 's.name, s.id', query, 10,
    `s.*, (SELECT COUNT(*) FROM books b WHERE b.saga_id = s.id) AS total,
     (SELECT COUNT(*) FROM books b WHERE b.saga_id = s.id AND b.status = 'finished') AS finished`);
}
module.exports = { pagination, booksPage, metadata, dashboard, sagasPage };
