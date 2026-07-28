const express = require("express");
const router = express.Router();
const { getUserDb, usersDb } = require("../database");
const { admin } = require("../auth");

// GET /api/account — retorna dados do usuário
router.get("/", (req, res) => {
  const user = usersDb.prepare("SELECT * FROM users WHERE uid = ?").get(req.user.uid);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json(user);
});

// PUT /api/account/name — atualiza nome
router.put("/name", async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") return res.status(400).json({ error: "Nome é obrigatório" });

  await admin.auth().updateUser(req.user.uid, { displayName: name.trim() });
  usersDb.prepare("UPDATE users SET name = ? WHERE uid = ?").run(name.trim(), req.user.uid);
  res.json({ success: true });
});
// PUT /api/account/email — envia verificação para novo email
router.put("/email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email é obrigatório" });

  try {
    await admin.auth().updateUser(req.user.uid, { email: email.trim() });
    usersDb.prepare("UPDATE users SET email = ? WHERE uid = ?").run(email.trim(), req.user.uid);
    res.json({ success: true });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Este email já está em uso." });
    }
    res.status(500).json({ error: "Erro ao atualizar email." });
  }
});

// PUT /api/account/goal — adiciona ou atualiza meta do ano atual
router.put("/goal", (req, res) => {
  const { year, target } = req.body;
  if (!year || !target) return res.status(400).json({ error: "Ano e meta são obrigatórios" });

  const db = getUserDb(req.user.uid);
  db.prepare(`
    INSERT INTO goals (year, target) VALUES (?, ?)
    ON CONFLICT(year) DO UPDATE SET target = excluded.target
  `).run(Number(year), Number(target));
  res.json({ year: Number(year), target: Number(target) });
});

// DELETE /api/account/books — apaga todos os livros do usuário
router.delete("/books", (req, res) => {
  const db = getUserDb(req.user.uid);
  db.prepare("DELETE FROM books").run();
  db.prepare("DELETE FROM goals").run();
  res.json({ success: true });
});

// DELETE /api/account — desativa/exclui conta
router.delete("/", async (req, res) => {
  const uid = req.user.uid;
  try {
    // Remove do Firebase
    await admin.auth().deleteUser(uid);
    // Remove do banco de usuários
    usersDb.prepare("DELETE FROM users WHERE uid = ?").run(uid);
    // Remove o banco de livros do usuário
    const fs = require("fs");
    const path = require("path");
    const dbPath = path.join(__dirname, "../data", `books_${uid}.db`);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir conta" });
  }
});
module.exports = router;