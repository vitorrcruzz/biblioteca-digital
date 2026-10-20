(() => {
  const trigger = document.getElementById('reminder-time');
  const dialog = document.getElementById('reminder-time-dialog');
  if (!trigger || !dialog) return;
  const hour = document.getElementById('reminder-hour');
  const minute = document.getElementById('reminder-minute');
  trigger.addEventListener('click', () => {
    const parts = trigger.value.split(':');
    hour.value = parts[0];
    minute.value = parts[1];
    dialog.showModal();
    hour.focus();
    hour.select();
  });
  document.getElementById('reminder-time-cancel').addEventListener('click', () => dialog.close());
  document.getElementById('reminder-time-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const value = `${hour.value.padStart(2, '0')}:${minute.value.padStart(2, '0')}`;
    trigger.value = value;
    trigger.textContent = value;
    trigger.dispatchEvent(new Event('change', {bubbles:true}));
    dialog.close();
  });
  dialog.addEventListener('close', () => trigger.focus());
})();
