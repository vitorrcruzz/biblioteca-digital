const express = require("express");
const cors = require("cors");
const path = require("path");
const { authMiddleware, admin } = require("./auth");
const { upsertUser } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: por padrão mantém aberto (comportamento atual, pra não quebrar o deploy
// existente). Defina ALLOWED_ORIGINS (separadas por vírgula) no ambiente para
// travar isso às origens reais do app (ex: seu domínio Tailscale Funnel).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

app.use(
  cors(
    allowedOrigins
      ? {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error("Origem não permitida pelo CORS"));
          },
        }
      : {},
  ),
);
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
app.use("/api/categories", authMiddleware, require("./routes/categories"));
app.use("/api/sagas", authMiddleware, require("./routes/sagas"));
app.use("/api/account", authMiddleware, require("./routes/accountRoutes"));

// 404 em JSON para rotas de API não encontradas (mantém o mesmo formato
// { error: "..." } usado no resto da API, em vez de devolver HTML)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Fallback do frontend — só cai aqui quem pedir explicitamente uma página HTML
// (navegação no navegador). Requisições de asset (JS/CSS/imagem) que não bateram
// no express.static acima seguem pra frente sem serem capturadas por engano.
app.get("/{*path}", (req, res, next) => {
  if (req.accepts("html")) {
    return res.status(404).sendFile(path.join(__dirname, "../public/404.html"));
  }
  next();
});

// Middleware de erro global — captura qualquer exceção não tratada dentro das
// rotas (síncrona ou assíncrona, o Express 5 encaminha ambas pra cá) e responde
// no mesmo formato JSON { error: "..." } usado no resto da API, em vez da
// página de erro HTML padrão do Express.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || "Erro interno do servidor" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Biblioteca Digital rodando em http://localhost:${PORT}`);
});