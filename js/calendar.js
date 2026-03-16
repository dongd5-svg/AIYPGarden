// ================================================================
// CALENDAR.JS — garden calendar view + consolidated calendar page
// ================================================================

// ── Per-garden calendar (inside garden view) ──────────────────────
// The garden calendar lives in tasks view — we render a month grid
// with tasks on their due dates.

function initGardenCalendar(gardenId, gardenData) {
  // Calendar is rendered on demand inside tasks view
  // Nothing to subscribe to here — tasks are already live via tasksUnsubscribe
}

// ── Consolidated calendar (main Calendar tab) ─────────────────────
let consolidatedCalYear  = new Date().getFullYear();
let consolidatedCalMonth = new Date().getMonth(); // 0-indexed
let consolidatedTasksAll = {}; // gardenId -> { gardenName, tasks[] }
let consolidatedUnsubs   = [];

function initConsolidatedCalendar() {
  // Clean up old listeners
  consolidatedUnsubs.forEach(u => u());
  consolidatedUnsubs = [];
  consolidatedTasksAll = {};

  const container = document.getElementById('consolidated-calendar');
  container.innerHTML = '<p style="color:#888;padding:2rem;text-align:center">Loading your gardens…</p>';

  // Load all owned + collab gardens
  db.collection('gardens')
    .where('ownerId', '==', currentUser.uid)
    .get()
    .then(snap => {
      snap.forEach(doc => subscribeGardenTasks(doc.id, doc.data().name || 'Garden'));
    });

  db.collection('gardens')
    .where('collaboratorEmails', 'array-contains', currentUser.email)
    .get()
    .then(snap => {
      snap.forEach(doc => subscribeGardenTasks(doc.id, doc.data().name || 'Garden'));
    })
    .catch(() => {});
}

function subscribeGardenTasks(gardenId, gardenName) {
  const unsub = db.collection('gardens').doc(gardenId)
    .collection('tasks')
    .onSnapshot(snap => {
      const tasks = [];
      snap.forEach(doc => tasks.push({ id: doc.id, gardenId, gardenName, ...doc.data() }));
      consolidatedTasksAll[gardenId] = { gardenName, tasks };
      renderConsolidatedCalendar();
    });
  consolidatedUnsubs.push(unsub);
}

function renderConsolidatedCalendar() {
  const container = document.getElementById('consolidated-calendar');
  container.innerHTML = '';

  // Month navigation
  const nav = document.createElement('div');
  nav.className = 'cal-nav';
  nav.innerHTML = `
    <button class="cal-nav-btn" id="calPrevBtn">‹</button>
    <span class="cal-nav-title">${getMonthName(consolidatedCalMonth)} ${consolidatedCalYear}</span>
    <button class="cal-nav-btn" id="calNextBtn">›</button>
  `;
  container.appendChild(nav);

  document.getElementById('calPrevBtn').onclick = () => {
    consolidatedCalMonth--;
    if (consolidatedCalMonth < 0) { consolidatedCalMonth = 11; consolidatedCalYear--; }
    renderConsolidatedCalendar();
  };
  document.getElementById('calNextBtn').onclick = () => {
    consolidatedCalMonth++;
    if (consolidatedCalMonth > 11) { consolidatedCalMonth = 0; consolidatedCalYear++; }
    renderConsolidatedCalendar();
  };

  // Gather all tasks for this month
  const allTasks = [];
  Object.values(consolidatedTasksAll).forEach(({ tasks }) => {
    tasks.forEach(t => { if (t.dueDate) allTasks.push(t); });
  });

  container.appendChild(buildCalendarMonth(
    consolidatedCalYear,
    consolidatedCalMonth,
    allTasks,
    true // showGardenLabel
  ));

  // Legend
  if (Object.keys(consolidatedTasksAll).length > 1) {
    const legend = document.createElement('div');
    legend.className = 'cal-legend';
    legend.innerHTML = '<h3 class="cal-legend-title">Gardens</h3>';
    Object.values(consolidatedTasksAll).forEach(({ gardenName, tasks }) => {
      const total  = tasks.filter(t => t.dueDate).length;
      const done   = tasks.filter(t => t.dueDate && t.status === 'done').length;
      const item   = document.createElement('div');
      item.className = 'cal-legend-item';
      item.innerHTML = `
        <span>🌱 ${escHtml(gardenName)}</span>
        <span class="cal-legend-count">${done}/${total} tasks</span>
      `;
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }
}

// ── Build a calendar month grid ───────────────────────────────────
function buildCalendarMonth(year, month, tasks, showGardenLabel) {
  const wrap = document.createElement('div');
  wrap.className = 'calendar-month';

  // Day headers
  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // Task lookup by date string
  const tasksByDate = {};
  tasks.forEach(t => {
    if (!t.dueDate) return;
    if (!tasksByDate[t.dueDate]) tasksByDate[t.dueDate] = [];
    tasksByDate[t.dueDate].push(t);
  });

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';

    let dayNum, dateObj, isOther = false;
    if (i < firstDay) {
      dayNum = daysInPrev - firstDay + i + 1;
      dateObj = new Date(year, month - 1, dayNum);
      isOther = true;
    } else if (i >= firstDay + daysInMonth) {
      dayNum = i - firstDay - daysInMonth + 1;
      dateObj = new Date(year, month + 1, dayNum);
      isOther = true;
    } else {
      dayNum = i - firstDay + 1;
      dateObj = new Date(year, month, dayNum);
    }

    if (isOther) cell.classList.add('other-month');
    if (dateObj.getTime() === today.getTime()) cell.classList.add('today');

    const numEl = document.createElement('div');
    numEl.className = 'cal-day-num';
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    // Tasks on this day
    const dateStr = dateObj.toISOString().split('T')[0];
    const dayTasks = tasksByDate[dateStr] || [];
    dayTasks.slice(0, 3).forEach(t => {
      const ev = document.createElement('div');
      ev.className = `cal-event priority-${t.priority||'none'}${t.status==='done'?' done':''}`;
      const label = showGardenLabel && t.gardenName
        ? `[${t.gardenName}] ${t.title||'Task'}`
        : (t.title || 'Task');
      ev.textContent = label;
      ev.title = label;
      ev.onclick = () => {
        // If it's a task in the current garden, open the task modal
        if (t.gardenId === currentGardenId) openTaskModal(t.id, null);
      };
      cell.appendChild(ev);
    });
    if (dayTasks.length > 3) {
      const more = document.createElement('div');
      more.className = 'cal-event priority-none';
      more.textContent = `+${dayTasks.length - 3} more`;
      cell.appendChild(more);
    }

    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}

// ── In-garden calendar tab (called from tasks view) ───────────────
function renderGardenCalendar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const tasks = Object.values(tasksData).filter(t => t.dueDate);
  const now = new Date();

  // Show current month and next month
  for (let offset = 0; offset < 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const title = document.createElement('div');
    title.className = 'calendar-month-title';
    title.textContent = `${getMonthName(d.getMonth())} ${d.getFullYear()}`;
    container.appendChild(title);
    container.appendChild(buildCalendarMonth(d.getFullYear(), d.getMonth(), tasks, false));
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function getMonthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month];
}
