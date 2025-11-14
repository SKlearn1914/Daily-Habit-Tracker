/*
  Advanced Daily Habit Tracker
  - Calendar toggles
  - Streak calculation
  - LocalStorage persistence
  - Export / import
  - Responsive UI
*/

// local storage key
const STORAGE_KEY = 'habit_tracker_v1';

// DOM refs
const habitListEl = document.getElementById('habitList');
const habitCountEl = document.getElementById('habitCount');
const addHabitBtn = document.getElementById('addHabitBtn');
const newHabitName = document.getElementById('newHabitName');
const selectedHabitName = document.getElementById('selectedHabitName');
const selectedMeta = document.getElementById('selectedMeta');
const monthLabel = document.getElementById('monthLabel');
const calendarEl = document.getElementById('calendar');
const monthPicker = document.getElementById('monthPicker');
const yearPicker = document.getElementById('yearPicker');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const monthPct = document.getElementById('monthPct');
const currentStreakEl = document.getElementById('currentStreak');
const bestStreakEl = document.getElementById('bestStreak');
const totalCompletionsEl = document.getElementById('totalCompletions');
const todayMark = document.getElementById('todayMark');
const clearMonthBtn = document.getElementById('clearMonth');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const clearBtn = document.getElementById('clearBtn');
const sparkCanvas = document.getElementById('spark');

// presets
const PRESET_HABITS = [
  'Drink Water',
  'Study Hours',
  'Gym',
  'Sleep Time'
];

// state
let state = {
  habits: [], // { id, name, days: { 'YYYY-MM-DD': true }, createdAt }
  selectedId: null,
  viewYear: (new Date()).getFullYear(),
  viewMonth: (new Date()).getMonth() // 0-indexed
};

// utilities
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function fmtDate(d) { // Date -> YYYY-MM-DD
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function startOfMonth(year, month) { return new Date(year, month, 1); }
function endOfMonth(year, month) { return new Date(year, month + 1, 0); }
function daysInMonth(y, m) { return endOfMonth(y, m).getDate(); }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function getTodayStr() { return fmtDate(new Date()); }

// persistence
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
    // compatibility: if no habits, seed presets
    if (!state.habits || !Array.isArray(state.habits) || state.habits.length === 0) {
      state.habits = PRESET_HABITS.map(name => ({ id: uid(), name, days: {}, createdAt: Date.now() }));
      state.selectedId = state.habits[0].id;
    }
  } catch (e) {
    console.warn('load failed', e);
    state = { habits: PRESET_HABITS.map(name => ({ id: uid(), name, days: {}, createdAt: Date.now() })), selectedId: null, viewYear: (new Date()).getFullYear(), viewMonth: (new Date()).getMonth() };
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// rendering
function renderHabitList() {
  habitListEl.innerHTML = '';
  const habits = state.habits;
  habitCountEl.textContent = habits.length;
  habits.forEach(h => {
    const div = document.createElement('div');
    div.className = 'habit-item';
    div.tabIndex = 0;
    div.dataset.id = h.id;
    div.innerHTML = `<div>
      <div class="habit-name">${escapeHtml(h.name)}</div>
      <div class="muted" style="font-size:12px">Created ${new Date(h.createdAt).toLocaleDateString()}</div>
    </div>
    <div class="habit-meta" aria-hidden>
      <div id="count_${h.id}">—</div>
    </div>`;
    div.onclick = () => { selectHabit(h.id); };
    div.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectHabit(h.id); } };
    habitListEl.appendChild(div);
  });
}

function renderCalendar() {
  calendarEl.innerHTML = '';
  // weekdays header
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let w of weekdays) {
    const wEl = document.createElement('div'); wEl.className = 'weekday'; wEl.textContent = w; calendarEl.appendChild(wEl);
  }

  const year = state.viewYear; const month = state.viewMonth;
  const first = startOfMonth(year, month);
  const startWeekday = first.getDay(); // 0..6
  const totalDays = daysInMonth(year, month);
  const totalCells = startWeekday + totalDays;
  const weeks = Math.ceil(totalCells / 7);

  // fill leading blanks
  for (let i = 0; i < startWeekday; i++) {
    const blank = document.createElement('div'); blank.className = 'day disabled'; calendarEl.appendChild(blank);
  }

  // render each day
  const selectedHabit = state.habits.find(h => h.id === state.selectedId);
  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = fmtDate(dateObj);
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    dayEl.tabIndex = 0;
    const isCompleted = selectedHabit && selectedHabit.days && !!selectedHabit.days[dateStr];

    if (isCompleted) dayEl.classList.add('completed');

    // Determine streak styling (if part of streak)
    if (selectedHabit) {
      const streakInfo = streaksForHabit(selectedHabit);
      // mark as streak if dateStr in streak range (best / current)
      if (streakInfo.currentRange && dateStr >= streakInfo.currentRange[0] && dateStr <= streakInfo.currentRange[1]) {
        dayEl.classList.add('streak');
      }
    }

    dayEl.innerHTML = `<div class="date">${d}</div>
      <div style="display:flex;align-items:center;width:100%"><div style="flex:1" class="small">${dateObj.toLocaleDateString(undefined, { weekday: 'short' })}</div>
      <div class="dot" style="${isCompleted ? 'background:var(--accent);' : ''}"></div></div>`;

    // clicking toggles completion
    dayEl.onclick = (e) => {
      toggleDay(selectedHabit, dateStr);
      renderAll(); // re-render everything
    };
    dayEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDay(selectedHabit, dateStr); renderAll(); } };

    calendarEl.appendChild(dayEl);
  }

  // trailing blanks to fill last week
  const filled = startWeekday + totalDays;
  const trailing = (Math.ceil(filled / 7) * 7) - filled;
  for (let i = 0; i < trailing; i++) {
    const blank = document.createElement('div'); blank.className = 'day disabled'; calendarEl.appendChild(blank);
  }

  // label
  const monthName = new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  monthLabel.textContent = monthName;
}

