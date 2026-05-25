const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const { authMiddleware, admin } = require("./auth");
const { upsertUser }            = require("./database");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve o frontend estático — não precisa de autenticação
app.use(express.static(path.join(__dirname, "../public")));

// Rota de login/registro — valida token e registra usuário no banco
app.post("/api/auth/login", authMiddleware, (req, res) => {
  const { uid, email, name } = req.user;
  upsertUser(uid, email, name);
  res.json({ uid, email, name });
});

// Todas as rotas /api/* exigem autenticação
app.use("/api/books", authMiddleware, require("./routes/books"));
app.use("/api/goals", authMiddleware, require("./routes/goals"));

// Frontend
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Biblioteca Digital rodando em http://localhost:${PORT}`);
});