import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// Capacitor + FirebaseAuthentication (plugin nativo do Google Sign-In) não
// vêm de CDN — são expostos em window.CapacitorGoogleAuth pelo bundle local
// gerado em public/assets/js/capacitor-google-auth-bridge.js (via esbuild).
// Um import via esm.sh causava duplicação da instância de @capacitor/core,
// fazendo o plugin cair no fallback "web" (popup/redirect) mesmo dentro do
// app nativo — daí o bundle local, que reaproveita a instância real.

// ═══════════════════════════════════════════════════
//  Núcleo do Firebase — única inicialização do app/auth do projeto.
//  IMPORTANTE: este arquivo não contém nenhuma lógica de redirecionamento
//  de página. Cada página (login/register/reset x index/account) tem sua
//  própria guarda de navegação (redireciona pra "/" ou pra "/login.html"
//  dependendo do caso), e isso continua vivendo em cada arquivo consumidor.
// ═══════════════════════════════════════════════════

const firebaseConfig = window.__firebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let authToken = null;

// ── Sessão (usado por app-init.js, nas páginas logadas: index.html, account.html) ──

// Aguarda o Firebase verificar o estado de autenticação e redireciona pro
// login se não houver usuário. Só deve ser chamado nas páginas logadas.
function waitForAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        authToken = await user.getIdToken(true);
        localStorage.setItem("fb_token", authToken);
        resolve(user);
      } else {
        window.location.href = "/login.html";
      }
    });
  });
}

async function getToken() {
  if (currentUser) {
    authToken = await currentUser.getIdToken();
    return authToken;
  }
  return null;
}

async function logout() {
  await signOut(auth);
  localStorage.removeItem("fb_token");
  window.location.href = "/login.html";
}

// ── Autenticação (usado por firebase-login.js, firebase-register.js, firebase-reset.js) ──

function traduzirErro(code) {
  const map = {
    "auth/invalid-email": "Email inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Este email já está em uso.",
    "auth/weak-password": "A senha deve ter no mínimo 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/invalid-credential": "Email ou senha incorretos.",
  };
  return map[code] || "Erro ao autenticar. Tente novamente.";
}

async function afterLogin(user) {
  const token = await user.getIdToken();
  await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  localStorage.setItem("fb_token", token);
  window.location.href = "/";
}

// Login/cadastro com Google — compartilhado entre login.html e register.html,
// que só diferem no id do elemento onde o erro é exibido.
//
// Dentro do app nativo (Android/iOS via Capacitor), o fluxo via navegador
// (popup/redirect) não funciona de forma confiável — o Google bloqueia OAuth
// em WebViews, e mesmo quando abre no Chrome externo, o retorno perde o
// estado da sessão (erro "missing initial state"). Nesse caso, usamos a tela
// nativa de login do Google (via @capacitor-firebase/authentication) e
// trocamos o token nativo por uma credencial do Firebase JS SDK.
async function loginWithGoogle(errorElementId) {
  const errEl = document.getElementById(errorElementId);
  if (errEl) errEl.style.display = "none";

  try {
    let user;

    const bridge = window.CapacitorGoogleAuth;

    if (bridge?.Capacitor?.isNativePlatform?.()) {
      const result = await bridge.FirebaseAuthentication.signInWithGoogle();
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      const userCred = await signInWithCredential(auth, credential);
      user = userCred.user;
    } else {
      const popupResult = await signInWithPopup(auth, provider);
      user = popupResult.user;
    }

    await afterLogin(user);
  } catch (err) {
    if (errEl) {
      errEl.textContent = traduzirErro(err.code);
      errEl.style.display = "";
    }
  }
}

export {
  auth,
  provider,
  waitForAuth,
  getToken,
  logout,
  traduzirErro,
  afterLogin,
  loginWithGoogle,
};