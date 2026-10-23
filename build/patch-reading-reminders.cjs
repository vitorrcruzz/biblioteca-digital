const fs = require('node:fs');
const path = require('node:path');
// Capacitor 8.3.1 drops allowWhileIdle when rescheduling calendar reminders.
// Keep this fix reproducible after npm ci and fail visibly if upstream changes.
const root = path.join(__dirname, '../node_modules/@capacitor/local-notifications');
const file = path.join(root, 'android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.kt');
const marker = '// Preserve idle delivery for recurring reminders.';
let source = fs.readFileSync(file, 'utf8');
if (!source.includes(marker)) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  if (version !== '8.3.1') throw Error('Review the recurring reminder patch for Capacitor ' + version);
  const start = source.indexOf('        if (wantsExact && canExact) {');
  const end = source.indexOf('        val sdf =', start);
  if (start < 0 || end < 0) throw Error('Recurring reminder patch target not found');
  source = source.slice(0, start) + `        ${marker}
        val whileIdle = storedNotification?.getJSObject("schedule")?.getBoolean("allowWhileIdle", false) ?: false
        if (wantsExact && canExact) {
            if (whileIdle) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent)
            }
        } else {
            if (whileIdle) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)
            }
        }
` + source.slice(end);
  fs.writeFileSync(file, source);
}
