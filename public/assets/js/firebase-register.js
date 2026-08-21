import {
  auth, traduzirErro, afterLogin, loginWithGoogle
} from "./firebase-core.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    window.location.href = "/";
  }
});

window.register = async function () {
  const name = document.getElementById("r-name").value.trim();
  const email = document.getElementById("r-email").value.trim();
  const password = document.getElementById("r-password").value;
  const errEl = document.getElementById("register-error");
  errEl.style.display = "none";

  if (!name) {
    errEl.textContent = "Informe seu nome.";
    errEl.style.display = "";
    return;
  }

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await afterLogin(user);
  } catch (err) {
    errEl.textContent = traduzirErro(err.code);
    errEl.style.display = "";
  }
};

window.loginGoogle = () => loginWithGoogle("register-error");