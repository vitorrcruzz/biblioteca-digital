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