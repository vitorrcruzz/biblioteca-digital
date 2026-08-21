import {
  auth, traduzirErro, afterLogin, loginWithGoogle
} from "./firebase-core.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Se já está logado, redireciona
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken(true);
    localStorage.setItem("fb_token", token);
    window.location.href = "/";
  }
});

window.loginEmail = async function () {
  const email = document.getElementById("l-email").value.trim();
  const password = document.getElementById("l-password").value;
  const errEl = document.getElementById("login-error");
  errEl.style.display = "none";

  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await afterLogin(user);
  } catch (err) {
    errEl.textContent = traduzirErro(err.code);
    errEl.style.display = "";
  }
};

window.loginGoogle = () => loginWithGoogle("login-error");