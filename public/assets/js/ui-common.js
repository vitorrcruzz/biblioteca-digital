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
  const { responseType, ...fetchOptions } = options;
  const token = window.__getAuthToken ? await window.__getAuthToken() : null;

  let res;
  try {
    res = await fetch(fullPath, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...fetchOptions,
    });
  } catch (error) {
    if (error.name !== "AbortError") showConnectionNotice();
    throw error;
  }
  if (res.status >= 502 && res.status <= 504) showConnectionNotice();

  if (res.status === 401) {
    window.location.href = "/login.html";
    throw new Error("Sessao expirada. Entre novamente.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Erro ${res.status}`);
    error.status = res.status;
    error.matches = err.matches;
    throw error;
  }

  const result = await (responseType === "blob" ? res.blob() : res.json());
  const method = (fetchOptions.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (fullPath === '/api/account/' && method === 'DELETE') {
      await window.ReadingReminders?.clearSession();
    } else if (fullPath.startsWith('/api/books') || fullPath === '/api/account/books') {
      if (window.dispatchEvent) window.dispatchEvent(new Event('libraryChanged'));
    }
  }
  return result;
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
  const iconContainer = document.getElementById("confirm-icon");
  // Only this known icon is rendered as an element; other values remain plain text.
  iconContainer.textContent = icon === "logout" ? "" : icon;
  if (icon === "logout") {
    const element = document.createElement("i");
    element.className = "fa-solid fa-door-open";
    element.setAttribute("aria-hidden", "true");
    iconContainer.appendChild(element);
  }
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
    "logout"
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

// Keep the current page and unsaved fields when an API request cannot connect.
function showConnectionNotice() {
  let notice = document.getElementById('connection-notice');
  if (notice) { notice.hidden = false; return; }
  notice = document.createElement('aside');
  notice.id = 'connection-notice';
  notice.setAttribute('aria-label', 'Estado da conexão');
  notice.style.cssText = 'position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 32px));box-sizing:border-box;background:#191d29;color:#e8e9f0;border:1px solid #eebf48;border-radius:12px;padding:16px;z-index:10000;box-shadow:0 8px 24px #0006;font:14px/1.5 system-ui';
  notice.innerHTML = '<p role="status" style="margin:0 0 12px">Conexão indisponível. Verifique sua internet ou aguarde o servidor voltar.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" data-retry style="padding:10px 14px;border:0;border-radius:8px;background:#eebf48;color:#171717;font:600 14px system-ui;cursor:pointer">Tentar novamente</button><button type="button" data-close style="padding:10px 14px;border:1px solid #7b88a8;border-radius:8px;background:transparent;color:#e8e9f0;cursor:pointer">Fechar aviso</button></div>';
  document.body.appendChild(notice);
  notice.querySelector('[data-close]').onclick = () => { notice.hidden = true; };
  const retry = notice.querySelector('[data-retry]');
  retry.onclick = async () => {
    const message = notice.querySelector('[role="status"]');
    retry.disabled = true;
    message.textContent = 'Verificando conexão…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/health', {cache:'no-store', signal:controller.signal});
      if (!response.ok || (await response.json()).status !== 'ok') throw new Error();
      message.textContent = 'Conexão restabelecida. Tente novamente a ação que estava realizando.';
    } catch {
      message.textContent = 'Ainda não foi possível conectar. Tente novamente em instantes.';
    } finally {
      clearTimeout(timeout);
      retry.disabled = false;
    }
  };
}
