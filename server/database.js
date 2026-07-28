const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

// Garante que a pasta de dados existe
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Banco de usuários (global)
const usersDb = new Database(path.join(DATA_DIR, "users.db"));
usersDb.pragma("journal_mode = WAL");
usersDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid        TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Retorna ou cria o banco de livros de um usuário
function getUserDb(uid) {
  const dbPath = path.join(DATA_DIR, `books_${uid}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      author      TEXT    NOT NULL DEFAULT '',
      category    TEXT    NOT NULL DEFAULT '',
      pages       INTEGER NOT NULL DEFAULT 0,
      year        INTEGER NOT NULL DEFAULT 0,
      status      TEXT    NOT NULL DEFAULT 'reading'
                          CHECK(status IN ('reading','finished','paused')),
      start_date  TEXT,
      end_date    TEXT,
      rating      REAL    NOT NULL DEFAULT 0
                          CHECK(rating >= 0 AND rating <= 5),
      is_reread   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      year   INTEGER PRIMARY KEY,
      target INTEGER NOT NULL
    )
  `);
  db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
  )
`);

// Pré-popula categorias padrão se ainda não existirem
const catCount = db.prepare("SELECT COUNT(*) as c FROM categories WHERE parent_id IS NULL").get();
if (catCount.c === 0) {
  const defaults = ["Terror","Suspense","Mistério","Ação","Aventura","Ficção","Fantasia","HQ","Infantil"];
  const insertCat = db.prepare("INSERT INTO categories (name, parent_id) VALUES (?, NULL)");
  for (const name of defaults) insertCat.run(name);
}

  return db;
}

// Registra ou atualiza usuário no banco global
function upsertUser(uid, email, name) {
  usersDb.prepare(`
    INSERT INTO users (uid, email, name) VALUES (?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET email = excluded.email, name = excluded.name
  `).run(uid, email, name || email);
}

module.exports = { getUserDb, upsertUser, usersDb };