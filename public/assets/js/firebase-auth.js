import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = window.__firebaseConfig;

export const app      = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();

export function traduzirErro(code) {
  const map = {
    "auth/invalid-email":        "Email inválido.",
    "auth/user-not-found":       "Usuário não encontrado.",
    "auth/wrong-password":       "Senha incorreta.",
    "auth/email-already-in-use": "Este email já está em uso.",
    "auth/weak-password":        "A senha deve ter no mínimo 6 caracteres.",
    "auth/too-many-requests":    "Muitas tentativas. Tente novamente mais tarde.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/invalid-credential":   "Email ou senha incorretos.",
  };
  return map[code] || "Erro ao autenticar. Tente novamente.";
}

export async function afterLogin(user) {
  const token = await user.getIdToken();
  await fetch("/api/auth/login", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  localStorage.setItem("fb_token", token);
  window.location.href = "/";
}