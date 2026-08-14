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
let categories = []; // lista de categorias carregadas da API
let newCatParentId = null; // null = nova categoria raiz, número = nova subcategoria
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

async function loadBooks() {
  const token = window.__getAuthToken ? await window.__getAuthToken() : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const [books, goalsArr, cats] = await Promise.all([
    apiFetch(""),
    fetch("/api/goals", { headers }).then((r) => {
      if (!r.ok) throw new Error("goals 401");
      return r.json();
    }),
    fetch("/api/categories", { headers }).then((r) => r.json()),
  ]);

  DB.books = books;
  DB.goals = {};
  goalsArr.forEach((g) => (DB.goals[g.year] = g.target));
  categories = cats;
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
        : `Parabéns! Meta de ${currentYear} atingida!`;
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

  const token = window.__getAuthToken ? await window.__getAuthToken() : null;
  try {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, parent_id: newCatParentId }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Erro ao salvar categoria");
      return;
    }

    const newCat = await res.json();

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

  const token = window.__getAuthToken ? await window.__getAuthToken() : null;
  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newName }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao renomear categoria");
      return;
    }

    await loadBooks();
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
  if (isSub) {
    const parentName = findParentCategoryName(cat.id);
    return DB.books.filter((b) => b.category === parentName && b.subcategory === cat.name).length;
  }
  return DB.books.filter((b) => b.category === cat.name).length;
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

  openConfirm("Excluir categoria?", msg, () => deleteCategoryNow(id));
}

async function deleteCategoryNow(id) {
  const cat = findCategoryById(id);
  if (!cat) return;
  const oldName = cat.name;
  const isSub = cat.parent_id !== null;

  const token = window.__getAuthToken ? await window.__getAuthToken() : null;
  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao excluir categoria");
      return;
    }

    await loadBooks();
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
    populateCategorySelect(b.category || "", b.subcategory || "");
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
//  NEWS POPUP
// ═══════════════════════════════════════════════════
const NEWS_POPUP = {
  version: "v2",                    // ← muda aqui a cada nova versão
  expires: "2026-08-27",            // ← 14 dias a partir do lançamento
  title: "Novidades da Biblioteca Digital",
  items: [
    {
      icon: "📝",
      title: "Edite suas categorias/subcategorias",
      desc: "Agora você pode editar suas categorias e subcategorias diretamente na interface" +
        " de edição dos livros."
    },
    {
      icon: "📖",
      title: "Novas informações na tela acervo",
      desc: "Agora você pode visualizar mais detalhes sobre cada livro na tela do acervo." +
        " como data de término, categoria/subcategoria , avaliação e status de leitura."
    },
    // {
    //   icon: "🔍",
    //   title: "Busca por ISBN",
    //   desc: "Adicione um livro informando o ISBN e os dados são preenchidos automaticamente via Google Books."
    // },
    // {
    //   icon: "⚙️",
    //   title: "Página de conta",
    //   desc: "Gerencie seu perfil, altere nome, e-mail, senha e meta de leitura do ano na página de conta."
    // },
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
    // Mostra popup de novidades se aplicável
    if (shouldShowNewsPopup()) {
      setTimeout(() => openNewsPopup(), 800);
    }
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