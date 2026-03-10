let albums = [], settings = { reminderDays: [3,7,30], allowedTypes: ['Album'], notifyHour: 19 }, vapidKey = '';
let deferredInstall = null;

async function init() {
  const status = await fetch('/api/status').then(r => r.json());
  vapidKey = status.pushKey || '';
  if (!status.authReady) { return; }
  document.getElementById('tabbar').style.display = 'flex';
  document.getElementById('hdr-status').style.display = 'flex';
  document.getElementById('hdr-sync-btn').style.display = 'flex';
  switchTab('library');
  if (status.lastSync) {
    const d = new Date(status.lastSync);
    document.getElementById('hdr-sync-time').textContent =
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  await loadAlbums();
  checkPrompts();
}

async function loadAlbums() {
  const d = await fetch('/api/albums').then(r => r.json());
  albums = d.albums;
  settings = d.settings;
  renderAlbums();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.id === 'tab-' + tab));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.getElementById('content').scrollTop = 0;
  if (tab === 'settings') renderSettings();
}

function renderAlbums() {
  const grid = document.getElementById('album-grid');
  document.getElementById('album-count').textContent = albums.length;
  if (!albums.length) {
    grid.innerHTML = `<div class="empty">
      <div class="empty-ico">🎵</div>
      <h3>No albums yet</h3>
      <p>Save albums in YouTube Music.<br>They'll show up here after the next sync.</p>
    </div>`;
    return;
  }
  grid.innerHTML = albums.map(a => {
    const isDue = (settings.reminderDays || []).some(d => a.ageDays >= d && !(a.remindersSent || []).includes(d));
    const isSnoozed = a.snoozedDaysLeft > 0;
    const showType = a.releaseType && a.releaseType !== 'Album' && a.releaseType !== 'Unknown';
    return `<div class="card" id="card-${esc(a.id)}">
      ${a.thumbnail
        ? `<img class="thumb" src="${esc(a.thumbnail)}" alt="${esc(a.title)}" loading="lazy">`
        : `<div class="thumb-ph">🎵</div>`}
      ${isDue ? `<div class="badge badge-due">Due</div>` : ''}
      ${isSnoozed && !isDue ? `<div class="badge badge-snooze">+${a.snoozedDaysLeft}d</div>` : ''}
      <div class="card-body">
        <div class="card-title">${esc(a.title)}</div>
        <div class="card-artist">${esc(a.artist)}</div>
        <div class="card-meta">
          ${showType ? `<span class="type-pill">${esc(a.releaseType)}</span>` : ''}
          ${a.ageDays}d
        </div>
      </div>
      <div class="card-actions">
        <a class="btn-play" href="https://music.youtube.com/browse/${esc(a.id)}" target="_blank">
          <svg class="yt-icon" viewBox="0 0 18 12"><path d="M17.6 1.9a2.3 2.3 0 0 0-1.6-1.6C14.5 0 9 0 9 0S3.5 0 2 .3A2.3 2.3 0 0 0 .4 1.9C0 3.4 0 6 0 6s0 2.6.4 4.1a2.3 2.3 0 0 0 1.6 1.6C3.5 12 9 12 9 12s5.5 0 7-0.3a2.3 2.3 0 0 0 1.6-1.6C18 8.6 18 6 18 6s0-2.6-.4-4.1z" fill="#ff0000"/><polygon points="7.2,8.6 11.9,6 7.2,3.4" fill="white"/></svg>
          Play
        </a>
        <div class="snooze-wrap">
          <button class="btn-ic" onclick="toggleSnooze('${esc(a.id)}')" title="Snooze">⏱</button>
          <div class="snooze-pop" id="snooze-${esc(a.id)}">
            <button class="snooze-opt" onclick="snooze('${esc(a.id)}',3)">3 days</button>
            <button class="snooze-opt" onclick="snooze('${esc(a.id)}',7)">1 week</button>
            <button class="snooze-opt" onclick="snooze('${esc(a.id)}',14)">2 weeks</button>
          </div>
        </div>
        <button class="btn-ic" onclick="silence('${esc(a.id)}')" title="Dismiss">✕</button>
      </div>
    </div>`;
  }).join('');
}

