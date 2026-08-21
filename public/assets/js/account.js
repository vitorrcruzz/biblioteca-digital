const currentYear = new Date().getFullYear();
let currentUserEmail = ""; // preenchido em loadAccount() — evita depender do placeholder do input

// ═══════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════
// accountFetch é um atalho fino sobre apiRequest() (ui-common.js) — só
// prefixa o path com /api/account, reaproveitando token/erro/redirect-401
// em vez de duplicar essa lógica aqui.
async function accountFetch(path, options = {}) {
  return apiRequest("/api/account" + path, options);
}

// ═══════════════════════════════════════════════════
//  CARREGAR DADOS
// ═══════════════════════════════════════════════════
async function loadAccount() {
  try {
    const user = await accountFetch("/");
    document.getElementById("a-name").value = user.name || "";
    document.getElementById("a-email").placeholder = user.email || "";
    currentUserEmail = user.email || "";
    document.getElementById("current-year-label").textContent = currentYear;

    const goals = await apiRequest("/api/goals");

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

let cachedYears = []; // preenchido em loadYears() — usado pelo painel de ano mobile

async function loadYears() {
  try {
    const books = await apiRequest("/api/books");
    cachedYears = [...new Set(books.map(b => b.year))].sort((a, b) => b - a);
    const el = document.getElementById("year-list");
    if (el) {
      el.innerHTML = cachedYears.map(y => `
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
    currentUserEmail = email;
    showToast("Email atualizado! Faça login novamente.");
    setTimeout(async () => {
      const { auth } = await import("./firebase-core.js");
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
  const email = currentUserEmail;
  if (!email) return;
  try {
    const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { auth } = await import("./firebase-core.js");
    await sendPasswordResetEmail(auth, email);
    showToast("Email de redefinição enviado!");
  } catch (err) {
    alert("Erro ao enviar email: " + err.message);
  }
}

// ═══════════════════════════════════════════════════
//  CONFIRM MODAL — openConfirm/closeConfirm compartilhados, ver ui-common.js
// ═══════════════════════════════════════════════════
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
//  YEAR PANEL (mobile) — específico dessa página, lê os botões
//  já renderizados por loadYears() acima
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
  el.innerHTML = cachedYears.map(y => `
    <button class="year-panel-btn" onclick="window.location.href='/?year=${y}'">${y}</button>
  `).join("");
}

function openYearModalFromPanel() {
  closeYearPanel();
  window.location.href = "/";
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