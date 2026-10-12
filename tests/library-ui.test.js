const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function ui(api) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {value: '', innerHTML: '', textContent: '', style: {},
        classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle() {}},
        scrollIntoView() {}, focus() {}, scrollTo() {},
      });
    }
    return elements.get(id);
  };
  const ctx = vm.createContext({URL, URLSearchParams, setTimeout, clearTimeout, console,
    window: {addEventListener() {}},
    document: {getElementById: element, querySelector: () => null, querySelectorAll: () => []},
    apiRequest: api, escapeHtml: value => String(value), showToast() {}, alert(msg) {throw Error(msg);},
  });
  vm.runInContext(fs.readFileSync(require.resolve('../public/assets/js/script.js'), 'utf8'), ctx);
  return {ctx, element, run: code => vm.runInContext(code, ctx)};
}
const page = (items, total = items.length, current = 1, pageSize = 50) => ({items, total, page: current, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize))});
const book = id => ({id, title: `Livro ${id}`, author: 'Autor', year: 2026, status: 'reading'});

test('initial load requests only metadata, goals, categories and saga options', async () => {
  const paths = [];
  const {ctx, run} = ui(async path => {
    paths.push(path);
    if (path.endsWith('/metadata')) return {years: [2026], categories: ['HQ'], categoryCounts: [{category: 'HQ', subcategory: '', total: 1000}]};
    return [];
  });
  await ctx.loadLibraryMetadata();
  assert.deepEqual(paths.sort(), ['/api/books/metadata', '/api/categories', '/api/goals', '/api/sagas/options']);
  assert.equal(run('years()[0]'), 2026);
  assert.equal(ctx.countBooksUsingCategory({name: 'HQ'}, false), 1000);
});

test('out-of-order search responses cannot replace the latest results', async () => {
  const pending = [];
  const {ctx, element} = ui(path => new Promise(resolve => pending.push({path, resolve})));
  element('search').value = 'old';
  const old = ctx.renderAcervo();
  element('search').value = 'new';
  const current = ctx.renderAcervo();
  assert.match(pending[1].path, /search=new/);
  assert.match(pending[1].path, /pageSize=50/);
  pending[1].resolve(page([book(1001)], 1));
  await current;
  pending[0].resolve(page([book(1)], 1001));
  await old;
  assert.match(element('acervo-list').innerHTML, /Livro 1001/);
  assert.doesNotMatch(element('acervo-list').innerHTML, /Livro 1</);
  assert.match(element('acervo-count').textContent, /^1 livro/);
});

test('server-clamped pages are reflected in navigation and filters reset the page', async () => {
  const paths = [];
  const {ctx, run, element} = ui(async path => {paths.push(path); return page([book(50)], 50, 1);});
  run('acervoPage = 2');
  await ctx.renderAcervo();
  assert.equal(run('acervoPage'), 1);
  assert.equal(element('acervo-pagination').innerHTML, '');
  run('acervoPage = 8');
  ctx.filterAcervo();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(paths.at(-1), /page=1&/);
});

test('failed page requests expose retry and a successful retry renders results', async () => {
  let fail = true;
  const {ctx, element} = ui(async () => {if (fail) throw Error('offline'); return page([book(1)]);});
  await ctx.renderAcervo();
  assert.match(element('acervo-list').innerHTML, /Tentar novamente/);
  fail = false;
  await ctx.renderAcervo();
  assert.match(element('acervo-list').innerHTML, /Livro 1/);
});

test('saga cards load without books; expanding fetches a bounded page of volumes', async () => {
  const paths = [];
  const {ctx, element} = ui(async path => {
    paths.push(path);
    if (path.startsWith('/api/sagas?')) return page([{id: 1, name: 'Saga', total: 1001, finished: 500}], 21, 1, 10);
    return page([book(1)], 1001);
  });
  await ctx.renderSagas();
  assert.equal(paths.length, 1);
  assert.match(element('sagas-list').innerHTML, /500\/1001/);
  ctx.toggleSagaCard(1);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(paths[1], /saga_id=1&page=1&pageSize=50/);
  assert.match(element('sagas-list').innerHTML, /Livro 1/);
  assert.match(element('sagas-list').innerHTML, /loadSagaBooks\(1, 2\)/);
});

test('dashboard displays aggregate totals and an edit fetches the book by id', async () => {
  const paths = [];
  const {ctx, element} = ui(async path => {
    paths.push(path);
    if (path.includes('/dashboard')) return {stats: {total: 1001, finished: 501, reading: 500, pages: 50100, rating: 4, duration: 10}, recent: [book(1001)], months: [], categories: []};
    return book(9999);
  });
  ctx.renderCharts = () => {};
  await ctx.renderDashboard();
  assert.match(element('dash-sub').textContent, /1001 livros/);
  assert.match(element('stats-grid').innerHTML, /501/);
  await ctx.openModal(9999);
  assert.equal(paths.at(-1), '/api/books/9999');
  assert.equal(element('f-title').value, 'Livro 9999');
});
