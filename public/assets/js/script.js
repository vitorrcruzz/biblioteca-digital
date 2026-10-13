// ═══════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════
const API = "/api/books";

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let DB = { goals: {} };
let libraryMetadata = { years: [], categories: [], categoryCounts: [] };
let acervoBooks = [];
let visibleSagas = [];
let sagaBookPages = new Map();
let acervoRequest = 0;
let dashboardRequest = 0;
let sagasRequest = 0;
let searchTimer;
let modalRequest = 0;
let currentYear = new Date().getFullYear();
let editingId = null;
let currentRating = null;
let categories = []; // lista de categorias carregadas da API
let newCatParentId = null; // null = nova categoria raiz, número = nova subcategoria
let sagas = []; // lista de sagas carregadas da API
let expandedSagas = new Set(); // ids das sagas com o card aberto (todas começam fechadas)
let chartMonth = null;
let chartCat = null;
let isReread = false;
const ACERVO_PAGE_SIZE = 50;
let acervoPage = 1;
const SAGA_PAGE_SIZE = 10;
let sagaPage = 1;


// ═══════════════════════════════════════════════════
//  API
//  apiRequest() é compartilhada com account.js — ver ui-common.js
// ═══════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  return apiRequest(API + path, options);
}

async function loadLibraryMetadata() {
  ++acervoRequest;
  ++dashboardRequest;
  ++sagasRequest;
  const [metadata, goalsArr, cats, sagasArr] = await Promise.all([
    apiFetch("/metadata"),
    apiRequest("/api/goals"),
    apiRequest("/api/categories"),
    apiRequest("/api/sagas/options"),
  ]);

  libraryMetadata = metadata;
  sagaBookPages.clear();
  DB.goals = {};
  goalsArr.forEach((g) => (DB.goals[g.year] = g.target));
  categories = cats;
  sagas = sagasArr;
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

  const mobileTitles = { dashboard: "Dashboard", acervo: "Minha Estante", sagas: "Sagas/coleção" };
  const titleEl = document.getElementById("mobile-page-title");
  if (titleEl) titleEl.textContent = mobileTitles[page] || "Biblioteca";

  if (page === "dashboard") renderDashboard();
  if (page === "acervo") renderAcervo();
  if (page === "sagas") renderSagas();

  // Reposiciona tambem no proximo frame, depois da troca de layout.
  scrollPageToTop();
  requestAnimationFrame(scrollPageToTop);
}

function scrollPageToTop() {
  const options = { top: 0, left: 0, behavior: "instant" };
  document.getElementById("main")?.scrollTo(options);
  document.scrollingElement?.scrollTo(options);
  window.scrollTo(options);
}

// ═══════════════════════════════════════════════════
//  NAVEGAÇÃO MOBILE (topbar + menu hambúrguer + FAB)
//  openMobileMenu/closeMobileMenu e confirmLogout — ver ui-common.js
// ═══════════════════════════════════════════════════
function goToMobile(page) {
  closeMobileMenu();
  goTo(page);
}

function openMobileMenuYear() {
  closeMobileMenu();
  openYearPanel();
}

function goToAccountFromMenu() {
  closeMobileMenu();
  window.location.href = "/account.html";
}

// FAB: adiciona livro normalmente, ou uma nova saga se a tela atual for "Sagas"
function mobileFabClick() {
  const active = document.querySelector(".page.active");
  if (active?.id === "page-sagas") {
    openNewSagaModal();
  } else {
    openModal();
  }
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function years() {
  return libraryMetadata.years;
}

function starsHtml(r) {
  if (r === null || r === undefined || r === 0)
    return '<span style="color:var(--muted);font-size:.8rem">—</span>';

  let h = "";
  for (let i = 1; i <= 5; i++) {
    if (r >= i) {
      h += `<span style="color:var(--gold);font-size:inherit">★</span>`;
    } else if (r >= i - 0.5) {
      h += `<span class="star-half-wrap"><span class="star-bg">★</span><span class="star-fg">★</span></span>`;
    } else {
      h += `<span style="color:var(--border);font-size:inherit">★</span>`;
    }
  }
  return `<span class="stars">${h}</span>`;
}
function badgeHtml(cat, sub) {
  if (!cat) return "";
  const c = cat
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s/g, "-");
  const subHtml = sub ? `<span class="badge-sub">• ${sub}</span>` : "";
  return `<span class="badge badge-${c}">${cat}${subHtml}</span>`;
}

