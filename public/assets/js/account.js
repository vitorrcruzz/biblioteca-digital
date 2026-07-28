const currentYear = new Date().getFullYear();

// ═══════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════
async function accountFetch(path, options = {}) {
  const token = window.__getAuthToken ? await window.__getAuthToken() : null;
  const res = await fetch("/api/account" + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════
//  CARREGAR DADOS
// ═══════════════════════════════════════════════════
async function loadAccount() {
  try {
    const user = await accountFetch("/");
    document.getElementById("a-name").value = user.name || "";
    document.getElementById("a-email").placeholder = user.email || "";
    document.getElementById("current-year-label").textContent = currentYear;

    const token = window.__getAuthToken ? await window.__getAuthToken() : null;
    const goals = await fetch("/api/goals", {
      headers: { "Authorization": `Bearer ${token}` }
    }).then(r => r.json());

    const currentGoal = goals.find(g => g.year === currentYear);
    if (currentGoal) {
      document.getElementById("a-goal").value = currentGoal.target;
      document.getElementById("goal-hint").textContent = `Meta atual: ${currentGoal.target} livros em ${currentYear}`;
    } else {
      document.getElementById("goal-hint").textContent = `Nenhuma meta definida para ${currentYear}`;
    }
  } catch (err) {
    console.error("Erro ao carregar conta:", err);
  }
}

async function loadYears() {
  try {
    const token = window.__getAuthToken ? await window.__getAuthToken() : null;
    const books = await fetch("/api/books", {
      headers: { "Authorization": `Bearer ${token}` }
    }).then(r => r.json());

    const years = [...new Set(books.map(b => b.year))].sort((a, b) => b - a);
    const el = document.getElementById("year-list");
    if (el) {
      el.innerHTML = years.map(y => `
        <button class="year-btn" onclick="window.location.href='/?year=${y}'">${y}</button>
      `).join("");
    }
  } catch (err) {
    console.error("Erro ao carregar anos:", err);
  }
}

// ═══════════════════════════════════════════════════
//  SALVAR DADOS
// ═══════════════════════════════════════════════════
async function saveName() {
  const name = document.getElementById("a-name").value.trim();
  if (!name) { alert("Informe um nome."); return; }
  try {
    await accountFetch("/name", {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = name;
    showToast("Nome atualizado!");
  } catch (err) {
    alert("Erro ao atualizar nome: " + err.message);
  }
}

async function saveEmail() {
  const email = document.getElementById("a-email").value.trim();
  if (!email) { alert("Informe um email válido."); return; }

  if (!confirm(`Deseja alterar seu email para "${email}"? Você precisará fazer login novamente.`)) return;

  try {
    await accountFetch("/email", {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
    showToast("Email atualizado! Faça login novamente.");
    setTimeout(async () => {
      const { auth } = await import("./firebase-app.js");
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
      localStorage.removeItem("fb_token");
      window.location.href = "/login.html";
    }, 2000);
  } catch (err) {
    alert("Erro ao atualizar email: " + err.message);
  }
}

async function saveGoal() {
  const target = parseInt(document.getElementById("a-goal").value);
  if (!target || target < 1) { alert("Informe uma meta válida."); return; }
  try {
    await accountFetch("/goal", {
      method: "PUT",
      body: JSON.stringify({ year: currentYear, target }),
    });
    document.getElementById("goal-hint").textContent = `Meta atual: ${target} livros em ${currentYear}`;
    showToast("Meta atualizada!");
  } catch (err) {
    alert("Erro ao salvar meta: " + err.message);
  }
}

async function sendPasswordReset() {
  const email = document.getElementById("a-email").placeholder;
  if (!email) return;
  try {
    const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { auth } = await import("./firebase-app.js");
    await sendPasswordResetEmail(auth, email);
    showToast("Email de redefinição enviado!");
  } catch (err) {
    alert("Erro ao enviar email: " + err.message);
  }
}

// ═══════════════════════════════════════════════════
//  CONFIRM MODAL
// ═══════════════════════════════════════════════════
let confirmCallback = null;

function openConfirm(title, msg, onConfirm) {
  confirmCallback = onConfirm;
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-msg").textContent = msg;
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

function confirmDeleteBooks() {
  openConfirm(
    "Excluir acervo?",
    "Todos os livros e metas serão removidos permanentemente. Esta ação não pode ser desfeita.",
    async () => {
      try {
        await accountFetch("/books", { method: "DELETE" });
        showToast("Acervo excluído.");
      } catch (err) {
        alert("Erro ao excluir acervo: " + err.message);
      }
    }
  );
}

function confirmDeleteAccount() {
  openConfirm(
    "Excluir conta?",
    "Sua conta e todos os dados serão removidos permanentemente. Esta ação não pode ser desfeita.",
    async () => {
      try {
        await accountFetch("/", { method: "DELETE" });
        window.location.href = "/login.html";
      } catch (err) {
        alert("Erro ao excluir conta: " + err.message);
      }
    }
  );
}

// ═══════════════════════════════════════════════════
//  YEAR PANEL (mobile)
// ═══════════════════════════════════════════════════
function openYearPanel() {
  renderYearPanelAccount();
  document.getElementById("year-panel").classList.add("open");
  document.getElementById("year-panel-overlay").classList.add("open");
}

function closeYearPanel() {
  document.getElementById("year-panel").classList.remove("open");
  document.getElementById("year-panel-overlay").classList.remove("open");
}

function renderYearPanelAccount() {
  const el = document.getElementById("year-panel-list");
  if (!el) return;
  const buttons = document.querySelectorAll("#year-list .year-btn");
  el.innerHTML = [...buttons].map(btn => `
    <button class="year-panel-btn" onclick="window.location.href='/?year=${btn.textContent}'">${btn.textContent}</button>
  `).join("");
}

function openYearModalFromPanel() {
  closeYearPanel();
  window.location.href = "/";
}

// ═══════════════════════════════════════════════════
//  USER PANEL (mobile)
// ═══════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = "✔ " + msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
if (window.__authReady) {
  loadAccount();
  loadYears();
} else {
  window.addEventListener("authReady", () => {
    loadAccount();
    loadYears();
  });
}