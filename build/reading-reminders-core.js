// Local notification state is scoped to the signed-in account on this device.
export function createReadingReminders({notifications, storage, fetchCount}) {
  const scheduleKey = 'reading-reminders-schedule-v2';
  const ownerKey = 'reading-reminders-owner-v1';
  const ids = Array.from({length:7}, (_,i)=>({id:73100+i+1}));
  const key = uid => `reading-reminders-v1:${uid}`;
  let uid = null, revision = 0, queue = Promise.resolve();
  const enqueue = action => {
    const task = queue.then(action);
    queue = task.catch(()=>{});
    return task;
  };
  function validate(value) {
    if (typeof value.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || !Array.isArray(value.days)) throw Error('Escolha um horário válido.');
    const days = [...new Set(value.days)].sort((a,b)=>a-b);
    if (days.some(d=>!Number.isInteger(d)||d<1||d>7) || (value.enabled && !days.length)) throw Error('Selecione pelo menos um dia da semana.');
    return {enabled:value.enabled,time:value.time,days};
  }
  function settings() {
    try { return validate(JSON.parse(storage.getItem(key(uid)))); }
    catch { return {enabled:false,time:'20:00',days:[1,2,3,4,5,6,7]}; }
  }
  async function cancel() {
    storage.removeItem(scheduleKey);
    await notifications.cancel({notifications:ids});
    const delivered = await notifications.getDeliveredNotifications();
    const own = delivered.notifications.filter(n=>ids.some(i=>i.id===Number(n.id)));
    if (own.length) await notifications.removeDeliveredNotifications({notifications:own});
  }
  function assertCurrent(user, stamp) {
    if (uid !== user || revision !== stamp) throw Error('A conta mudou. Abra novamente as configurações.');
  }
  async function apply(options, user, stamp, askPermission) {
    assertCurrent(user,stamp);
    if (storage.getItem(ownerKey) !== user) {
      await cancel();
      storage.setItem(ownerKey,user);
    }
    if (!options.enabled) { await cancel(); return {state:'disabled',count:0}; }
    let permission = await notifications.checkPermissions();
    if (askPermission && permission.display !== 'granted') permission = await notifications.requestPermissions();
    assertCurrent(user,stamp);
    if (permission.display !== 'granted') {
      await cancel();
      throw Error('Notificações não permitidas. Ative-as nas configurações do Android para receber lembretes.');
    }
    const count = await fetchCount();
    assertCurrent(user,stamp);
    if (!Number.isSafeInteger(count) || count < 0) throw Error('Não foi possível verificar suas leituras.');
    const signature = JSON.stringify({user,options,count});
    if (count && storage.getItem(scheduleKey) === signature) {
      const pending = await notifications.getPending();
      assertCurrent(user,stamp);
      const expected = options.days.map(day=>73100+day);
      const own = pending.notifications.filter(n=>ids.some(i=>i.id===Number(n.id)));
      if (own.length === expected.length && expected.every(id=>own.some(n=>Number(n.id)===id))) {
        return {state:'scheduled',count};
      }
    }
    await cancel();
    assertCurrent(user,stamp);
    if (count) {
      const [hour,minute] = options.time.split(':').map(Number);
      await notifications.createChannel({id:'reading-reminders',name:'Lembretes de leitura',description:'Lembretes para continuar suas leituras',importance:3,visibility:0});
      assertCurrent(user,stamp);
      try {
        await notifications.schedule({notifications:options.days.map(day=>({
          id:73100+day,title:'Que tal continuar sua leitura?',
          body: count===1 ? 'Você tem uma leitura em andamento. Reserve um momento para continuar.' : `Você tem ${count} leituras em andamento. Reserve um momento para continuar.`,
          channelId:'reading-reminders',smallIcon:'ic_reading_notification',iconColor:'#E9B949',
          schedule:{on:{weekday:day,hour,minute,second:0},repeats:true,allowWhileIdle:true},
          isExactNotification:false,autoCancel:true,extra:{kind:'reading-reminder'}
        }))});
      } catch(error) { await cancel(); throw error; }
      assertCurrent(user,stamp);
      storage.setItem(scheduleKey,signature);
    }
    return {state:count ? 'scheduled':'empty',count};
  }
  return {
    settings,
    setUser(user) {
      uid = user; const stamp = ++revision;
      return enqueue(()=>apply(settings(),user,stamp,false));
    },
    sync() {
      if (!uid) return Promise.resolve(null);
      const user=uid, stamp=revision;
      return enqueue(()=>apply(settings(),user,stamp,false));
    },
    save(value) {
      if (!uid) return Promise.reject(Error('Entre na sua conta novamente.'));
      const options=validate(value), user=uid, stamp=revision;
      return enqueue(async()=>{
        const result=await apply(options,user,stamp,true);
        assertCurrent(user,stamp);
        storage.setItem(key(user),JSON.stringify(options));
        return result;
      });
    },
    clearSession() {
      uid=null; ++revision;
      return enqueue(async()=>{await cancel();storage.removeItem(ownerKey);});
    }
  };
}