import { waitForAuth, getToken, logout } from "./firebase-app.js";

window.logout = logout;

const user = await waitForAuth();

const nameEl       = document.getElementById("user-name");
const nameMobileEl = document.getElementById("user-name-mobile");
if (nameEl)       nameEl.textContent       = user.displayName || user.email;
if (nameMobileEl) nameMobileEl.textContent = user.displayName || user.email;

window.__getAuthToken = getToken;

// Sinaliza que o auth está pronto
window.__authReady = true;
window.dispatchEvent(new Event("authReady"));