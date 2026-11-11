// Identity choices live in the existing Add/Edit form. No automatic merges.
let selectedBookWork = null;
let editingBookWork = null;
let bookSuggestions = [];
let bookSuggestionTimer;
let bookSuggestionRequest = 0;
let bookHistoryRequest = 0;
let separateBookChoice = false;
let savingReading = false;

function resetBookIdentity(editing = false) {
  clearTimeout(bookSuggestionTimer);
  ++bookSuggestionRequest;
  ++bookHistoryRequest;
  selectedBookWork = null;
  editingBookWork = null;
  separateBookChoice = false;
  bookSuggestions = [];
  for (const id of ['book-identity', 'book-suggestions', 'book-history', 'book-management-content']) {
    const el = document.getElementById(id);
    el.hidden = true;
    el.replaceChildren();
  }
  const management = document.getElementById('book-management');
  management.hidden = !editing;
  management.open = false;
  document.getElementById('book-search-help').hidden = editing;
  document.getElementById(editing ? 'book-management-suggestions' : 'book-suggestion-slot')
    .append(document.getElementById('book-suggestions'));
  lockBookFields(false);
}

function lockBookFields(locked) {
  for (const id of ['f-title', 'f-author', 'f-saga', 'f-saga-order', 'reread-btn']) {
    document.getElementById(id).disabled = locked;
  }
}

function identityAction(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-outline';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function identityText(parent, text, tag = 'p') {
  const el = document.createElement(tag);
  el.textContent = text;
  parent.append(el);
  return el;
}

function renderBookSuggestions(matches, conflict = false) {
  bookSuggestions = matches;
  const panel = document.getElementById('book-suggestions');
  panel.replaceChildren();
  panel.hidden = !matches.length;
  panel.classList.toggle('book-suggestions-compact', !editingId);
  if (!matches.length) return;
  if (!editingId) {
    identityText(panel, 'Livros do seu acervo', 'strong');
    for (const book of matches) {
      const row = identityAction('', () => chooseExistingBook(book));
      row.className = 'book-search-result';
      const copy = document.createElement('span');
      copy.className = 'book-search-copy';
      identityText(copy, book.title, 'strong');
      identityText(copy, book.author || 'Autor não informado', 'small');
      if (book.saga_name) identityText(copy, `${book.saga_name}${book.saga_order != null ? ` · Vol. ${book.saga_order}` : ''}`, 'small');
      const arrow = document.createElement('span');
      arrow.textContent = '›';
      arrow.className = 'book-search-arrow';
      row.append(copy, arrow);
      panel.append(row);
    }
    const other = identityAction('＋ Cadastrar outro livro', () => {
      separateBookChoice = true;
      panel.hidden = true;
      if (conflict) saveBook();
    });
    other.className = 'book-search-other';
    panel.append(other);
    return;
  }
  const selected = new Set();
  const mergeButton = identityAction('Vincular selecionados', () => confirmReadingGroups([...selected]));
  mergeButton.disabled = true;
  identityText(panel, editingId ? 'Selecione os registros deste mesmo livro. Todas as leituras deles serão reunidas com esta, sem perder o histórico.'
    : 'Já está no seu acervo? Escolha o livro para registrar outra leitura.', 'strong');
  for (const book of matches) {
    const card = document.createElement('div');
    card.className = 'book-suggestion';
    identityText(card, book.title, 'strong');
    const saga = book.saga_name ? ` · ${book.saga_name}${book.saga_order != null ? ` · Vol. ${book.saga_order}` : ''}` : '';
    identityText(card, `${book.author || 'Autor não informado'}${saga}`);
    identityText(card, `${book.reading_count} leitura(s) · Último registro: ${book.year} · ${book.pages} páginas`);
    const actions = document.createElement('div');
    actions.className = 'book-identity-actions';
    if (editingId) {
      const label = document.createElement('label');
      label.className = 'book-merge-choice';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(book.book_id);
        else selected.delete(book.book_id);
        mergeButton.disabled = !selected.size;
      });
      const text = document.createElement('span');
      text.textContent = 'É o mesmo livro';
      label.append(checkbox, text);
      actions.append(label);
    } else {
      actions.append(identityAction('＋ Nova leitura deste livro', () => chooseExistingBook(book)));
      if (book.unfinished) actions.append(identityAction(`Continuar leitura de ${book.unfinished.year}`, () => {
        openConfirm('Continuar leitura?', 'O formulário abrirá o registro em andamento. Os dados ainda não salvos deste formulário serão descartados.',
          () => openModal(book.unfinished.id), 'Continuar');
      }));
    }
    card.append(actions);
    panel.append(card);
  }
  if (editingId) panel.append(mergeButton);
  if (!editingId) panel.append(identityAction('É outro livro — cadastrar separado', () => {
    separateBookChoice = true;
    panel.hidden = true;
    if (conflict) saveBook();
  }));
}