function renderStats() {
  const h = state.habits.find(x => x.id === state.selectedId);
  if (!h) { selectedHabitName.textContent = 'Select a habit'; selectedMeta.textContent = '—'; monthPct.textContent = '—%'; currentStreakEl.textContent = '0'; bestStreakEl.textContent = '0'; totalCompletionsEl.textContent = '0'; drawSpark([]); return; }

  selectedHabitName.textContent = h.name;
  selectedMeta.textContent = `Created ${new Date(h.createdAt).toLocaleDateString()}`;

  // month completion %
  const year = state.viewYear, month = state.viewMonth;
  const totalDays = daysInMonth(year, month);
  let completed = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (h.days && h.days[dayStr]) completed++;
  }
  const pct = Math.round((completed / totalDays) * 100);
  monthPct.textContent = `${pct}%`;

  // total completions overall
  const totalCompletions = Object.values(h.days || {}).filter(Boolean).length;
  totalCompletionsEl.textContent = totalCompletions;

  // streaks
  const st = streaksForHabit(h);
  currentStreakEl.textContent = st.current || 0;
  bestStreakEl.textContent = st.best || 0;

  // update counts in habit list
  state.habits.forEach(hb => {
    const el = document.getElementById('count_' + hb.id);
    if (el) {
      const total = Object.values(hb.days || {}).filter(Boolean).length;
      el.textContent = `${total} ✓`;
    }
  });

  // sparkline for last 30 days
  const last30 = lastNDaysData(h, 30);
  drawSpark(last30);
}

function renderAll() {
  renderHabitList();
  renderCalendar();
  renderStats();
  populatePickers();
  save();
}

// actions
function addHabit(name) {
  const h = { id: uid(), name: name.trim(), days: {}, createdAt: Date.now() };
  state.habits.unshift(h);
  state.selectedId = h.id;
  save();
  renderAll();
}
function removeHabit(id) {
  if (!confirm('Delete this habit? This cannot be undone.')) return;
  state.habits = state.habits.filter(h => h.id !== id);
  if (state.selectedId === id) state.selectedId = state.habits.length ? state.habits[0].id : null;
  save();
  renderAll();
}
function selectHabit(id) {
  state.selectedId = id;
  renderAll();
}
function toggleDay(habit, dayStr) {
  if (!habit) return alert('Select a habit first.');
  if (habit.days && habit.days[dayStr]) delete habit.days[dayStr];
  else habit.days[dayStr] = true;
  habit.updatedAt = Date.now();
  save();
}
function markToday() {
  const h = state.habits.find(h => h.id === state.selectedId);
  if (!h) { alert('Select a habit first.'); return; }
  const t = getTodayStr();
  h.days[t] = true;
  h.updatedAt = Date.now();
  save();
  renderAll();
}
function clearMonth() {
  const h = state.habits.find(h => h.id === state.selectedId);
  if (!h) { alert('Select a habit first.'); return; }
  if (!confirm('Clear all records for selected month?')) return;
  const y = state.viewYear, m = state.viewMonth;
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const dayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (h.days && h.days[dayStr]) delete h.days[dayStr];
  }
  save();
  renderAll();
}

