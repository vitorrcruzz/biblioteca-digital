import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = window.__firebaseConfig;

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let authToken   = null;

// Aguarda o Firebase verificar o estado de autenticação
function waitForAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        authToken   = await user.getIdToken(true);
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

export { waitForAuth, getToken, logout, auth };