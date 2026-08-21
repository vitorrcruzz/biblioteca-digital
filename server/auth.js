const path = require("path");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// Inicializa o Firebase Admin apenas uma vez
// (firebase-admin v14+ usa a API modular — sem o antigo namespace admin.*)
if (!getApps().length) {
  initializeApp({
    credential: cert(path.join(__dirname, "firebase-admin-key.json")),
  });
}

const auth = getAuth();

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

module.exports = { authMiddleware, auth };
