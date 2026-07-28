import { auth, traduzirErro } from "./firebase-auth.js";
import {
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "/";
});

window.resetPassword = async function () {
  const email = document.getElementById("reset-email").value.trim();
  const errEl = document.getElementById("reset-error");
  const msgEl = document.getElementById("reset-msg");
  errEl.style.display = "none";
  msgEl.style.display = "none";

  try {
    await sendPasswordResetEmail(auth, email);
    msgEl.textContent = "Email de recuperação enviado! Verifique sua caixa de entrada.";
    msgEl.style.display = "";
  } catch (err) {
    errEl.textContent = traduzirErro(err.code);
    errEl.style.display = "";
  }
};