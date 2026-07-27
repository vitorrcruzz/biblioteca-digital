// ═══════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════
const API = "/api/books";

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let DB = { books: [], goals: {} };
let currentYear = new Date().getFullYear();
let editingId = null;
let currentRating = null;
let chartMonth = null;
let chartCat = null;
let isReread = false;

// ═══════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const token = window.__getAuthToken ? await window.__getAuthToken() : null;

  const res = await fetch(API + path, {
    headers: {
      "Content-Type":  "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
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

async function loadBooks() {
  const token = window.__getAuthToken ? await window.__getAuthToken() : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };

  const [books, goalsArr] = await Promise.all([
    apiFetch(""),
    fetch("/api/goals", { headers }).then((r) => {
      if (!r.ok) throw new Error("goals 401");
      return r.json();
    }),
  ]);

  DB.books = books;
  DB.goals = {};
  goalsArr.forEach((g) => (DB.goals[g.year] = g.target));
}

async function createBook(data) {
  return apiFetch("", { method: "POST", body: JSON.stringify(data) });
}

async function updateBook(id, data) {
  return apiFetch(`/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

async function removeBook(id) {
  return apiFetch(`/${id}`, { method: "DELETE" });
}

// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
function goTo(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll("nav a")
    .forEach((a) => a.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  document.querySelector(`nav a[data-page="${page}"]`)?.classList.add("active");
  if (page === "dashboard") renderDashboard();
  if (page === "acervo") renderAcervo();
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function years() {
  const ys = [...new Set(DB.books.map((b) => b.year))].sort((a, b) => b - a);
  return ys;
}

function booksForYear(y) {
  return DB.books.filter((b) => b.year === y);
}

function starsHtml(r) {
  if (r === null || r === undefined || r === 0)
    return '<span style="color:var(--muted);font-size:.8rem">—</span>';
  let h = "";
  for (let i = 1; i <= 5; i++) {
    if (r >= i) h += "★";
    else if (r >= i - 0.5) h += "½";
    else h += "☆";
  }
  return `<span class="stars">${h}</span>`;
}

function badgeHtml(cat) {
  if (!cat) return "";
  const c = cat
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s/g, "-");
  return `<span class="badge badge-${c}">${cat}</span>`;
}

function statusHtml(s) {
  const map = {
    finished: ["status-finished", "Concluído"],
    reading: ["status-reading", "Lendo"],
    paused: ["status-paused", "Pausado"],
  };
  const [cls, label] = map[s] || ["status-reading", "—"];
  return `<span class="status-dot ${cls}"></span>${label}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ═══════════════════════════════════════════════════
//  SIDEBAR YEAR BUTTONS
// ═══════════════════════════════════════════════════
function renderYearList() {
  const el = document.getElementById("year-list");
  el.innerHTML = years()
    .map(
      (y) => `
      <button class="year-btn ${y === currentYear ? "active" : ""}" onclick="setYear(${y})">${y}</button>`,
    )
    .join("");

  const fy = document.getElementById("filter-year");
  if (fy) {
    fy.innerHTML =
      '<option value="">Todos os anos</option>' +
      years()
        .map((y) => `<option value="${y}">${y}</option>`)
        .join("");
  }
}

function setYear(y) {
  currentYear = y;
  renderYearList();
  renderDashboard();
}

// ═══════════════════════════════════════════════════
//  YEAR PANEL (mobile)
// ═══════════════════════════════════════════════════
function openYearPanel() {
  renderYearPanel();
  document.getElementById("year-panel").classList.add("open");
  document.getElementById("year-panel-overlay").classList.add("open");
}

function closeYearPanel() {
  document.getElementById("year-panel").classList.remove("open");
  document.getElementById("year-panel-overlay").classList.remove("open");
}

function renderYearPanel() {
  document.getElementById("year-panel-list").innerHTML = years()
    .map(
      (y) => `
      <button class="year-panel-btn ${y === currentYear ? "active" : ""}"
        onclick="selectYearFromPanel(${y})">${y}</button>`,
    )
    .join("");
}

function selectYearFromPanel(y) {
  setYear(y);
  closeYearPanel();
  goTo("dashboard");
}

// ═══════════════════════════════════════════════════
//  YEAR MODAL
// ═══════════════════════════════════════════════════
function openYearModal() {
  const nextYear = Math.max(...years(), new Date().getFullYear()) + 1;
  document.getElementById("ym-year").value = nextYear;
  document.getElementById("ym-goal").value = "";
  document.getElementById("year-modal-overlay").classList.add("open");
}

function openYearModalFromPanel() {
  closeYearPanel();
  openYearModal();
}

function closeYearModal() {
  document.getElementById("year-modal-overlay").classList.remove("open");
}

function closeYearModalOutside(e) {
  if (e.target.id === "year-modal-overlay") closeYearModal();
}

async function saveYear() {
  const year = parseInt(document.getElementById("ym-year").value);
  const target = parseInt(document.getElementById("ym-goal").value) || null;

  if (!year || year < 2000 || year > 2100) {
    alert("Informe um ano válido.");
    return;
  }

  if (years().includes(year)) {
    alert(`O ano ${year} já existe no sistema.`);
    return;
  }

  try {
    if (target) {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, target }),
      });
      DB.goals[year] = target;
    }

    closeYearModal();
    showToast(`Ano ${year} criado! Adicione o primeiro livro.`);

    // Muda o ano corrente e abre o modal de adicionar livro
    currentYear = year;
    openModal();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
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
//  DASHBOARD
// ═══════════════════════════════════════════════════
function renderDashboard() {
  const books = booksForYear(currentYear);
  const finished = books.filter((b) => b.status === "finished");
  const reading = books.filter((b) => b.status === "reading");
  const totalPages = finished.reduce((s, b) => s + (b.pages || 0), 0);

  const ratedBooks = finished.filter((b) => b.rating);
  const avgRating = ratedBooks.length
    ? ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length
    : 0;

  const durations = finished
    .filter((b) => b.start_date && b.end_date)
    .map((b) => (new Date(b.end_date) - new Date(b.start_date)) / 86400000 + 1);
  const avgD = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  document.getElementById("dash-year").textContent = currentYear;
  document.getElementById("dash-sub").textContent =
    `${books.length} livro${books.length !== 1 ? "s" : ""} registrado${books.length !== 1 ? "s" : ""} · atualizado hoje`;

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card">
      <div class="label">📚 Concluídos</div>
      <div class="value">${finished.length}</div>
      <div class="sub">${reading.length} em andamento</div>
    </div>
    <div class="stat-card">
      <div class="label">📄 Páginas lidas</div>
      <div class="value">${totalPages.toLocaleString("pt-BR")}</div>
    </div>
    <div class="stat-card">
      <div class="label">⭐ Nota média</div>
      <div class="value">${avgRating.toFixed(1)}</div>
      <div class="sub">de 5.0</div>
    </div>
    <div class="stat-card">
      <div class="label">⏱️ Média por livro</div>
      <div class="value">${avgD || "—"}</div>
      <div class="sub">dias de leitura</div>
    </div>
  `;

  const goal = DB.goals[currentYear];
  const gc = document.getElementById("goal-card");
  if (goal) {
    gc.style.display = "";
    const pct = Math.min(100, Math.round((finished.length / goal) * 100));
    document.getElementById("goal-fraction").textContent =
      `${finished.length} / ${goal}`;
    document.getElementById("goal-fill").style.width = pct + "%";
    const left = goal - finished.length;
    document.getElementById("goal-sub").textContent =
      left > 0
        ? `Faltam ${left} livros para atingir sua meta em ${currentYear}`
        : `🎉 Meta de ${currentYear} atingida!`;
  } else {
    gc.style.display = "none";
  }

  renderCharts(finished, currentYear);

  const sorted = [...books]
    .sort((a, b) =>
      (b.end_date || b.start_date || "").localeCompare(
        a.end_date || a.start_date || "",
      ),
    )
    .slice(0, 8);

  document.getElementById("recent-list").innerHTML = sorted.length
    ? sorted
        .map(
          (b) => `
        <div class="book-row">
          <div class="title-col">
            <div class="t">${b.title}</div>
            <div class="a">${b.author}</div>
          </div>
          <div>${badgeHtml(b.category)}</div>
          <div style="color:var(--muted);font-size:.85rem">${b.pages || "—"}</div>
          <div>${starsHtml(b.rating)}</div>
          <div style="font-size:.82rem">${statusHtml(b.status)}</div>
        </div>`,
        )
        .join("")
    : `<div class="empty"><div class="ico">📭</div><p>Nenhum livro em ${currentYear}</p></div>`;
}

function renderCharts(finished, year) {
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const monthCount = Array(12).fill(0);
  finished.forEach((b) => {
    if (b.end_date) {
      const m = parseInt(b.end_date.split("-")[1]) - 1;
      monthCount[m]++;
    }
  });

  if (chartMonth) chartMonth.destroy();
  chartMonth = new Chart(document.getElementById("chartMonth"), {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          data: monthCount,
          backgroundColor: "#e8b84b55",
          borderColor: "#e8b84b",
          borderWidth: 2,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: "#7a82a0", font: { size: 11 } },
          grid: { color: "#2a3050" },
        },
        y: {
          ticks: { color: "#7a82a0", stepSize: 1, font: { size: 11 } },
          grid: { color: "#2a3050" },
        },
      },
    },
  });

  const catCount = {};
  finished.forEach((b) => {
    if (b.category) catCount[b.category] = (catCount[b.category] || 0) + 1;
  });
  const cats = Object.keys(catCount);
  const palette = [
    "#e8b84b",
    "#5b8ff9",
    "#e05c6a",
    "#4caf8a",
    "#f0944a",
    "#b07ef9",
    "#6ec6f5",
    "#5de09c",
    "#e0e05c",
    "#f97b5b",
  ];

  if (chartCat) chartCat.destroy();
  chartCat = new Chart(document.getElementById("chartCat"), {
    type: "doughnut",
    data: {
      labels: cats,
      datasets: [
        {
          data: cats.map((c) => catCount[c]),
          backgroundColor: cats.map((_, i) => palette[i % palette.length]),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#e8e8f0", font: { size: 11 }, boxWidth: 12 },
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════
//  ACERVO
// ═══════════════════════════════════════════════════
function renderAcervo() {
  const cats = [
    ...new Set(DB.books.filter((b) => b.category).map((b) => b.category)),
  ].sort();
  const fc = document.getElementById("filter-cat");
  const current = fc.value;
  fc.innerHTML =
    '<option value="">Todas categorias</option>' +
    cats
      .map(
        (c) =>
          `<option value="${c}" ${c === current ? "selected" : ""}>${c}</option>`,
      )
      .join("");

  const q = document.getElementById("search").value.toLowerCase();
  const fy = document.getElementById("filter-year").value;
  const fcat = document.getElementById("filter-cat").value;
  const fst = document.getElementById("filter-status").value;

  let books = [...DB.books]
    .filter((b) => {
      if (b._placeholder) return false;
      if (fy && b.year !== Number(fy)) return false;
      if (fcat && b.category !== fcat) return false;
      if (fst && b.status !== fst) return false;
      if (
        q &&
        !b.title.toLowerCase().includes(q) &&
        !b.author.toLowerCase().includes(q)
      )
        return false;
      return true;
    })
    .sort((a, b) =>
      (b.end_date || b.start_date || "").localeCompare(
        a.end_date || a.start_date || "",
      ),
    );

  document.getElementById("acervo-count").textContent =
    `${books.length} livro${books.length !== 1 ? "s" : ""} encontrado${books.length !== 1 ? "s" : ""}`;

  document.getElementById("acervo-list").innerHTML = books.length
    ? books
        .map(
          (b) => `
        <div class="acervo-row">
          <div>
            <div class="t">${b.title}${b.is_reread ? ' <span class="badge-reread"><i class="fa-solid fa-arrows-rotate" style="color: rgb(255, 255, 255);"></i> Releitura</span>' : ""}</div>
            <div class="a">${b.author}</div>
          </div>
          <div class="hide-sm">${badgeHtml(b.category)}</div>
          <div style="color:var(--muted);font-size:.84rem">${b.pages || "—"}</div>
          <div class="hide-sm" style="color:var(--muted);font-size:.82rem">${fmtDate(b.start_date)}</div>
          <div class="hide-sm" style="color:var(--muted);font-size:.82rem">${fmtDate(b.end_date)}</div>
          <div>${starsHtml(b.rating)}</div>
          <div class="actions-col">
            <button class="btn-edit"   onclick="editBook(${b.id})">✏️</button>
            <button class="btn-danger" onclick="deleteBook(${b.id})">🗑</button>
          </div>
        </div>`,
        )
        .join("")
    : `<div class="empty"><div class="ico">🔍</div><p>Nenhum livro encontrado</p></div>`;
}

function toggleReread() {
  isReread = !isReread;
  const btn = document.getElementById("reread-btn");
  const label = document.getElementById("reread-label");
  btn.classList.toggle("active", isReread);
  label.textContent = isReread ? "Releitura" : "Marcar como releitura";
}
function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

function closeModalOutside(e) {
  if (e.target.id === "modal-overlay") closeModal();
}

function setStar(v) {
  currentRating = v;
  document.querySelectorAll(".star-btn").forEach((b) => {
    b.classList.toggle("on", v !== null && parseFloat(b.dataset.v) <= v);
  });
  document.getElementById("star-label").textContent = v ? `${v} ★` : "Sem nota";
}

// ═══════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════
function openModal(id) {
  editingId = id || null;
  currentRating = null;
  document.getElementById("modal-title").textContent = id
    ? "Editar livro"
    : "Adicionar livro";

  const btn = document.getElementById("reread-btn");
  const label = document.getElementById("reread-label");

  if (id) {
    const b = DB.books.find((x) => x.id === id || x.id === Number(id));
    document.getElementById("f-title").value = b.title || "";
    document.getElementById("f-author").value = b.author || "";
    document.getElementById("f-pages").value = b.pages || "";
    document.getElementById("f-year").value = b.year || currentYear;
    document.getElementById("f-status").value = b.status || "reading";
    document.getElementById("f-start").value = b.start_date || "";
    document.getElementById("f-end").value = b.end_date || "";
    document.getElementById("f-category").value = b.category || "";
    if (b.rating) setStar(b.rating);

    isReread = b.is_reread === 1;
    if (btn) {
      btn.classList.toggle("active", isReread);
      label.textContent = isReread ? "Releitura" : "Marcar como releitura";
    }
  } else {
    document.getElementById("f-title").value = "";
    document.getElementById("f-author").value = "";
    document.getElementById("f-pages").value = "";
    document.getElementById("f-year").value = currentYear;
    document.getElementById("f-status").value = "reading";
    document.getElementById("f-start").value = new Date()
      .toISOString()
      .slice(0, 10);
    document.getElementById("f-end").value = "";
    document.getElementById("f-category").value = "";
    setStar(null);

    isReread = false;
    if (btn) {
      btn.classList.remove("active");
      label.textContent = "Marcar como releitura";
    }
  }
  document.getElementById("modal-overlay").classList.add("open");
}

// ═══════════════════════════════════════════════════
//  CRUD (async)
// ═══════════════════════════════════════════════════
async function saveBook() {
  const title = document.getElementById("f-title").value.trim();
  if (!title) {
    alert("O título é obrigatório.");
    return;
  }

  const payload = {
    title,
    author: document.getElementById("f-author").value.trim(),
    pages: parseInt(document.getElementById("f-pages").value) || 0,
    year: parseInt(document.getElementById("f-year").value) || currentYear,
    category: document.getElementById("f-category").value || "",
    rating: currentRating || 0,
    status: document.getElementById("f-status").value,
    start_date: document.getElementById("f-start").value || null,
    end_date: document.getElementById("f-end").value || null,
    is_reread: isReread,
  };

  try {
    if (editingId) {
      const updated = await updateBook(editingId, payload);
      const idx = DB.books.findIndex((b) => b.id === editingId);
      DB.books[idx] = updated;
      showToast("Livro atualizado!");
    } else {
      const created = await createBook(payload);
      DB.books.unshift(created);
      showToast("Livro adicionado!");
    }

    closeModal();
    renderYearList();
    const active = document.querySelector(".page.active");
    if (active?.id === "page-dashboard") renderDashboard();
    if (active?.id === "page-acervo") renderAcervo();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

function editBook(id) {
  openModal(id);
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

async function deleteBook(id) {
  const book = DB.books.find((b) => b.id === id || b.id === Number(id));
  if (!book) return;

  openConfirm(
    "Excluir permanentemente?",
    `"${book.title}" será removido do acervo e não poderá ser recuperado.`,
    async () => {
      try {
        await removeBook(id);
        DB.books = DB.books.filter((b) => b.id !== id);
        renderYearList();
        renderAcervo();
        showToast("Livro removido.");
      } catch (err) {
        alert("Erro ao remover: " + err.message);
      }
    },
  );
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
async function init() {
  try {
    await loadBooks();
    renderYearList();
    renderDashboard();
    // Verifica se deve abrir o acervo direto
    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "acervo") goTo("acervo");
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    document.getElementById("stats-grid").innerHTML =
      `<div style="color:var(--red);padding:20px">⚠️ Não foi possível conectar à API. O servidor está rodando?</div>`;
  }
}

// Aguarda o auth estar pronto antes de iniciar
if (window.__authReady) {
  init();
} else {
  window.addEventListener("authReady", () => init());
}