// ═══════════════════════════════════════════════════
//  UI COMMON
//  Funções compartilhadas entre script.js (app principal) e
//  account.js (página de conta) — antes duplicadas em ambos.
//  Script comum (não é módulo ES): carregado antes dos dois.
// ═══════════════════════════════════════════════════

// ─────────────────────────────────────────────────
//  API — chamada genérica autenticada para qualquer
//  endpoint sob /api (livros, metas, categorias, sagas, conta...)
// ─────────────────────────────────────────────────
async function apiRequest(fullPath, options = {}) {
  const token = window.__getAuthToken ? await window.__getAuthToken() : null;

  const res = await fetch(fullPath, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = "✔ " + msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ─────────────────────────────────────────────────
//  MODAL DE CONFIRMAÇÃO
// ─────────────────────────────────────────────────
let confirmCallback = null;

function openConfirm(title, msg, onConfirm, confirmLabel = "Confirmar", icon = "⚠️") {
  confirmCallback = onConfirm;
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-msg").textContent = msg;
  document.getElementById("confirm-yes").textContent = confirmLabel;
  document.getElementById("confirm-icon").innerHTML = icon;
  document.getElementById("confirm-yes").onclick = () => {
    closeConfirm();
    onConfirm();
  };
  document.getElementById("confirm-overlay").classList.add("open");
}

function closeConfirm() {
  document.getElementById("confirm-overlay").classList.remove("open");
  confirmCallback = null;
}

function confirmLogout() {
  openConfirm(
    "Sair do sistema?",
    "Você precisará entrar novamente para acessar sua conta.",
    () => logout(),
    "Sim, sair",
    '<i class="fa-solid fa-door-open"></i>'
  );
}

// ─────────────────────────────────────────────────
//  MENU MOBILE (topbar + hambúrguer)
// ─────────────────────────────────────────────────
function openMobileMenu() {
  document.getElementById("mobile-menu-panel").classList.add("open");
  document.getElementById("mobile-menu-overlay").classList.add("open");
}

function closeMobileMenu() {
  document.getElementById("mobile-menu-panel").classList.remove("open");
  document.getElementById("mobile-menu-overlay").classList.remove("open");
}

// ─────────────────────────────────────────────────
//  PAINEL DE USUÁRIO (mobile)
// ─────────────────────────────────────────────────
function openUserPanel() {
  const nameEl = document.getElementById("user-name-panel");
  const userName = document.getElementById("user-name");
  if (nameEl && userName) nameEl.textContent = userName.textContent;
  document.getElementById("user-panel").classList.add("open");
  document.getElementById("user-panel-overlay").classList.add("open");
}

function closeUserPanel() {
  document.getElementById("user-panel").classList.remove("open");
  document.getElementById("user-panel-overlay").classList.remove("open");
}
