// ?tema=natal força uma prévia por aba; ?tema=nenhum desliga; ?tema=auto encerra a prévia.
// Os endereços antigos ?natal=1, ?natal=0 e ?natal=auto continuam funcionando.
(() => {
  const themes = (window.SEASONAL_THEMES || []).filter(theme =>
    theme && typeof theme.id === 'string' && /^[a-z][a-z0-9-]*$/.test(theme.className) &&
    Number.isFinite(Date.parse(theme.startsAt)) && Number.isFinite(Date.parse(theme.endsAt)) &&
    Date.parse(theme.startsAt) < Date.parse(theme.endsAt)
  );
  const params = new URLSearchParams(window.location.search);
  const legacy = { '1': 'natal', '0': 'nenhum', auto: 'auto' };
  const requested = params.get('tema') || legacy[params.get('natal')];
  const isPreview = value => value === 'nenhum' || themes.some(theme => theme.id === value);
  let preview = isPreview(requested) ? requested : null;
  try {
    // Remove a preferência antiga ao retornar ao calendário, inclusive no APK de teste.
    if (requested === 'auto') {
      sessionStorage.removeItem('library-seasonal-preview');
      sessionStorage.removeItem('library-christmas-preview');
    } else if (isPreview(requested)) {
      sessionStorage.setItem('library-seasonal-preview', requested);
      sessionStorage.removeItem('library-christmas-preview');
    }
    const saved = sessionStorage.getItem('library-seasonal-preview') ||
      legacy[sessionStorage.getItem('library-christmas-preview')];
    preview = isPreview(saved) ? saved : null;
  } catch { /* O calendário também funciona com armazenamento bloqueado. */ }

  let timer;
  let greeting;
  let greetingTheme;

  function refreshTheme() {
    const now = Date.now();
    const active = preview
      ? themes.find(theme => theme.id === preview)
      : themes.find(theme => now >= Date.parse(theme.startsAt) && now < Date.parse(theme.endsAt));
    new Set(themes.map(theme => theme.className)).forEach(className => {
      document.documentElement.classList.toggle(className, className === active?.className);
    });

    if (greetingTheme !== active?.id) {
      greeting?.remove();
      greeting = null;
      greetingTheme = active?.id;
      const header = document.querySelector('#page-dashboard .page-header');
      if (active?.greeting && header) {
        const copy = active.greeting;
        greeting = document.createElement('section');
        greeting.id = 'seasonal-greeting';
        greeting.className = copy.className;
        greeting.setAttribute('aria-label', copy.label);
        const icon = document.createElement('span');
        icon.className = `${copy.className}-icon`;
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = copy.icon;
        const content = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = copy.title;
        const message = document.createElement('p');
        message.textContent = copy.message;
        content.append(title, message);
        greeting.append(icon, content);
        header.after(greeting);
      }
    }

    clearTimeout(timer);
    if (!preview) {
      const boundaries = themes.flatMap(theme => [Date.parse(theme.startsAt), Date.parse(theme.endsAt)]);
      const next = Math.min(...boundaries.filter(date => date > now));
      // Acorda na mudança de período; no máximo a cada hora para rever o relógio.
      timer = setTimeout(refreshTheme, Math.min(next - now, 60 * 60 * 1000));
    }
  }

  refreshTheme();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshTheme();
  });
  window.addEventListener('pageshow', refreshTheme);
})();