function scheduleBookSuggestions() {
  separateBookChoice = false;
  clearTimeout(bookSuggestionTimer);
  const request = ++bookSuggestionRequest;
  const modal = modalRequest;
  if (selectedBookWork) return;
  const title = document.getElementById('f-title').value.trim();
  if (title.length < 2) { renderBookSuggestions([]); return; }
  bookSuggestionTimer = setTimeout(async () => {
    try {
      const matches = await apiFetch(`/suggestions?search=${encodeURIComponent(title)}&exclude=${editingBookWork?.book_id || 0}&grouped=${!editingId}`);
      if (request !== bookSuggestionRequest || modal !== modalRequest) return;
      renderBookSuggestions(matches);
    } catch (err) {
      if (request !== bookSuggestionRequest || modal !== modalRequest) return;
      const panel = document.getElementById('book-suggestions');
      panel.hidden = false;
      panel.textContent = 'Não foi possível buscar leituras anteriores. Tente novamente ao digitar o título.';
    }
  }, 300);
}

function chooseExistingBook(book) {
  selectedBookWork = book;
  separateBookChoice = false;
  ++bookSuggestionRequest;
  document.getElementById('f-title').value = book.title;
  document.getElementById('f-author').value = book.author;
  // Suggest the last page count without overwriting a value the user already entered.
  if (!document.getElementById('f-pages').value) document.getElementById('f-pages').value = book.pages || '';
  if (!document.getElementById('f-category').value) populateCategorySelect(book.category, book.subcategory);
  populateSagaSelect(book.saga_id || '', book.saga_order ?? '');
  isReread = true;
  document.getElementById('reread-btn').classList.add('active');
  document.getElementById('reread-label').textContent = 'Releitura';
  document.getElementById('book-suggestions').hidden = true;
  document.getElementById('modal-title').textContent = 'Registrar nova leitura';
  lockBookFields(true);
  const panel = document.getElementById('book-identity');
  panel.replaceChildren();
  panel.hidden = false;
  identityText(panel, 'Nova leitura selecionada', 'strong');
  identityText(panel, 'Preencha os dados abaixo. Seu histórico será preservado.');
  if (book.unfinished) panel.append(identityAction(`Continuar leitura de ${book.unfinished.year}`, () => {
    openConfirm('Continuar leitura?', 'O formulário abrirá a leitura em andamento. Os dados ainda não salvos serão descartados.',
      () => openModal(book.unfinished.id), 'Continuar');
  }));
  panel.append(identityAction('Escolher outro livro', () => {
    selectedBookWork = null;
    lockBookFields(false);
    panel.hidden = true;
    document.getElementById('modal-title').textContent = 'Adicionar livro';
    isReread = false;
    document.getElementById('reread-btn').classList.remove('active');
    document.getElementById('reread-label').textContent = 'Marcar como releitura';
    document.getElementById('f-title').focus();
    scheduleBookSuggestions();
  }));
}

async function loadReadingIdentity(id, modal) {
  try {
    const data = await apiFetch(`/${id}/identity`);
    if (modal !== modalRequest) return;
    editingBookWork = data.work;
    const panel = document.getElementById('book-management-content');
    panel.hidden = false;
    identityText(panel, data.work.reading_count > 1
      ? 'Título, autor, saga e volume são compartilhados. Alterá-los atualiza todas as leituras vinculadas. Os demais campos são apenas desta leitura.'
      : 'Páginas, datas e avaliação pertencem a esta leitura. Você pode vinculá-la a outro registro do mesmo livro.');
    const actions = document.createElement('div');
    actions.className = 'book-identity-actions';
    actions.append(identityAction('Histórico de leituras', () => showBookReadingHistory(data.work.book_id)));
    actions.append(identityAction('Vincular a outro registro', scheduleBookSuggestions));
    if (data.work.reading_count > 1) actions.append(identityAction('Separar esta leitura', () => {
      openConfirm('Separar esta leitura?', 'Ela passará a representar um livro independente. As outras leituras serão preservadas. Alterações não salvas no formulário serão descartadas.',
        () => changeReadingLink(id, null), 'Separar');
    }));
    panel.append(actions);
    if (document.getElementById('f-title').value === data.work.title) renderBookSuggestions(data.matches);
  } catch (err) {
    if (modal !== modalRequest) return;
    const panel = document.getElementById('book-management-content');
    panel.hidden = false;
    panel.textContent = 'Não foi possível carregar o vínculo deste livro.';
  }
}

