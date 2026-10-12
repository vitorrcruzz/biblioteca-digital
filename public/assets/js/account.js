const currentYear = new Date().getFullYear();
let currentGoalTarget = null;
let goalBusy = false;
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
    renderAccountGoal(currentGoal?.target ?? null);
  } catch (err) {
    console.error("Erro ao carregar conta:", err);
  }
}

let cachedYears = []; // preenchido em loadYears() — usado pelo painel de ano mobile

async function loadYears() {
  try {
    const metadata = await apiRequest("/api/books/metadata");
    cachedYears = metadata.years;
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

function renderAccountGoal(target) {
  currentGoalTarget = target;
  document.getElementById("a-goal").value = target ?? "";
  document.getElementById("goal-hint").textContent = target === null
    ? `Nenhuma meta definida para ${currentYear}`
    : `Meta atual: ${target} livros em ${currentYear}`;
  document.getElementById("delete-goal-btn").hidden = target === null;
}

function setGoalBusy(busy) {
  goalBusy = busy;
  document.getElementById("a-goal").disabled = busy;
  document.getElementById("save-goal-btn").disabled = busy;
  document.getElementById("delete-goal-btn").disabled = busy;
}

async function saveGoal() {
  if (goalBusy) return;
  const target = parseInt(document.getElementById("a-goal").value);
  if (!target || target < 1) { alert("Informe uma meta v\u00e1lida."); return; }
  setGoalBusy(true);
  try {
    await accountFetch("/goal", {
      method: "PUT",
      body: JSON.stringify({ year: currentYear, target }),
    });
    renderAccountGoal(target);
    showToast("Meta atualizada!");
  } catch (err) {
    alert("Erro ao salvar meta: " + err.message);
  } finally {
    setGoalBusy(false);
  }
}

function confirmDeleteGoal() {
  if (goalBusy || currentGoalTarget === null) return;
  openConfirm(
    "Excluir meta?",
    `Deseja excluir a meta de leitura de ${currentYear}? Seus livros e leituras ser\u00e3o mantidos.`,
    async () => {
      if (goalBusy || currentGoalTarget === null) return;
      setGoalBusy(true);
      try {
        await apiRequest(`/api/goals/${currentYear}`, { method: "DELETE" });
        renderAccountGoal(null);
        showToast("Meta exclu\u00edda.");
      } catch (err) {
        alert("Erro ao excluir meta: " + err.message);
      } finally {
        setGoalBusy(false);
      }
    },
    "Sim, excluir"
  );
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
        renderAccountGoal(null);
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