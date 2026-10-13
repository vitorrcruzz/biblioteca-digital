const currentYear = new Date().getFullYear();
let selectedGoalYear = currentYear;
let accountGoals = new Map();
let goalsLoaded = false;
let currentGoalTarget = null;
let goalBusy = false;
let exportBusy = false;
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
    throw err;
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

function renderGoalYears() {
  const years = new Set([...cachedYears, ...accountGoals.keys()]);
  if (!years.size) years.add(currentYear);
  if (!years.has(selectedGoalYear)) selectedGoalYear = Math.max(...years);
  const select = document.getElementById("a-goal-year");
  select.innerHTML = [...years].sort((a, b) => b - a)
    .map(year => `<option value="${year}">${year}</option>`).join("");
  select.value = selectedGoalYear;
  renderExportYears();
}

async function loadGoals() {
  if (goalBusy) return;
  setGoalBusy(true);
  document.getElementById("goal-retry-btn").hidden = true;
  document.getElementById("goal-hint").textContent = "Carregando metas...";
  renderGoalYears();
  try {
    const [goals] = await Promise.all([apiRequest("/api/goals"), loadYears()]);
    accountGoals = new Map(goals.map(goal => [Number(goal.year), goal.target]));
    goalsLoaded = true;
    renderGoalYears();
    renderAccountGoal(accountGoals.get(selectedGoalYear) ?? null);
  } catch (err) {
    goalsLoaded = false;
    document.getElementById("goal-hint").textContent = "Erro ao carregar metas.";
    document.getElementById("goal-retry-btn").hidden = false;
  } finally {
    setGoalBusy(false);
  }
}

function changeGoalYear() {
  if (goalBusy || !goalsLoaded) return;
  selectedGoalYear = Number(document.getElementById("a-goal-year").value);
  renderAccountGoal(accountGoals.get(selectedGoalYear) ?? null);
}

function renderAccountGoal(target) {
  currentGoalTarget = target;
  document.getElementById("current-year-label").textContent = selectedGoalYear;
  document.getElementById("a-goal").value = target ?? "";
  document.getElementById("goal-hint").textContent = target === null
    ? `Nenhuma meta definida para ${selectedGoalYear}`
    : `Meta atual: ${target} livros em ${selectedGoalYear}`;
  document.getElementById("delete-goal-btn").hidden = target === null;
}

function setGoalBusy(busy) {
  goalBusy = busy;
  const disabled = busy || !goalsLoaded;
  document.getElementById("a-goal-year").disabled = disabled;
  document.getElementById("a-goal").disabled = disabled;
  document.getElementById("save-goal-btn").disabled = disabled;
  document.getElementById("delete-goal-btn").disabled = disabled;
  renderExportYears();
}

async function saveGoal() {
  if (goalBusy || !goalsLoaded) return;
  const year = selectedGoalYear;
  const target = Number(document.getElementById("a-goal").value);
  if (!Number.isSafeInteger(target) || target < 1) { alert("Informe uma meta v\u00e1lida."); return; }
  setGoalBusy(true);
  try {
    await accountFetch("/goal", {
      method: "PUT",
      body: JSON.stringify({ year, target }),
    });
    accountGoals.set(year, target);
    if (selectedGoalYear === year) renderAccountGoal(target);
    showToast("Meta atualizada!");
  } catch (err) {
    alert("Erro ao salvar meta: " + err.message);
  } finally {
    setGoalBusy(false);
  }
}

function confirmDeleteGoal() {
  if (goalBusy || !goalsLoaded || currentGoalTarget === null) return;
  const year = selectedGoalYear;
  openConfirm(
    "Excluir meta?",
    `Deseja excluir a meta de leitura de ${year}? Seus livros e leituras ser\u00e3o mantidos.`,
    async () => {
      if (goalBusy || !accountGoals.has(year)) return;
      setGoalBusy(true);
      try {
        await apiRequest(`/api/goals/${year}`, { method: "DELETE" });
        accountGoals.delete(year);
        renderGoalYears();
        renderAccountGoal(accountGoals.get(selectedGoalYear) ?? null);
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
        accountGoals.clear();
        cachedYears = [];
        renderGoalYears();
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
  loadGoals();
} else {
  window.addEventListener("authReady", () => {
    loadAccount();
    loadGoals();
  });
}
function renderExportYears() {
  const select = document.getElementById("export-year");
  if (!select) return;
  const selected = select.value;
  const years = [...new Set([...cachedYears, ...accountGoals.keys()])].sort((a,b) => b-a);
  select.innerHTML = '<option value="all">Todos os anos</option>' + years
    .map(year => `<option value="${year}">${year}</option>`).join("");
  select.value = years.includes(Number(selected)) ? selected : "all";
  select.disabled = exportBusy || goalBusy || !goalsLoaded || !years.length;
  document.getElementById("export-excel-btn").disabled = select.disabled;
}

async function exportExcel() {
  if (exportBusy || !goalsLoaded) return;
  const year = document.getElementById("export-year").value;
  const hint = document.getElementById("export-hint");
  const filename = `biblioteca-${year === "all" ? "todos-os-anos" : year}.xlsx`;
  exportBusy = true;
  renderExportYears();
  hint.textContent = "Preparando planilha...";
  try {
    const blob = await apiRequest(`/api/exports/excel?year=${encodeURIComponent(year)}`, { responseType: "blob" });
    const native = window.LibraryFiles;
    if (native?.Capacitor.isNativePlatform()) {
      if (!native.Capacitor.isPluginAvailable("Filesystem") || !native.Capacitor.isPluginAvailable("Share")) {
        throw new Error("Atualize o aplicativo para exportar arquivos.");
      }
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Falha ao preparar o arquivo."));
        reader.readAsDataURL(blob);
      });
      const file = await native.Filesystem.writeFile({path: filename, data, directory: native.Directory.Cache});
      await native.Share.share({title: "Minha Biblioteca", files: [file.uri], dialogTitle: "Salvar ou compartilhar planilha"});
      hint.textContent = "Planilha preparada. Escolha onde salvar ou compartilhar.";
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      hint.textContent = "Download da planilha iniciado.";
    }
  } catch (err) {
    hint.textContent = "Não foi possível exportar: " + err.message;
  } finally {
    exportBusy = false;
    renderExportYears();
  }
}
