import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { updateOffer } from './android-update-policy.cjs';

// The server bundle also runs in APKs that predate the App plugin.
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  let checking = false;
  let lastCheck = 0;
  let dialog;
  let pending = true;
  const idleWaiters = [];
  window.AndroidUpdates = {
    whenIdle: () => pending ? new Promise(resolve => idleWaiters.push(resolve)) : Promise.resolve(),
  };
  function releaseNews() {
    if (checking || dialog?.open) return;
    pending = false;
    idleWaiters.splice(0).forEach(resolve => resolve());
  }
  const read = key => { try { return Number(localStorage.getItem(key)); } catch { return 0; } };
  const remember = key => { try { localStorage.setItem(key, String(Date.now())); } catch {} };
  function showOffer(offer, key) {
    if (dialog?.open) return;
    if (!document.getElementById('android-update-styles')) {
      const css = document.createElement('link');
      css.id = 'android-update-styles';
      css.rel = 'stylesheet';
      css.href = '/assets/css/android-updates.css';
      document.head.appendChild(css);
    }
    const previousFocus = document.activeElement;
    const currentDialog = document.createElement('dialog');
    dialog = currentDialog;
    dialog.className = 'android-update-dialog';
    dialog.setAttribute('aria-labelledby', 'android-update-title');
    dialog.setAttribute('aria-describedby', 'android-update-description');
    const badge = document.createElement('p');
    badge.className = 'android-update-badge';
    badge.textContent = 'BIBLIOTECA DIGITAL • ANDROID';
    const title = document.createElement('h2');
    title.id = 'android-update-title';
    title.textContent = 'Uma nova versão para sua biblioteca';
    const version = document.createElement('p');
    version.className = 'android-update-version';
    version.textContent = 'Versão ' + offer.version + ' disponível';
    const description = document.createElement('p');
    description.id = 'android-update-description';
    description.textContent = offer.message;
    const hint = document.createElement('p');
    hint.className = 'android-update-hint';
    hint.textContent = 'Baixe o APK e confirme a atualização no Android.';
    const download = document.createElement('a');
    download.className = 'android-update-download';
    download.href = offer.url;
    download.target = '_blank';
    download.rel = 'noopener noreferrer';
    download.textContent = 'Atualizar aplicativo';
    const later = document.createElement('button');
    later.type = 'button';
    later.textContent = 'Agora não';
    const dismiss = () => { remember(key); currentDialog.close(); };
    later.addEventListener('click', dismiss);
    download.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener('close', () => {
      currentDialog.remove();
      previousFocus?.focus();
      releaseNews();
    });
    dialog.append(badge, title, version, description, hint, download, later);
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  async function check() {
    if (checking || dialog?.open) return;
    if (document.hidden || Date.now() - lastCheck < 5 * 60 * 1000 ||
        document.getElementById('news-popup-overlay')?.classList.contains('open')) {
      releaseNews();
      return;
    }
    checking = true;
    pending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      let build = null;
      if (Capacitor.isPluginAvailable('App')) {
        const info = await App.getInfo();
        build = Number(info.build);
      }
      const response = await fetch('/android-update.json', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const policy = await response.json();
      const key = 'android-update-dismissed-' + policy.latestBuild;
      const offer = updateOffer(policy, build, read(key));
      lastCheck = Date.now();
      if (offer) showOffer(offer, key);
    } catch {
      // An optional update check must never prevent using the app.
    } finally { clearTimeout(timeout); checking = false; releaseNews(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  else check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('online', check);
  if (Capacitor.isPluginAvailable('App')) App.addListener('appStateChange', ({ isActive }) => { if (isActive) check(); }).catch(() => {});
}