function toggleSnooze(id) {
  document.querySelectorAll('.snooze-pop').forEach(p => {
    if (p.id !== 'snooze-' + id) p.classList.remove('open');
  });
  document.getElementById('snooze-' + id)?.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.snooze-wrap'))
    document.querySelectorAll('.snooze-pop.open').forEach(p => p.classList.remove('open'));
});

async function snooze(id, days) {
  document.getElementById('snooze-' + id)?.classList.remove('open');
  const r = await fetch(`/api/albums/${id}/snooze`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({days})
  });
  if (!r.ok) { toast('Failed to snooze', 'err'); return; }
  const a = albums.find(x => x.id === id);
  if (a) a.snoozedDaysLeft = days;
  renderAlbums();
  toast(`⏱ Snoozed ${days} days`, 'ok');
}

async function silence(id) {
  const album = albums.find(a => a.id === id);
  const label = album ? `"${album.title}"` : 'this album';
  if (!confirm(`Stop reminders for ${label}? This cannot be undone.`)) return;
  document.getElementById('card-' + id)?.classList.add('removing');
  await fetch(`/api/albums/${id}/silence`, {method:'POST'});
  setTimeout(() => { albums = albums.filter(a => a.id !== id); renderAlbums(); toast('✕ Reminder stopped', 'ok'); }, 250);
}

let pollTimer = null;
async function startAuth() {
  const btn = document.getElementById('btn-start-auth');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Starting…';
  try {
    const r = await fetch('/api/auth/start', {method:'POST'});
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    document.getElementById('user-code').textContent = d.userCode;
    document.getElementById('expiry-min').textContent = Math.round(d.expiresIn / 60);
    document.getElementById('auth-step1').style.display = 'none';
    document.getElementById('auth-step2').style.display = 'block';
    pollAuth(d.interval || 5);
  } catch(e) { btn.disabled = false; btn.innerHTML = 'Get login code'; toast(e.message, 'err'); }
}
function pollAuth(interval) {
  let dots = 0;
  const dotsEl = document.getElementById('poll-dots');
  pollTimer = setInterval(async () => {
    dots = (dots + 1) % 4;
    if (dotsEl) dotsEl.textContent = '.'.repeat(dots + 1);
    try {
      const r = await fetch('/api/auth/poll', {method:'POST'});
      const d = await r.json();
      if (d.status === 'approved') { clearInterval(pollTimer); toast('✓ Connected!', 'ok'); setTimeout(() => location.reload(), 800); }
      else if (d.status === 'expired') {
        clearInterval(pollTimer); toast('Code expired — try again', 'err');
        document.getElementById('auth-step1').style.display = 'block';
        document.getElementById('auth-step2').style.display = 'none';
        const btn = document.getElementById('btn-start-auth');
        btn.disabled = false; btn.innerHTML = 'Get login code';
      }
    } catch {}
  }, interval * 1000);
}

function renderSettings() {
  const rows = document.getElementById('reminder-rows');
  rows.innerHTML = (settings.reminderDays || [3, 7, 30]).map((d, i) => `
    <div class="srow">
      <div class="srow-label">
        <div class="srow-name">Reminder ${i+1}</div>
        <div class="srow-desc">days after saving to library</div>
      </div>
      <input type="number" min="1" max="365" value="${d}" id="rd-${i}" oninput="syncReminderDays()">
      <button class="btn-del" onclick="removeReminder(${i})">×</button>
    </div>`).join('');

  const typeDescs = {Album:'Full-length albums', EP:'Extended plays', Single:'Single tracks'};
  const allowed = settings.allowedTypes || ['Album'];
  document.getElementById('type-checkboxes').innerHTML = ['Album','EP','Single'].map(t => `
    <label class="srow" style="cursor:pointer;user-select:none">
      <div class="srow-label">
        <div class="srow-name">${t}</div>
        <div class="srow-desc">${typeDescs[t]}</div>
      </div>
      <input type="checkbox" id="type-${t}" ${allowed.includes(t)?'checked':''}>
    </label>`).join('');

  const notifyOptions = [
    { label: 'Morning',   time: '8:00 AM',  utcHour: 7  },
    { label: 'Afternoon', time: '2:00 PM',  utcHour: 13 },
    { label: 'Evening',   time: '7:00 PM',  utcHour: 18 },
  ];
  const currentHour = settings.notifyHour ?? 19;
  document.getElementById('notify-time-group').innerHTML = notifyOptions.map(o => `
    <label class="srow" style="cursor:pointer;user-select:none">
      <div class="srow-label">
        <div class="srow-name">${o.label}</div>
        <div class="srow-desc">${o.time} your local time</div>
      </div>
      <input type="radio" name="notifyHour" value="${o.utcHour}" ${currentHour === o.utcHour ? 'checked' : ''}>
    </label>`).join('');
}

