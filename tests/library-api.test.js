const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const express = require('express');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const queries = require('../server/library-queries');

function database(size = 1001) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author TEXT, year INTEGER,
    category TEXT, subcategory TEXT, status TEXT, pages INTEGER, rating REAL,
    start_date TEXT, end_date TEXT, created_at TEXT, saga_id INTEGER, saga_order REAL);
    CREATE TABLE sagas (id INTEGER PRIMARY KEY, name TEXT);`);
  const insert = db.prepare('INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    for (let i = 1; i <= size; i++) insert.run(i, `Livro ${i}`, 'Autor', i % 2 ? 2026 : 2025,
      i % 2 ? 'HQ' : 'Fantasia', '', i % 2 ? 'finished' : 'reading', 100, i % 2 ? 4 : 0,
      '2026-01-01', i % 2 ? '2026-01-10' : null, '2026-01-01', 1, i);
    for (let i = 1; i <= 21; i++) db.prepare('INSERT INTO sagas VALUES (?, ?)').run(i, `Saga ${String(i).padStart(2, '0')}`);
  })();
  return db;
}

test('pagination covers the collection without duplicates and clamps after deletion', () => {
  const db = database();
  try {
    const ids = [];
    for (let page = 1; page <= 21; page++) {
      const result = queries.booksPage(db, {page, pageSize: 50});
      assert.equal(result.total, 1001);
      assert.equal(result.items.length, page === 21 ? 1 : 50);
      ids.push(...result.items.map(b => b.id));
    }
    assert.equal(new Set(ids).size, 1001);
    db.prepare('DELETE FROM books WHERE id = ?').run(ids.at(-1));
    assert.equal(queries.booksPage(db, {page: 21}).page, 20);
    db.exec('DELETE FROM books');
    assert.deepEqual(queries.booksPage(db, {page: 9}), {items: [], total: 0, page: 1, pageSize: 50, totalPages: 1});
  } finally {db.close();}
});

test('filters operate on the whole collection and search is literal and Unicode-aware', () => {
  const db = database();
  try {
    assert.equal(queries.booksPage(db, {search: 'Livro 1001'}).total, 1);
    assert.equal(queries.booksPage(db, {year: '2026', category: 'HQ', status: 'finished'}).total, 501);
    db.prepare('UPDATE books SET title = ? WHERE id = 1001').run('A??O 100%_');
    assert.equal(queries.booksPage(db, {search: 'a??o'}).items[0].id, 1001);
    assert.equal(queries.booksPage(db, {search: '%_'}).total, 1);
    assert.equal(queries.booksPage(db, {search: "' OR 1=1 --"}).total, 0);
    for (const page of [0, -1, 1.5, 'abc', Infinity]) assert.throws(() => queries.booksPage(db, {page}), {status: 400});
    for (const pageSize of [0, -1, 51, 1.5]) assert.throws(() => queries.booksPage(db, {pageSize}), {status: 400});
  } finally {db.close();}
});

test('dashboard and metadata summarize all records, not just a page', () => {
  const db = database();
  try {
    const data = queries.dashboard(db, 2026);
    assert.equal(data.stats.total, 501);
    assert.equal(data.stats.finished, 501);
    assert.equal(data.stats.pages, 50100);
    assert.equal(data.stats.rating, 4);
    assert.equal(data.stats.duration, 10);
    assert.equal(data.months[0], 501);
    assert.deepEqual(data.categories, [{category: 'HQ', total: 501}]);
    assert.equal(data.recent.length, 8);
    assert.deepEqual(queries.metadata(db).years, [2026, 2025]);
    assert.equal(queries.metadata(db).categoryCounts.reduce((sum, row) => sum + row.total, 0), 1001);
    const empty = queries.dashboard(db, 2030);
    assert.equal(empty.stats.total, 0);
    assert.equal(empty.stats.rating, 0);
    assert.equal(empty.recent.length, 0);
  } finally {db.close();}
});

test('saga cards carry totals without books, and saga books are paginated in volume order', () => {
  const db = database();
  try {
    const result = queries.sagasPage(db, {page: 1});
    assert.equal(result.items.length, 10);
    assert.equal(result.totalPages, 3);
    assert.equal(result.items[0].total, 1001);
    assert.equal(result.items[0].finished, 501);
    assert.equal(result.items[0].books, undefined);
    assert.equal(queries.sagasPage(db, {page: 3}).items.length, 1);
    const books = queries.booksPage(db, {saga_id: '1', page: 2});
    assert.equal(books.items[0].saga_order, 51);
    assert.equal(books.items.length, 50);
    assert.equal(queries.booksPage(db, {saga_id: '2'}).total, 0);
  } finally {db.close();}
});

// Load real route handlers against isolated databases, never the user's files.
function route(name, databases) {
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/routes', name + '.js'), 'utf8'), {
    module, require: id => id === '../database' ? {getUserDb: uid => databases[uid]} :
      id === '../library-queries' ? queries : require(id),
  });
  return module.exports;
}

test('HTTP routes preserve user isolation, route precedence and old client compatibility', async () => {
  const databases = {alice: database(101), bob: database(2)};
  const app = express();
  app.use((req, res, next) => {req.user = {uid: req.headers['x-test-user'] || 'alice'}; next();});
  app.use('/api/books', route('books', databases));
  app.use('/api/sagas', route('sagas', databases));
  app.use((err, req, res, next) => res.status(err.status || 500).json({error: err.message}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const get = (url, user) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {headers: {'x-test-user': user || 'alice'}});
  try {
    assert.equal((await (await get('/api/books?page=1')).json()).total, 101);
    assert.equal((await (await get('/api/books?page=1', 'bob')).json()).total, 2);
    assert.equal((await get('/api/books?page=0')).status, 400);
    assert.deepEqual((await (await get('/api/books/metadata')).json()).years, [2026, 2025]);
    assert.equal((await get('/api/books/dashboard?year=2026')).status, 200);
    assert.equal((await get('/api/books/dashboard?year=bad')).status, 400);
    assert.equal((await (await get('/api/books/1')).json()).id, 1);
    assert.equal(Array.isArray(await (await get('/api/books')).json()), true);
    assert.equal((await (await get('/api/sagas?page=1')).json()).items.length, 10);
    assert.equal((await (await get('/api/sagas/options')).json())[0].books, undefined);
  } finally {
    await new Promise(resolve => server.close(resolve));
    Object.values(databases).forEach(db => db.close());
  }
});
