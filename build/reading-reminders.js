import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createReadingReminders } from './reading-reminders-core.js';

if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocalNotifications')) {
  const reminders = createReadingReminders({notifications:LocalNotifications,storage:localStorage,
    fetchCount:async()=>{
      const page = await window.apiRequest('/api/books?status=reading&page=1&pageSize=1', {signal:AbortSignal.timeout(15000)});
      return page.total;
    }
  });
  window.ReadingReminders = reminders;
  let ready=false, busy=false;
  const hint = text => { const el=document.getElementById('reminder-hint');if(el) el.textContent=text; };
  function describe(result) {
    if (!result) return;
    hint(result.state==='disabled' ? '' : result.state==='empty'
      ? 'Preferência salva. Os lembretes serão agendados quando houver uma leitura em andamento.'
      : `Lembretes ativos para ${result.count} leitura(s) em andamento. Horário aproximado, conforme o Android.`);
  }
  function updateControls() {
    const panel=document.getElementById('reading-reminders');
    if (!panel) return;
    const enabled=document.getElementById('reminder-enabled');
    document.getElementById('reminder-options').hidden=!enabled.checked;
    panel.querySelectorAll('input, button').forEach(input=>{input.disabled=!ready||busy;});
  }
  async function saveOptions(options) {
    busy=true;updateControls();
    try { describe(await reminders.save(options)); }
    catch(error) { hint(error.message || 'N\u00e3o foi poss\u00edvel salvar os lembretes.'); }
    finally {busy=false;render();}
  }
  function render() {
    const panel=document.getElementById('reading-reminders');
    if (!panel) return;
    panel.hidden=false;
    const settings=reminders.settings();
    document.getElementById('reminder-enabled').checked=settings.enabled;
    document.getElementById('reminder-time').value=settings.time;
    panel.querySelectorAll('[name="reminder-day"]').forEach(input=>{input.checked=settings.days.includes(Number(input.value));});
    updateControls();
  }
  async function sync() {
    if (!ready) return;
    try { describe(await reminders.sync()); }
    catch { hint('Não foi possível atualizar os lembretes. Verifique a conexão e a permissão de notificações.'); }
  }
  async function initialize() {
    if (!window.__authUserId) return;
    ready=true;busy=true;render();
    try { describe(await reminders.setUser(window.__authUserId)); }
    catch(error) {hint(error.message);}
    finally {busy=false;render();}
    const enabled=document.getElementById('reminder-enabled');
    if (enabled) enabled.onchange=async()=>{
      if (busy) return;
      updateControls();
      if (enabled.checked) {
        hint('Escolha os dias e o hor\u00e1rio e toque em Salvar lembretes.');
      } else {
        await saveOptions({...reminders.settings(), enabled:false});
      }
    };
    const save=document.getElementById('reminder-save');
    if(save) save.onclick=async()=>{
      if(busy) return;
      const options={enabled:document.getElementById('reminder-enabled').checked,time:document.getElementById('reminder-time').value,
        days:[...document.querySelectorAll('[name="reminder-day"]:checked')].map(input=>Number(input.value))};
      await saveOptions(options);
    };
  }
  window.addEventListener('authReady',initialize);
  if(window.__authReady) initialize();
  window.addEventListener('libraryChanged',sync);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') sync();});
  LocalNotifications.addListener('localNotificationActionPerformed',event=>{
    if(event.notification.extra?.kind==='reading-reminder') window.location.href='/';
  }).catch(()=>{});
}