function syncReminderDays() {
  settings.reminderDays = [...document.querySelectorAll('[id^="rd-"]')]
    .map(i => parseInt(i.value)).filter(n => n > 0);
}
function addReminderRow() { settings.reminderDays = [...(settings.reminderDays || []), 14]; renderSettings(); }
function removeReminder(i) {
  if ((settings.reminderDays || []).length <= 1) { toast('Need at least one reminder', 'err'); return; }
  settings.reminderDays.splice(i, 1); renderSettings();
}

async function saveSettings() {
  syncReminderDays();
  const days = (settings.reminderDays || []).filter(d => d > 0);
  if (!days.length) { toast('Add at least one reminder day', 'err'); return; }
  const allowedTypes = ['Album','EP','Single'].filter(t => document.getElementById(`type-${t}`)?.checked);
  if (!allowedTypes.length) { toast('Select at least one type', 'err'); return; }
  const notifyHour = parseInt(document.querySelector('input[name="notifyHour"]:checked')?.value ?? '19');
  try {
    const r = await fetch('/api/settings', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ reminderDays: days, allowedTypes, notifyHour })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    settings = d.settings;
    toast('✓ Settings saved', 'ok');
  } catch(e) { toast(e.message, 'err'); }
}

async function disconnect() {
  if (!confirm('Disconnect YouTube Music account?')) return;
  await fetch('/api/auth', {method:'DELETE'});
  location.reload();
}

function checkPrompts() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !standalone) {
    document.getElementById('notice-add-text').textContent = 'Tap Share → "Add to Home Screen" to enable push notifications';
    document.getElementById('notice-add').style.display = 'flex';
    return;
  }
  if ('Notification' in window && Notification.permission === 'default' && vapidKey)
    document.getElementById('notice-push').style.display = 'flex';
  if (deferredInstall) {
    document.getElementById('notice-add-btn').style.display = 'block';
    document.getElementById('notice-add').style.display = 'flex';
  }
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  document.getElementById('notice-add-btn').style.display = 'block';
  document.getElementById('notice-add').style.display = 'flex';
});

async function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const {outcome} = await deferredInstall.userChoice;
  if (outcome === 'accepted') { document.getElementById('notice-add').style.display = 'none'; deferredInstall = null; }
}

async function enablePush() {
  if (!vapidKey) { toast('Push not configured', 'err'); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permission denied', 'err'); return; }
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(vapidKey) });
    const j = sub.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({endpoint: j.endpoint, keys: j.keys})
    });
    document.getElementById('notice-push').style.display = 'none';
    toast('🔔 Notifications enabled!', 'ok');
  } catch(e) { toast(e.message, 'err'); }
}

function urlB64(s) {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

async function manualSync() {
  const btn = document.getElementById('hdr-sync-btn');
  if (btn.classList.contains('syncing')) return;
  btn.classList.add('syncing');
  try {
    await fetch('/api/cron/run', { method: 'POST' });
    await loadAlbums();
    const now = new Date();
    document.getElementById('hdr-sync-time').textContent =
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    toast('✓ Synced', 'ok');
  } catch(e) {
    toast('Sync failed', 'err');
  } finally {
    btn.classList.remove('syncing');
  }
}

init();