// streak calculation
// returns { current: n, best: n, currentRange: [start,end], bestRange: [start,end] }
function streaksForHabit(h) {
  const days = Object.keys(h.days || {}).filter(Boolean).sort();
  if (days.length === 0) return { current: 0, best: 0 };

  // convert to date numbers
  const set = new Set(days);
  // best streak
  let best = 0, bestRange = null;
  for (const d of days) {
    // if previous day not in set, start a sequence
    const prev = prevDateStr(d);
    if (!set.has(prev)) {
      // count forward
      let cur = 1; let start = d; let end = d;
      let next = nextDateStr(d);
      while (set.has(next)) { cur++; end = next; next = nextDateStr(next); }
      if (cur > best) { best = cur; bestRange = [start, end]; }
    }
  }

  // current streak: look backwards from today
  const today = getTodayStr();
  let current = 0, curEnd = null, curStart = null;
  let t = today;
  while (set.has(t)) {
    current++;
    curEnd = curEnd || t;
    curStart = t;
    t = prevDateStr(t);
  }
  if (current > 0) {
    // find the actual start by walking back to first true
    let s = curStart;
    let prev = prevDateStr(s);
    while (set.has(prev)) { s = prev; prev = prevDateStr(s); }
    curStart = s;
  }

  return { current, best, currentRange: current ? [(curStart || today), (curEnd || today)] : null, bestRange };
}
function prevDateStr(s) {
  const d = parseYMD(s); d.setDate(d.getDate() - 1); return fmtDate(d);
}
function nextDateStr(s) {
  const d = parseYMD(s); d.setDate(d.getDate() + 1); return fmtDate(d);
}

// helpers for sparkline and last N days
function lastNDaysData(h, n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    arr.push(h.days && h.days[fmtDate(d)] ? 1 : 0);
  }
  return arr;
}

// draw simple sparkline on canvas
function drawSpark(data) {
  const c = sparkCanvas;
  if (!c) return;
  const ctx = c.getContext('2d');
  const w = c.width = c.clientWidth * devicePixelRatio;
  const h = c.height = c.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, w, h);
  if (!data || data.length === 0) return;

  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#5b8cff';
  ctx.beginPath();
  const pad = 6 * devicePixelRatio;
  const usableW = w - pad * 2;
  const max = 1;
  data.forEach((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * usableW;
    const y = h - pad - (v / max) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // fill points
  data.forEach((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - (v) * (h - pad * 2);
    ctx.fillStyle = v ? (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b8cff') : 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.arc(x, y, 3 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
  });
}

// UI pickers
function populatePickers() {
  // months
  monthPicker.innerHTML = '';
  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }));
  months.forEach((m, i) => {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = m; if (i === state.viewMonth) opt.selected = true; monthPicker.appendChild(opt);
  });
  // years (±3)
  yearPicker.innerHTML = '';
  const curYear = (new Date()).getFullYear();
  for (let y = curYear - 3; y <= curYear + 3; y++) {
    const opt = document.createElement('option'); opt.value = y; opt.textContent = y; if (y === state.viewYear) opt.selected = true; yearPicker.appendChild(opt);
  }
}

// export / import
function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'habits-export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function importJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && Array.isArray(imported.habits)) {
        // minimal validation: each habit must have id & name & days
        imported.habits.forEach(h => { if (!h.id) h.id = uid(); if (!h.days) h.days = {}; if (!h.createdAt) h.createdAt = Date.now(); });
        state = Object.assign({ viewYear: (new Date()).getFullYear(), viewMonth: (new Date()).getMonth() }, imported);
        save();
        renderAll();
        alert('Imported successfully');
      } else {
        alert('Invalid file format');
      }
    } catch (err) { alert('Import failed: ' + err.message); }
  };
  reader.readAsText(file);
}

// escape HTML safe
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// event bindings
addHabitBtn.addEventListener('click', () => {
  const name = newHabitName.value.trim();
  if (!name) return;
  addHabit(name);
  newHabitName.value = '';
  newHabitName.focus();
});

newHabitName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addHabitBtn.click(); } });

todayMark.addEventListener('click', () => { markToday(); });
clearMonthBtn.addEventListener('click', () => { clearMonth(); });
prevMonth.addEventListener('click', () => { state.viewMonth--; if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; } renderAll(); });
nextMonth.addEventListener('click', () => { state.viewMonth++; if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; } renderAll(); });
monthPicker.addEventListener('change', (e) => { state.viewMonth = Number(e.target.value); renderAll(); });
yearPicker.addEventListener('change', (e) => { state.viewYear = Number(e.target.value); renderAll(); });

exportBtn.addEventListener('click', exportJson);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (ev) => { const f = ev.target.files && ev.target.files[0]; if (f) importJson(f); importFile.value = ''; });

clearBtn.addEventListener('click', () => { if (confirm('Clear ALL habits and data?')) { state.habits = []; state.selectedId = null; save(); renderAll(); } });

// context menu / long press delete support via double-click
habitListEl.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.habit-item');
  if (!el) return;
  const id = el.dataset.id;
  if (confirm('Delete habit?')) removeHabit(id);
});

// helper: select most recent habit on first run
function ensureSelection() {
  if (!state.selectedId && state.habits.length) state.selectedId = state.habits[0].id;
}

// initialization
(function init() {
  load();
  ensureSelection();
  // populate default if none
  if (!state.habits || state.habits.length === 0) {
    PRESET_HABITS.forEach(h => addHabit(h));
  }
  renderAll();
  // ensure canvas is crisp on resize
  window.addEventListener('resize', () => drawSpark(lastNDaysData(state.habits.find(h => h.id === state.selectedId) || { days: {} }, 30)));
})();