function sagaBadgeHtml(b) {
  if (!b.saga_id) return "";
  const saga = sagas.find((s) => s.id === b.saga_id || s.id === Number(b.saga_id));
  if (!saga) return "";
  const vol =
    b.saga_order !== null && b.saga_order !== undefined && b.saga_order !== ""
      ? ` <span class="badge-sub">· Vol. ${b.saga_order}</span>`
      : "";
  return `<span class="badge badge-saga">🗂️ ${escapeHtml(saga.name)}${vol}</span>`;
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
    const selected = fy.value;
    fy.innerHTML =
      '<option value="">Todos os anos</option>' +
      years()
        .map((y) => `<option value="${y}">${y}</option>`)
        .join("");
    fy.value = selected;
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
      await apiRequest("/api/goals", {
        method: "POST",
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

// openUserPanel/closeUserPanel — ver ui-common.js

// ═══════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════
async function renderDashboard() {
  const request = ++dashboardRequest;
  const year = currentYear;
  document.getElementById("stats-grid").textContent = "Carregando resumo...";
  document.getElementById("recent-list").textContent = "";
  document.getElementById("goal-card").style.display = "none";
  try {
    const data = await apiFetch(`/dashboard?year=${year}`);
    if (request !== dashboardRequest || year !== currentYear) return;
    const { total, finished, reading, pages: totalPages, rating: avgRating } = data.stats;
    const avgD = Math.round(data.stats.duration);

    document.getElementById("dash-year").textContent = currentYear;
    document.getElementById("dash-sub").textContent =
      `${total} livro${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""} · atualizado hoje`;

    document.getElementById("stats-grid").innerHTML = `
      <div class="stat-card">
        <div class="label">📚 Concluídos</div>
        <div class="value">${finished}</div>
        <div class="sub">${reading} em andamento</div>
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
      const pct = Math.min(100, Math.round((finished / goal) * 100));
      document.getElementById("goal-fraction").textContent =
        `${finished} / ${goal}`;
      document.getElementById("goal-fill").style.width = pct + "%";
      const left = goal - finished;
      document.getElementById("goal-sub").textContent =
        left > 0
          ? `Faltam ${left} livros para atingir sua meta em ${currentYear}`
          : `Parabéns! Meta de ${currentYear} atingida!`;
    } else {
      gc.style.display = "none";
    }

    renderCharts(data);
    const sorted = data.recent;

    document.getElementById("recent-list").innerHTML = sorted.length
      ? sorted
        .map(
          (b) => `
          <div class="book-row">
            <div class="title-col">
              <div class="t">${b.title}</div>
              <div class="a">${b.author}</div>
              ${b.saga_id ? `<div class="saga-inline-badge">${sagaBadgeHtml(b)}</div>` : ""}
            </div>
            <div>${badgeHtml(b.category)}</div>
            <div style="color:var(--muted);font-size:.85rem">${b.pages || "—"}</div>
            <div>${starsHtml(b.rating)}</div>
            <div style="font-size:.82rem">${statusHtml(b.status)}</div>
          </div>`,
        )
        .join("")
      : `<div class="empty"><div class="ico">📭</div><p>Nenhum livro em ${currentYear}</p></div>`;
  } catch (err) {
    if (request !== dashboardRequest) return;
    document.getElementById("stats-grid").innerHTML = '<div class="empty">Erro ao carregar resumo. <button class="btn-outline" onclick="renderDashboard()">Tentar novamente</button></div>';
  }
}

function renderCharts(data) {
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
  const monthCount = data.months;

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

  const cats = data.categories.map(row => row.category);
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
          data: data.categories.map(row => row.total),
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
async function renderAcervo() {
  clearTimeout(searchTimer);
  const request = ++acervoRequest;
  const fc = document.getElementById("filter-cat");
  const selected = fc.value;
  fc.innerHTML = '<option value="">Todas categorias</option>' + libraryMetadata.categories
    .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  fc.value = selected;
  const params = new URLSearchParams({
    page: acervoPage, pageSize: ACERVO_PAGE_SIZE,
    search: document.getElementById("search").value,
    year: document.getElementById("filter-year").value,
    category: fc.value,
    status: document.getElementById("filter-status").value,
  });
  document.getElementById("acervo-list").textContent = "Carregando livros...";
  document.getElementById("acervo-pagination").innerHTML = "";
  document.getElementById("acervo-count").textContent = "";
  try {
    const data = await apiFetch(`?${params}`);
    if (request !== acervoRequest) return;
    acervoPage = data.page;
    acervoBooks = data.items;
    const pageBooks = data.items;
    document.getElementById("acervo-count").textContent =
      `${data.total} livro${data.total !== 1 ? "s" : ""} encontrado${data.total !== 1 ? "s" : ""}`;
    renderAcervoPagination(data.total, data.totalPages, (data.page - 1) * data.pageSize);

    document.getElementById("acervo-list").innerHTML = pageBooks.length
      ? pageBooks
        .map(
          (b) => `
          <div class="acervo-row">
            <div>
              <div class="t">${b.title}${b.is_reread ? ' <span class="badge-reread"><i class="fa-solid fa-arrows-rotate" style="color: rgb(255, 255, 255);"></i> Releitura</span>' : ""}</div>
              <div class="a">${b.author}</div>
              ${b.saga_id ? `<div class="saga-inline-badge">${sagaBadgeHtml(b)}</div>` : ""}
            </div>
            <div class="hide-sm">${badgeHtml(b.category, b.subcategory)}</div>
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
  } catch (err) {
    if (request !== acervoRequest) return;
    document.getElementById("acervo-list").innerHTML = '<div class="empty">Erro ao carregar livros. <button class="btn-outline" onclick="renderAcervo()">Tentar novamente</button></div>';
  }
}
function filterAcervo(debounce = false) {
  acervoPage = 1;
  ++acervoRequest; // Invalidate pending results immediately, even during debounce.
  clearTimeout(searchTimer);
  if (debounce) searchTimer = setTimeout(renderAcervo, 250);
  else renderAcervo();
}

async function changeAcervoPage(page) {
  if (!Number.isInteger(page) || page < 1) return;
  acervoPage = page;
  await renderAcervo();
  if (!document.getElementById("page-acervo").classList.contains("active")) return;
  document.getElementById("page-acervo").scrollIntoView({ block: "start" });
  document.querySelector('#acervo-pagination [aria-current="page"]')?.focus({ preventScroll: true });
}

function renderAcervoPagination(total, totalPages, start) {
  renderPagination("acervo-pagination", total, totalPages, start, acervoPage,
    ACERVO_PAGE_SIZE, "livros", "changeAcervoPage");
}

function renderPagination(containerId, total, totalPages, start, currentPage, pageSize, itemLabel, changePage) {
  const container = document.getElementById(containerId);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  // Cinco paginas proximas; os extremos e as reticencias aparecem no desktop.
  const first = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const nearby = Array.from({ length: Math.min(5, totalPages) }, (_, i) => first + i);
  const pages = [...new Set([1, ...nearby, totalPages])].sort((a, b) => a - b);
  const buttons = pages.map((page, index) => {
    const gap = index > 0 && page - pages[index - 1] > 1
      ? '<span class="pagination-gap pagination-desktop" aria-hidden="true">&hellip;</span>' : "";
    const desktopOnly = nearby.includes(page) ? "" : " pagination-desktop";
    return `${gap}<button type="button" class="pagination-button${desktopOnly}" onclick="${changePage}(${page})"
      aria-label="Página ${page}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
  }).join("");
  const arrow = (direction) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" focusable="false"><path d="${direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}" /></svg>`;

  container.innerHTML = `
    <p class="pagination-summary" role="status">Exibindo ${start + 1}–${Math.min(start + pageSize, total)} de ${total} ${itemLabel} · Página ${currentPage} de ${totalPages}</p>
    <div class="pagination-controls">
      <button type="button" class="pagination-button pagination-arrow" aria-label="Página anterior" onclick="${changePage}(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>${arrow("left")}</button>
      ${buttons}
      <button type="button" class="pagination-button pagination-arrow" aria-label="Próxima página" onclick="${changePage}(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>${arrow("right")}</button>
    </div>`;
}

function toggleReread() {
  isReread = !isReread;
  const btn = document.getElementById("reread-btn");
  const label = document.getElementById("reread-label");
  btn.classList.toggle("active", isReread);
  label.textContent = isReread ? "Releitura" : "Marcar como releitura";
}

// Ao marcar como Concluído, preenche a data de término com hoje (se ainda estiver vazia)
function onStatusChange() {
  const statusSel = document.getElementById("f-status");
  const endInput = document.getElementById("f-end");
  if (statusSel.value === "finished" && !endInput.value) {
    endInput.value = new Date().toISOString().slice(0, 10);
  }
}

// Ao preencher a data de término, marca o status como Concluído automaticamente
function onEndDateChange() {
  const endInput = document.getElementById("f-end");
  const statusSel = document.getElementById("f-status");
  if (endInput.value) {
    statusSel.value = "finished";
  }
}

function closeModal() {
  ++modalRequest;
  document.getElementById("modal-overlay").classList.remove("open");
}

function closeModalOutside(e) {
  if (e.target.id === "modal-overlay") closeModal();
}

function setStar(v) {
  currentRating = v;
  document.querySelectorAll(".star-btn").forEach((btn) => {
    const val = parseFloat(btn.dataset.v);
    const isHalf = btn.classList.contains("half-btn");
    const isOn = v !== null && val <= v;

    btn.classList.toggle("on", isOn);

    if (isHalf) {
      const starFg = btn.querySelector(".star-fg");
      if (starFg) {
        starFg.style.color = isOn ? "var(--gold)" : "var(--border)";
      }
    }
  });
  document.getElementById("star-label").textContent = v ? `${v} ★` : "Sem nota";
}
// ═══════════════════════════════════════════════════
//  CATEGORIAS
// ═══════════════════════════════════════════════════
function populateCategorySelect(selectedCat, selectedSub) {
  const sel = document.getElementById("f-category");
  sel.innerHTML =
    '<option value="">Selecione</option>' +
    categories
      .map(
        (c) =>
          `<option value="${c.name}" ${c.name === selectedCat ? "selected" : ""}>${c.name}</option>`,
      )
      .join("");

  if (selectedCat) {
    populateSubcategorySelect(selectedCat, selectedSub);
  } else {
    document.getElementById("subcategory-field").style.display = "none";
  }
}

function populateSubcategorySelect(catName, selectedSub) {
  const cat = categories.find((c) => c.name === catName);
  const field = document.getElementById("subcategory-field");
  const sel = document.getElementById("f-subcategory");

  if (cat && cat.subcategories && cat.subcategories.length > 0) {
    sel.innerHTML =
      '<option value="">Nenhuma</option>' +
      cat.subcategories
        .map(
          (s) =>
            `<option value="${s.name}" ${s.name === selectedSub ? "selected" : ""}>${s.name}</option>`,
        )
        .join("");
    field.style.display = "";
  } else {
    sel.innerHTML = '<option value="">Nenhuma</option>';
    field.style.display = "";
  }
}

function onCategoryChange() {
  const catName = document.getElementById("f-category").value;
  if (catName) {
    populateSubcategorySelect(catName, "");
  } else {
    document.getElementById("subcategory-field").style.display = "none";
  }
}

// ── Modal nova categoria ──
function openNewCategoryModal(parentId) {
  const catName = document.getElementById("f-category").value;
  newCatParentId =
    parentId === null
      ? null
      : catName
        ? categories.find((c) => c.name === catName)?.id
        : null;

  const isRoot = newCatParentId === null && parentId === null;
  document.getElementById("cat-modal-title").textContent = isRoot
    ? "Nova categoria"
    : `Nova subcategoria de "${catName}"`;
  document.getElementById("cat-modal-label").textContent = isRoot
    ? "Nome da categoria"
    : "Nome da subcategoria";
  document.getElementById("cat-name-input").value = "";
  document.getElementById("cat-modal-overlay").classList.add("open");
}

function closeCatModal() {
  document.getElementById("cat-modal-overlay").classList.remove("open");
}

function closeCatModalOutside(e) {
  if (e.target.id === "cat-modal-overlay") closeCatModal();
}

async function saveNewCategory() {
  const name = document.getElementById("cat-name-input").value.trim();
  if (!name) {
    alert("Informe um nome.");
    return;
  }

  try {
    const newCat = await apiRequest("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, parent_id: newCatParentId }),
    });

    // Atualiza a lista local de categorias
    if (newCatParentId === null) {
      categories.push({ ...newCat, subcategories: [] });
      categories.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const parent = categories.find((c) => c.id === newCatParentId);
      if (parent) {
        parent.subcategories.push(newCat);
        parent.subcategories.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    closeCatModal();

    // Seleciona a nova categoria/subcategoria automaticamente
    const currentCat =
      newCatParentId === null
        ? name
        : document.getElementById("f-category").value;
    populateCategorySelect(currentCat, newCatParentId !== null ? name : "");

    showToast(`"${name}" adicionada!`);
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

// ═══════════════════════════════════════════════════
//  GERENCIAR CATEGORIAS (editar / excluir)
// ═══════════════════════════════════════════════════
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openManageCategoriesModal() {
  renderManageCatList();
  document.getElementById("manage-cat-modal-overlay").classList.add("open");
}

function closeManageCategoriesModal() {
  document.getElementById("manage-cat-modal-overlay").classList.remove("open");
}

function closeManageCatModalOutside(e) {
  if (e.target.id === "manage-cat-modal-overlay") closeManageCategoriesModal();
}

function findCategoryById(id) {
  for (const c of categories) {
    if (c.id === id) return c;
    const sub = (c.subcategories || []).find((s) => s.id === id);
    if (sub) return sub;
  }
  return null;
}

function renderManageCatList() {
  const el = document.getElementById("manage-cat-list");
  if (!categories.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:.85rem;text-align:center;padding:16px 0">Nenhuma categoria cadastrada.</p>`;
    return;
  }

  el.innerHTML = categories
    .map(
      (c) => `
      <div class="manage-cat-item">
        <div class="manage-cat-row" id="manage-cat-row-${c.id}">
          <span class="manage-cat-name">${escapeHtml(c.name)}</span>
          <div class="manage-cat-actions">
            <button class="btn-icon-sm" onclick="startRenameCategory(${c.id})" title="Renomear">✏️</button>
            <button class="btn-icon-sm btn-icon-danger" onclick="confirmDeleteCategory(${c.id}, false)" title="Excluir">🗑</button>
          </div>
        </div>
        ${c.subcategories && c.subcategories.length
          ? `<div class="manage-cat-subs">
              ${c.subcategories
            .map(
              (s) => `
                <div class="manage-cat-row manage-cat-sub-row" id="manage-cat-row-${s.id}">
                  <span class="manage-cat-name">↳ ${escapeHtml(s.name)}</span>
                  <div class="manage-cat-actions">
                    <button class="btn-icon-sm" onclick="startRenameCategory(${s.id})" title="Renomear">✏️</button>
                    <button class="btn-icon-sm btn-icon-danger" onclick="confirmDeleteCategory(${s.id}, true)" title="Excluir">🗑</button>
                  </div>
                </div>`,
            )
            .join("")}
            </div>`
          : ""
        }
      </div>`,
    )
    .join("");
}

function startRenameCategory(id) {
  const cat = findCategoryById(id);
  const row = document.getElementById(`manage-cat-row-${id}`);
  if (!cat || !row) return;

  row.innerHTML = `
    <input type="text" class="manage-cat-input" id="manage-cat-input-${id}" value="${escapeHtml(cat.name)}" />
    <div class="manage-cat-actions">
      <button class="btn-icon-sm btn-icon-ok" onclick="submitRenameCategory(${id})" title="Salvar">✔</button>
      <button class="btn-icon-sm" onclick="renderManageCatList()" title="Cancelar">✕</button>
    </div>
  `;
  const input = document.getElementById(`manage-cat-input-${id}`);
  input.focus();
  input.select();
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitRenameCategory(id);
    if (e.key === "Escape") renderManageCatList();
  });
}

async function submitRenameCategory(id) {
  const input = document.getElementById(`manage-cat-input-${id}`);
  const newName = input.value.trim();
  if (!newName) {
    alert("Informe um nome.");
    return;
  }

  const cat = findCategoryById(id);
  if (!cat) return;
  const oldName = cat.name;
  const isSub = cat.parent_id !== null;

  try {
    await apiRequest(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: newName }),
    });

    await loadLibraryMetadata();
    renderManageCatList();
    renderYearList();
    const active = document.querySelector(".page.active");
    if (active?.id === "page-dashboard") renderDashboard();
    if (active?.id === "page-acervo") renderAcervo();
    resyncBookModalCategoryField(oldName, newName, isSub);
    showToast("Categoria atualizada!");
  } catch (err) {
    alert("Erro ao renomear: " + err.message);
  }
}

// Se o modal de Adicionar/Editar livro estiver aberto no momento em que uma
// categoria/subcategoria é renomeada ou excluída, atualiza o campo na hora
// (newName === "" indica que a categoria foi excluída, não renomeada)
function resyncBookModalCategoryField(oldName, newName, isSub) {
  const bookModal = document.getElementById("modal-overlay");
  if (!bookModal || !bookModal.classList.contains("open")) return;

  const catSel = document.getElementById("f-category");
  const subSel = document.getElementById("f-subcategory");
  let selCat = catSel.value;
  let selSub = subSel.value;

  if (isSub) {
    if (selSub === oldName) selSub = newName;
  } else if (selCat === oldName) {
    selCat = newName;
    if (!newName) selSub = ""; // categoria removida: subcategoria perde o vínculo
  }

  populateCategorySelect(selCat, selSub);
}

function findParentCategoryName(subId) {
  const parent = categories.find((c) => (c.subcategories || []).some((s) => s.id === subId));
  return parent ? parent.name : null;
}

function countBooksUsingCategory(cat, isSub) {
  const parentName = isSub ? findParentCategoryName(cat.id) : cat.name;
  return libraryMetadata.categoryCounts.filter(row => row.category === parentName &&
    (!isSub || row.subcategory === cat.name)).reduce((total, row) => total + row.total, 0);
}

function confirmDeleteCategory(id, isSub) {
  const cat = findCategoryById(id);
  if (!cat) return;

  const count = countBooksUsingCategory(cat, isSub);
  const tipo = isSub ? "subcategoria" : "categoria";

  const msg =
    count > 0
      ? `⚠️ Há ${count} livro${count > 1 ? "s" : ""} vinculado${count > 1 ? "s" : ""} a essa ${tipo}. ` +
      `Se você continuar, ${count > 1 ? "esses livros ficarão" : "esse livro ficará"} sem ${tipo}, mas você ` +
      `ainda poderá editá-lo depois para atribuir uma nova. A exclusão pode ser feita normalmente.`
      : `A ${tipo} "${cat.name}"${isSub ? "" : " e suas subcategorias"} será removida permanentemente. Nenhum livro está vinculado a ela no momento.`;

  openConfirm("Excluir categoria?", msg, () => deleteCategoryNow(id), "Sim, excluir", "🗑");
}

async function deleteCategoryNow(id) {
  const cat = findCategoryById(id);
  if (!cat) return;
  const oldName = cat.name;
  const isSub = cat.parent_id !== null;

  try {
    await apiRequest(`/api/categories/${id}`, { method: "DELETE" });

    await loadLibraryMetadata();
    renderManageCatList();
    renderYearList();
    const active = document.querySelector(".page.active");
    if (active?.id === "page-dashboard") renderDashboard();
    if (active?.id === "page-acervo") renderAcervo();
    resyncBookModalCategoryField(oldName, "", isSub);
    showToast("Categoria removida.");
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

// ═══════════════════════════════════════════════════
//  SAGAS
// ═══════════════════════════════════════════════════
function populateSagaSelect(selectedId, selectedOrder) {
  const sel = document.getElementById("f-saga");
  if (!sel) return;
  sel.innerHTML =
    '<option value="">Nenhuma</option>' +
    sagas
      .map(
        (s) =>
          `<option value="${s.id}" ${String(s.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(s.name)}</option>`,
      )
      .join("");

  const orderField = document.getElementById("saga-order-field");
  const orderInput = document.getElementById("f-saga-order");
  if (selectedId) {
    orderField.style.display = "";
    orderInput.value = selectedOrder ?? "";
  } else {
    orderField.style.display = "none";
    orderInput.value = "";
  }
}

function onSagaChange() {
  populateSagaSelect(document.getElementById("f-saga").value, "");
}

// ── Modal nova saga ──
function openNewSagaModal() {
  document.getElementById("saga-name-input").value = "";
  document.getElementById("saga-modal-overlay").classList.add("open");
}

function closeSagaModal() {
  document.getElementById("saga-modal-overlay").classList.remove("open");
}

function closeSagaModalOutside(e) {
  if (e.target.id === "saga-modal-overlay") closeSagaModal();
}

async function saveNewSaga() {
  const name = document.getElementById("saga-name-input").value.trim();
  if (!name) {
    alert("Informe um nome.");
    return;
  }

  try {
    const newSaga = await apiRequest("/api/sagas", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    sagas.push({ ...newSaga, books: [] });
    sagas.sort((a, b) => a.name.localeCompare(b.name));

    closeSagaModal();

    const bookModal = document.getElementById("modal-overlay");
    if (bookModal && bookModal.classList.contains("open")) {
      populateSagaSelect(newSaga.id, "");
    }

    if (document.querySelector(".page.active")?.id === "page-sagas") renderSagas();

    showToast(`"${name}" adicionada!`);
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

// ── Gerenciar (renomear/excluir) ──
function startRenameSaga(id) {
  const saga = sagas.find((s) => s.id === id);
  const row = document.getElementById(`saga-row-${id}`);
  if (!saga || !row) return;

  row.innerHTML = `
    <input type="text" class="manage-cat-input" id="saga-input-${id}" value="${escapeHtml(saga.name)}" />
    <div class="manage-cat-actions">
      <button class="btn-icon-sm btn-icon-ok" onclick="submitRenameSaga(${id})" title="Salvar">✔</button>
      <button class="btn-icon-sm" onclick="renderSagas()" title="Cancelar">✕</button>
    </div>
  `;
  const input = document.getElementById(`saga-input-${id}`);
  input.focus();
  input.select();
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitRenameSaga(id);
    if (e.key === "Escape") renderSagas();
  });
}

async function submitRenameSaga(id) {
  const input = document.getElementById(`saga-input-${id}`);
  const newName = input.value.trim();
  if (!newName) {
    alert("Informe um nome.");
    return;
  }

  try {
    await apiRequest(`/api/sagas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: newName }),
    });

    await loadLibraryMetadata();
    renderSagas();
    resyncBookModalSagaField();
    showToast("Saga atualizada!");
  } catch (err) {
    alert("Erro ao renomear: " + err.message);
  }
}

function confirmDeleteSaga(id) {
  const saga = sagas.find((s) => s.id === id);
  if (!saga) return;
  const count = visibleSagas.find(s => s.id === id)?.total || 0;

  const msg =
    count > 0
      ? `⚠️ Há ${count} livro${count > 1 ? "s" : ""} nessa saga. Os livros não serão excluídos — apenas deixarão de fazer parte de "${saga.name}".`
      : `A saga "${saga.name}" será removida. Nenhum livro está vinculado a ela no momento.`;

  openConfirm("Excluir saga?", msg, () => deleteSagaNow(id), "Sim, excluir", "🗑");
}

async function deleteSagaNow(id) {
  try {
    await apiRequest(`/api/sagas/${id}`, { method: "DELETE" });

    await loadLibraryMetadata();
    renderSagas();
    resyncBookModalSagaField();
    showToast("Saga removida.");
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

// Se o modal de livro estiver aberto quando uma saga for renomeada/excluída, atualiza o campo
function resyncBookModalSagaField() {
  const bookModal = document.getElementById("modal-overlay");
  if (!bookModal || !bookModal.classList.contains("open")) return;
  const sel = document.getElementById("f-saga");
  if (!sel) return;
  let selId = sel.value;
  if (selId && !sagas.some((s) => String(s.id) === String(selId))) selId = "";
  const order = document.getElementById("f-saga-order")?.value || "";
  populateSagaSelect(selId, order);
}

// ── Página Sagas ──
async function changeSagaPage(page) {
  if (!Number.isInteger(page) || page < 1) return;
  sagaPage = page;
  await renderSagas();
  if (!document.getElementById("page-sagas").classList.contains("active")) return;
  document.getElementById("page-sagas").scrollIntoView({ block: "start" });
  document.querySelector('#saga-pagination [aria-current="page"]')?.focus({ preventScroll: true });
}

async function renderSagas() {
  const request = ++sagasRequest;
  visibleSagas = [];
  document.getElementById("sagas-list").textContent = "Carregando sagas...";
  document.getElementById("saga-pagination").innerHTML = "";
  document.getElementById("sagas-count").textContent = "";
  try {
    const data = await apiRequest(`/api/sagas?page=${sagaPage}&pageSize=${SAGA_PAGE_SIZE}`);
    if (request !== sagasRequest) return;
    sagaPage = data.page;
    visibleSagas = data.items;
    const ids = new Set(visibleSagas.map(s => s.id));
    for (const id of sagaBookPages.keys()) if (!ids.has(id)) sagaBookPages.delete(id);
    renderPagination("saga-pagination", data.total, data.totalPages,
      (data.page - 1) * data.pageSize, data.page, data.pageSize, "sagas", "changeSagaPage");
    document.getElementById("sagas-count").textContent = `${data.total} saga${data.total !== 1 ? "s" : ""} cadastrada${data.total !== 1 ? "s" : ""}`;
    drawSagas();
    for (const saga of visibleSagas) {
      if (expandedSagas.has(saga.id) && !sagaBookPages.has(saga.id)) loadSagaBooks(saga.id);
    }
  } catch (err) {
    if (request !== sagasRequest) return;
    document.getElementById("sagas-list").innerHTML = '<div class="empty">Erro ao carregar sagas. <button class="btn-outline" onclick="renderSagas()">Tentar novamente</button></div>';
  }
}

function drawSagas() {
  const el = document.getElementById("sagas-list");
  if (!visibleSagas.length) {
    el.innerHTML = `<p style="color:var(--muted);text-align:center;padding:32px 0">Nenhuma saga cadastrada ainda. Clique em "＋ Nova saga" para agrupar os livros de uma série (ex: A Torre Negra).</p>`;
    return;
  }

  el.innerHTML = visibleSagas
    .map((s) => {
      const bookPage = sagaBookPages.get(s.id);
      const books = bookPage?.items || [];
      const total = s.total;
      const finished = s.finished;
      const pct = total ? Math.round((finished / total) * 100) : 0;
      const isOpen = expandedSagas.has(s.id);

      return `
      <div class="saga-card">
        <div class="saga-card-header manage-cat-row" id="saga-row-${s.id}">
          <div class="saga-card-title-block" onclick="toggleSagaCard(${s.id})">
            <h3 class="saga-name">${escapeHtml(s.name)}</h3>
            <p class="saga-progress">${total ? `${finished}/${total} concluído${total > 1 ? "s" : ""} · ${pct}%` : "Nenhum livro vinculado ainda"}</p>
          </div>
          <div class="manage-cat-actions">
            <button class="btn-icon-sm" onclick="startRenameSaga(${s.id})" title="Renomear saga">✏️</button>
            <button class="btn-icon-sm btn-icon-danger" onclick="confirmDeleteSaga(${s.id})" title="Excluir saga">🗑</button>
            <button class="saga-toggle-btn" onclick="toggleSagaCard(${s.id})" title="${isOpen ? "Recolher" : "Expandir"}">
              <span class="saga-toggle-ico${isOpen ? " open" : ""}">⌄</span>
            </button>
          </div>
        </div>
        ${total ? `<div class="saga-progress-bar"><div class="saga-progress-fill" style="width:${pct}%"></div></div>` : ""}
        ${isOpen
          ? `<div class="saga-books">
          ${books
            .map(
              (b) => `
            <div class="saga-book-row">
              <span class="saga-vol">${b.saga_order !== null && b.saga_order !== undefined && b.saga_order !== "" ? `Vol. ${b.saga_order}` : "—"}</span>
              <div class="saga-book-info">
                <span class="t">${escapeHtml(b.title)}</span>
                <span class="a">${escapeHtml(b.author || "")} ${b.year ? `· ${b.year}` : ""}</span>
              </div>
              ${badgeHtml(b.category, b.subcategory)}
              <span class="saga-book-status">${statusHtml(b.status)}</span>
              <button class="btn-icon-sm" onclick="editBook(${b.id})" title="Editar livro">✏️</button>
            </div>`,
            )
            .join("") ||
          (!bookPage || bookPage.loading ? '<p>Carregando livros...</p>' : bookPage.error ? `<button class="btn-outline" onclick="loadSagaBooks(${s.id})">Tentar novamente</button>` : "") ||
          `<p style="color:var(--muted);font-size:.85rem;padding:8px 4px">Nenhum livro nessa saga ainda. Edite um livro e selecione essa saga no campo "Saga".</p>`
          }
          ${bookPage?.totalPages > 1 ? `<div class="saga-book-pagination">
            <button class="btn-outline" onclick="loadSagaBooks(${s.id}, ${bookPage.page - 1})" ${bookPage.page === 1 ? "disabled" : ""}>Anterior</button>
            <span>Página ${bookPage.page} de ${bookPage.totalPages}</span>
            <button class="btn-outline" onclick="loadSagaBooks(${s.id}, ${bookPage.page + 1})" ${bookPage.page === bookPage.totalPages ? "disabled" : ""}>Próxima</button>
          </div>` : ""}
        </div>`
          : ""
        }
      </div>`;
    })
    .join("");
}

async function loadSagaBooks(id, page = 1) {
  const pending = { loading: true };
  sagaBookPages.set(id, pending);
  drawSagas();
  try {
    const data = await apiFetch(`?saga_id=${id}&page=${page}&pageSize=50`);
    if (sagaBookPages.get(id) !== pending) return;
    sagaBookPages.set(id, data);
  } catch (err) {
    if (sagaBookPages.get(id) !== pending) return;
    sagaBookPages.set(id, { error: true });
  }
  drawSagas();
}

function toggleSagaCard(id) {
  if (expandedSagas.has(id)) expandedSagas.delete(id);
  else {
    expandedSagas.add(id);
    if (!sagaBookPages.has(id)) { loadSagaBooks(id); return; }
  }
  drawSagas();
}

// ═══════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════
async function openModal(id) {
  const request = ++modalRequest;
  let book;
  if (id) {
    try { book = await apiFetch(`/${id}`); }
    catch (err) { if (request === modalRequest) alert("Erro ao carregar livro: " + err.message); return; }
    if (request !== modalRequest) return;
  }
  editingId = id || null;
  currentRating = null;
  document.getElementById("modal-title").textContent = id
    ? "Editar livro"
    : "Adicionar livro";

  const btn = document.getElementById("reread-btn");
  const label = document.getElementById("reread-label");

  if (id) {
    const b = book;
    document.getElementById("f-title").value = b.title || "";
    document.getElementById("f-author").value = b.author || "";
    document.getElementById("f-pages").value = b.pages || "";
    document.getElementById("f-year").value = b.year || currentYear;
    document.getElementById("f-status").value = b.status || "reading";
    document.getElementById("f-start").value = b.start_date || "";
    document.getElementById("f-end").value = b.end_date || "";
    populateCategorySelect(b.category || "", b.subcategory || "");
    populateSagaSelect(b.saga_id || "", b.saga_order ?? "");
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
    document.getElementById("f-start").value = new Date().toISOString().slice(0, 10);
    document.getElementById("f-end").value = "";
    setStar(null);

    isReread = false;
    const btn = document.getElementById("reread-btn");
    const label = document.getElementById("reread-label");
    if (btn) {
      btn.classList.remove("active");
      label.textContent = "Marcar como releitura";
    }

    populateCategorySelect("", "");
    populateSagaSelect("", "");
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
    subcategory: document.getElementById("f-subcategory").value || "",
    rating: currentRating || 0,
    status: document.getElementById("f-status").value,
    start_date: document.getElementById("f-start").value || null,
    end_date: document.getElementById("f-end").value || null,
    is_reread: isReread,
    saga_id: document.getElementById("f-saga").value
      ? parseInt(document.getElementById("f-saga").value)
      : null,
    saga_order: document.getElementById("f-saga-order").value !== ""
      ? parseFloat(document.getElementById("f-saga-order").value)
      : null,
  };

  try {
    if (editingId) {
      await updateBook(editingId, payload);
      showToast("Livro atualizado!");
    } else {
      await createBook(payload);
      showToast("Livro adicionado!");
    }

    closeModal();
    await loadLibraryMetadata();
    renderYearList();
    const active = document.querySelector(".page.active");
    if (active?.id === "page-dashboard") renderDashboard();
    if (active?.id === "page-acervo") renderAcervo();
    if (active?.id === "page-sagas") renderSagas();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

function editBook(id) {
  openModal(id);
}

// ═══════════════════════════════════════════════════
//  CONFIRM MODAL — openConfirm/closeConfirm ver ui-common.js
// ═══════════════════════════════════════════════════

async function deleteBook(id) {
  const book = acervoBooks.find((b) => b.id === id || b.id === Number(id));
  if (!book) return;

  openConfirm(
    "Excluir permanentemente?",
    `"${book.title}" será removido do acervo e não poderá ser recuperado.`,
    async () => {
      try {
        await removeBook(id);
        await loadLibraryMetadata();
        renderYearList();
        renderAcervo();
        if (document.querySelector(".page.active")?.id === "page-sagas") renderSagas();
        showToast("Livro removido.");
      } catch (err) {
        alert("Erro ao remover: " + err.message);
      }
    },
    "Sim, excluir",
    "🗑",
  );
}
// ═══════════════════════════════════════════════════
//  NEWS POPUP
// ═══════════════════════════════════════════════════
const NEWS_POPUP = {
  version: "v6",                    // ← muda aqui a cada nova versão
  expires: "2026-11-01",            // ← ajuste para 14 dias a partir do lançamento real
  title: "Novidades da Biblioteca Digital",
  items: [
    {
      icon: "📲",
      title: "Novo App Mobile (Android)",
      desc: "Biblioteca Digital agora está disponível para dispositivos Android! Baixe o app e tenha" +
        " acesso rápido ao seu acervo. Por enquanto, o app está disponivel apenas para usuários de android," +
        " mas em breve teremos na Play Store e na Apple Store.",
      cta: {
        label: "⬇️ Baixar Biblioteca Digital APK",
        url: "https://github.com/vitorrcruzz/biblioteca-digital/releases/latest/download/biblioteca-digital.apk"
      }
    },
    {
      icon: "📄",
      title: "Minha Estante paginada",
      desc: "A aba Minha Estante agora é paginada, deixando a navegação mais rápida" + 
      " e organizada, mesmo com um acervo grande.",
    },
    {
      icon: "📊",
      title: "Exporte seus livros para Excel",
      desc: "Nas configurações da conta, você já pode exportar uma planilha Excel com todos os livros registrados no sistema.",
    },
    {
      icon: "🎯",
      title: "Edite e/ou exclua suas metas anuais",
      desc: "Agora é possível editar ou excluir as metas dos anos já registrados, mantendo seu planejamento de leitura sempre atualizado.",
    },
  ]
};

function shouldShowNewsPopup() {
  const key = `news_popup_${NEWS_POPUP.version}`;
  const data = localStorage.getItem(key);
  if (data) return false; // já foi dispensado permanentemente

  // Verifica se ainda está dentro do período
  const today = new Date().toISOString().slice(0, 10);
  const expires = NEWS_POPUP.expires;
  return today <= expires;
}

function renderNewsPopup() {
  const body = document.getElementById("news-popup-body");
  if (!body) return;
  body.innerHTML = NEWS_POPUP.items.map(item => `
    <div class="news-item">
      <span class="news-item-icon">${item.icon}</span>
      <div class="news-item-text">
        <h4>${item.title}</h4>
        <p>${item.desc}</p>
        ${item.cta ? `<a class="news-item-cta" href="${item.cta.url}" target="_blank" rel="noopener">${item.cta.label}</a>` : ""}
      </div>
    </div>
  `).join("");
}

function openNewsPopup() {
  renderNewsPopup();
  document.getElementById("news-popup-overlay").classList.add("open");
}

function closeNewsPopup() {
  document.getElementById("news-popup-overlay").classList.remove("open");
}

function dismissNewsPopup() {
  const key = `news_popup_${NEWS_POPUP.version}`;
  localStorage.setItem(key, "dismissed");
  closeNewsPopup();
}

// ═══════════════════════════════════════════════════
//  TOAST — showToast() ver ui-common.js
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
async function init() {
  try {
    await loadLibraryMetadata();
    renderYearList();
    // Mostra popup de novidades se aplicável
    if (shouldShowNewsPopup()) {
      setTimeout(() => openNewsPopup(), 800);
    }
    // Consome o destino da tela de Conta; novas cargas usam o Dashboard.
    const url = new URL(window.location.href);
    const targetPage = url.searchParams.get("page");
    if (url.searchParams.has("page")) {
      url.searchParams.delete("page");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    goTo(["dashboard", "acervo", "sagas"].includes(targetPage) ? targetPage : "dashboard");
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