function confirmReadingLink(book) {
  const id = editingId;
  openConfirm('Vincular esta leitura?',
    `Ela usará o título, autor, saga e volume de “${book.title}”, de ${book.author || 'autor não informado'}. Páginas, ano, datas, nota e status salvos serão preservados. Alterações ainda não salvas serão descartadas. Você poderá separar a leitura depois.`,
    () => changeReadingLink(id, book.book_id), 'Vincular');
}

function confirmReadingGroups(bookIds) {
  if (!bookIds.length || savingReading) return;
  const id = editingId;
  openConfirm('Reunir leituras deste livro?',
    'Todas as leituras dos registros selecionados serão vinculadas a este livro, mantendo o título, autor, saga e volume já salvos aqui. Anos, páginas, datas, notas e status serão preservados. Alterações não salvas no formulário serão descartadas. Você poderá separar cada leitura depois.',
    () => changeReadingLink(id, null, bookIds), 'Reunir leituras');
}

async function reviewBookReadings(id) {
  await openModal(id);
  if (editingId !== id || !document.getElementById('modal-overlay').classList.contains('open')) return;
  const management = document.getElementById('book-management');
  management.open = true;
  management.scrollIntoView({ block: 'nearest' });
}

async function changeReadingLink(id, bookId, bookIds = null) {
  if (savingReading) return;
  const modal = modalRequest;
  savingReading = true;
  document.getElementById('save-book-btn').disabled = true;
  try {
    const action = bookIds ? 'merge' : bookId == null ? 'unlink' : 'link';
    await apiFetch(`/${id}/${action}`, { method: 'POST', body: JSON.stringify(bookIds ? { book_ids: bookIds } : { book_id: bookId }) });
    await refreshReadingViews();
    savingReading = false;
    if (modal === modalRequest) await openModal(id);
    showToast(bookIds ? 'Leituras reunidas. A saga conta este livro uma vez.' : bookId == null ? 'Leitura separada.' : 'Leitura vinculada. A saga conta este livro uma vez.');
  } catch (err) { alert('Não foi possível alterar o vínculo: ' + err.message); }
  finally {
    savingReading = false;
    document.getElementById('save-book-btn').disabled = false;
  }
}

async function showBookReadingHistory(bookId, page = 1) {
  const modal = modalRequest;
  const request = ++bookHistoryRequest;
  const panel = document.getElementById('book-history');
  panel.hidden = false;
  panel.textContent = 'Carregando leituras...';
  try {
    const data = await apiFetch(`/works/${bookId}/readings?page=${page}&pageSize=10`);
    if (modal !== modalRequest || request !== bookHistoryRequest) return;
    panel.replaceChildren();
    identityText(panel, 'Histórico de leituras', 'strong');
    for (const reading of data.items) {
      const row = document.createElement('div');
      row.className = 'book-suggestion';
      const status = { reading: 'Lendo', finished: 'Concluído', paused: 'Pausado' }[reading.status];
      identityText(row, `${reading.year} · ${status} · ${reading.pages} páginas · Nota: ${reading.rating || 'sem nota'}`);
      const button = identityAction(reading.id === editingId ? 'Leitura aberta' : 'Abrir esta leitura', () => {
        openConfirm('Abrir outra leitura?', 'Alterações ainda não salvas no formulário serão descartadas.', () => openModal(reading.id), 'Abrir');
      });
      button.disabled = reading.id === editingId;
      row.append(button);
      panel.append(row);
    }
    const actions = document.createElement('div');
    actions.className = 'book-identity-actions';
    if (page > 1) actions.append(identityAction('Anterior', () => showBookReadingHistory(bookId, page - 1)));
    if (page < data.totalPages) actions.append(identityAction('Próxima', () => showBookReadingHistory(bookId, page + 1)));
    actions.append(identityAction('Recolher histórico', () => { panel.hidden = true; }));
    panel.append(actions);
  } catch (err) { if (modal === modalRequest && request === bookHistoryRequest) panel.textContent = 'Não foi possível carregar as leituras. Tente novamente.'; }
}

async function refreshReadingViews() {
  await loadLibraryMetadata();
  renderYearList();
  const active = document.querySelector('.page.active')?.id;
  if (active === 'page-dashboard') await renderDashboard();
  if (active === 'page-acervo') await renderAcervo();
  if (active === 'page-sagas') await renderSagas();
}

document.getElementById('f-title').addEventListener('input', scheduleBookSuggestions);
document.getElementById('f-author').addEventListener('input', () => { separateBookChoice = false; });
for (const id of ['f-saga', 'f-saga-order']) {
  document.getElementById(id).addEventListener('change', () => { separateBookChoice = false; });
}
