// ================================================================
// TASKS.JS — task system with due dates, recurring, assignment,
//            tile-level lists, full garden view, task comments
// ================================================================

let tasksData        = {};
let tasksUnsubscribe = null;
let editingTaskId    = null;
let taskPriority     = 'none';
let taskStatus       = 'todo';
let taskLinkedTiles  = [];
let taskRecurring    = 'none';

// ── Init / cleanup ────────────────────────────────────────────────
function initTasks(gardenId) {
  tasksData = {};
  if (tasksUnsubscribe) tasksUnsubscribe();

  tasksUnsubscribe = db.collection('gardens').doc(gardenId)
    .collection('tasks')
    .onSnapshot(snap => {
      tasksData = {};
      snap.forEach(doc => { tasksData[doc.id] = { id: doc.id, ...doc.data() }; });
      renderGrid(); // re-render tiles with updated priority colors
      if (document.getElementById('tasks-view-overlay').classList.contains('open'))
        renderTasksView();
      if (activeId) refreshTileTasksList(activeId);
      checkRecurringTasks();
    });
}

function cleanupTasks() {
  if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
  tasksData = {};
}

// ── Full garden tasks view ────────────────────────────────────────
let tasksFilter = 'all';

document.getElementById('gardenTasksBtn').onclick = () => {
  tasksFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === 'all'));
  openTasksView();
};
document.getElementById('tasksViewBackBtn').onclick = () =>
  document.getElementById('tasks-view-overlay').classList.remove('open');
document.getElementById('tasksViewAddBtn').onclick = () => openTaskModal(null, null);

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tasksFilter = btn.dataset.filter;
    renderTasksView();
  };
});

function openTasksView() {
  document.getElementById('tasksViewTitle').textContent =
    (currentGardenData?.name || 'Garden') + ' — Tasks';
  document.getElementById('tasks-view-overlay').classList.add('open');
  renderTasksView();
}

function renderTasksView() {
  const list  = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');
  list.innerHTML = '';

  let tasks = Object.values(tasksData);

  // Filter
  if (tasksFilter === 'todo')       tasks = tasks.filter(t => t.status === 'todo');
  else if (tasksFilter === 'inprogress') tasks = tasks.filter(t => t.status === 'inprogress');
  else if (tasksFilter === 'done')  tasks = tasks.filter(t => t.status === 'done');
  else if (['urgent','high','medium','low'].includes(tasksFilter))
    tasks = tasks.filter(t => t.priority === tasksFilter);

  // Sort: priority then due date then createdAt
  tasks.sort((a, b) => {
    const pi = PRIORITY_ORDER.indexOf(a.priority||'none');
    const qi = PRIORITY_ORDER.indexOf(b.priority||'none');
    if (pi !== qi) return pi - qi;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  if (tasks.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tasks.forEach(task => list.appendChild(buildTaskCard(task, false)));
}

// ── Tile-level task list ──────────────────────────────────────────
function refreshTileTasksList(tileId) {
  const desktop = document.getElementById('tileTasksList');
  const mobile  = document.getElementById('mTileTasksList');

  const tasks = Object.values(tasksData)
    .filter(t => (t.linkedTiles || []).includes(tileId))
    .sort((a, b) =>
      PRIORITY_ORDER.indexOf(a.priority||'none') - PRIORITY_ORDER.indexOf(b.priority||'none'));

  const html = tasks.length === 0
    ? '<p style="color:#888;font-size:0.85rem;margin-top:0.5rem">No tasks for this plot yet.</p>'
    : '';

  if (desktop) {
    desktop.innerHTML = html;
    tasks.forEach(t => desktop.appendChild(buildTaskCard(t, true)));
  }
  if (mobile) {
    mobile.innerHTML = html;
    tasks.forEach(t => mobile.appendChild(buildTaskCard(t, true)));
  }
}

// ── Build task card ───────────────────────────────────────────────
function buildTaskCard(task, compact) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.status === 'done' ? ' task-done' : '');

  const pColor = PRIORITY_COLORS[task.priority || 'none'];
  if (pColor) card.style.borderLeftColor = pColor;

  // Due date badge
  let dueBadge = '';
  if (task.dueDate) {
    const due     = new Date(task.dueDate + 'T00:00:00');
    const today   = new Date(); today.setHours(0,0,0,0);
    const overdue = due < today && task.status !== 'done';
    dueBadge = `<span class="task-due-badge${overdue?' overdue':''}">
      ${overdue ? '⚠ ' : '📅 '}${task.dueDate}
    </span>`;
  }

  // Recurring badge
  const recurBadge = task.recurring && task.recurring !== 'none'
    ? `<span class="task-status-badge">🔁 ${task.recurring}</span>` : '';

  // Linked tiles chips (only in full view)
  const linkedHtml = (!compact && (task.linkedTiles||[]).length)
    ? `<div class="task-linked-tiles">${(task.linkedTiles||[]).map(tid => {
        const d = tilesData[tid];
        return d?.title ? `<span class="task-tile-chip">${escHtml(d.title)}</span>` : '';
      }).join('')}</div>`
    : '';

  // Assignee
  const assigneeHtml = task.assignedTo
    ? `<div class="task-assignee">👤 ${escHtml(task.assignedTo)}</div>` : '';

  card.innerHTML = `
    <div class="task-card-header">
      <label class="task-check-wrap">
        <input type="checkbox" class="task-check" ${task.status === 'done' ? 'checked' : ''} />
        <span class="task-title">${escHtml(task.title || 'Untitled')}</span>
      </label>
      <div class="task-card-right">
        ${task.priority && task.priority !== 'none'
          ? `<span class="task-priority-badge" style="background:${pColor}">${PRIORITY_LABELS[task.priority]}</span>`
          : ''}
        ${!compact ? `<span class="task-status-badge">${STATUS_LABELS[task.status||'todo']}</span>` : ''}
        ${dueBadge}
        ${recurBadge}
        ${canEditTasks() ? `<button class="task-edit-btn">✏</button>` : ''}
      </div>
    </div>
    ${task.description && !compact ? `<p class="task-desc">${escHtml(task.description)}</p>` : ''}
    ${assigneeHtml}
    ${linkedHtml}
  `;

  // Checkbox toggle
  const check = card.querySelector('.task-check');
  if (check) {
    if (!canEditTasks()) check.disabled = true;
    check.onchange = async e => {
      const newStatus = e.target.checked ? 'done' : 'todo';
      await db.collection('gardens').doc(currentGardenId)
        .collection('tasks').doc(task.id)
        .update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    };
  }

  // Edit btn
  const editBtn = card.querySelector('.task-edit-btn');
  if (editBtn) editBtn.onclick = () => openTaskModal(task.id, compact ? activeId : null);

  return card;
}

// ── Task modal ────────────────────────────────────────────────────
const taskModalOverlay = document.getElementById('task-modal-overlay');

document.getElementById('taskModalCloseBtn').onclick = () =>
  taskModalOverlay.classList.remove('open');
taskModalOverlay.addEventListener('click', e => {
  if (e.target === taskModalOverlay) taskModalOverlay.classList.remove('open');
});

// Add task buttons
document.getElementById('addTaskBtn').onclick  = () => openTaskModal(null, activeId);

function openTaskModal(taskId, defaultTileId) {
  if (!canEditTasks()) return;
  editingTaskId   = taskId;
  const task      = taskId ? tasksData[taskId] : null;

  document.getElementById('taskModalTitle').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('taskTitleInput').value       = task?.title || '';
  document.getElementById('taskDescInput').value        = task?.description || '';
  document.getElementById('taskDueInput').value         = task?.dueDate || '';
  document.getElementById('recurringDays').style.display = 'none';

  taskPriority    = task?.priority || 'none';
  taskStatus      = task?.status   || 'todo';
  taskLinkedTiles = [...(task?.linkedTiles || [])];
  taskRecurring   = task?.recurring || 'none';

  if (!taskId && defaultTileId && !taskLinkedTiles.includes(defaultTileId))
    taskLinkedTiles.push(defaultTileId);

  // Sync pickers
  document.querySelectorAll('.priority-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.val === taskPriority));
  document.querySelectorAll('.status-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.val === taskStatus));

  // Recurring
  const recSel = document.getElementById('recurringSelect');
  recSel.value = taskRecurring;
  document.getElementById('recurringDays').style.display =
    taskRecurring === 'custom' ? 'inline-block' : 'none';
  if (task?.recurringDays)
    document.getElementById('recurringDays').value = task.recurringDays;

  // Populate assign dropdown with collaborators + owner
  populateAssignDropdown(task?.assignedTo || '');

  // Tile picker
  buildTilePicker();

  // Comments section
  const commSection = document.getElementById('taskCommentsSection');
  commSection.style.display = taskId ? 'block' : 'none';
  if (taskId) loadTaskComments(taskId);

  document.getElementById('deleteTaskBtn').style.display = taskId ? 'inline-block' : 'none';
  taskModalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitleInput').focus(), 200);
}

function populateAssignDropdown(selected) {
  const sel = document.getElementById('taskAssignSelect');
  sel.innerHTML = '<option value="">Unassigned</option>';
  if (!currentGardenData) return;

  // Owner
  const ownerOpt = document.createElement('option');
  ownerOpt.value = currentGardenData.ownerEmail || '';
  ownerOpt.textContent = (currentGardenData.ownerName || 'Owner') + ' (owner)';
  if (selected === ownerOpt.value) ownerOpt.selected = true;
  sel.appendChild(ownerOpt);

  // Collaborators
  (currentGardenData.collaboratorEmails || []).forEach(email => {
    const opt = document.createElement('option');
    opt.value = email;
    opt.textContent = email;
    if (selected === email) opt.selected = true;
    sel.appendChild(opt);
  });
}

// Priority / status pickers
document.querySelectorAll('.priority-btn').forEach(btn => {
  btn.onclick = () => {
    taskPriority = btn.dataset.val;
    document.querySelectorAll('.priority-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.val === taskPriority));
  };
});
document.querySelectorAll('.status-btn').forEach(btn => {
  btn.onclick = () => {
    taskStatus = btn.dataset.val;
    document.querySelectorAll('.status-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.val === taskStatus));
  };
});

// Recurring select
document.getElementById('recurringSelect').onchange = function() {
  taskRecurring = this.value;
  document.getElementById('recurringDays').style.display =
    this.value === 'custom' ? 'inline-block' : 'none';
};

function buildTilePicker() {
  const picker = document.getElementById('taskTilePicker');
  picker.innerHTML = '';
  if (!currentGardenData) return;

  const rows = currentGardenData.rows || 6;
  const cols = currentGardenData.cols || 6;
  const named = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = `r${r}c${c}`, d = tilesData[id] || {};
    if (d.title) named.push({ id, title: d.title });
  }

  if (named.length === 0) {
    picker.innerHTML = '<p style="color:#888;font-size:0.82rem">No named plots yet.</p>';
    return;
  }

  named.forEach(({ id, title }) => {
    const chip = document.createElement('button');
    chip.className = 'tile-pick-chip' + (taskLinkedTiles.includes(id) ? ' selected' : '');
    chip.textContent = title;
    chip.onclick = () => {
      taskLinkedTiles = taskLinkedTiles.includes(id)
        ? taskLinkedTiles.filter(t => t !== id)
        : [...taskLinkedTiles, id];
      chip.classList.toggle('selected', taskLinkedTiles.includes(id));
    };
    picker.appendChild(chip);
  });
}

// ── Save task ─────────────────────────────────────────────────────
document.getElementById('saveTaskBtn').onclick = async () => {
  const title = document.getElementById('taskTitleInput').value.trim();
  if (!title) { document.getElementById('taskTitleInput').focus(); return; }

  const recurringDaysVal = document.getElementById('recurringDays').value;
  const payload = {
    title,
    description:  document.getElementById('taskDescInput').value.trim(),
    priority:     taskPriority,
    status:       taskStatus,
    dueDate:      document.getElementById('taskDueInput').value || null,
    recurring:    document.getElementById('recurringSelect').value,
    recurringDays: recurringDaysVal ? +recurringDaysVal : null,
    assignedTo:   document.getElementById('taskAssignSelect').value || null,
    linkedTiles:  taskLinkedTiles,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  const ref = db.collection('gardens').doc(currentGardenId).collection('tasks');
  if (editingTaskId) {
    await ref.doc(editingTaskId).update(payload);
    showToast('Task updated!');
  } else {
    await ref.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Task added!');
  }
  taskModalOverlay.classList.remove('open');
};

// ── Delete task ───────────────────────────────────────────────────
document.getElementById('deleteTaskBtn').onclick = async () => {
  if (!editingTaskId || !confirm('Delete this task?')) return;
  await db.collection('gardens').doc(currentGardenId)
    .collection('tasks').doc(editingTaskId).delete();
  taskModalOverlay.classList.remove('open');
  showToast('Task deleted');
};

// ── Task comments ─────────────────────────────────────────────────
async function loadTaskComments(taskId) {
  const list = document.getElementById('taskCommentsList');
  list.innerHTML = '';

  const snap = await db.collection('gardens').doc(currentGardenId)
    .collection('tasks').doc(taskId)
    .collection('comments')
    .orderBy('createdAt', 'asc').get();

  if (snap.empty) {
    list.innerHTML = '<p style="color:#888;font-size:0.82rem">No comments yet.</p>';
    return;
  }

  snap.forEach(doc => {
    const c = doc.data();
    const isOwn = currentUser && c.authorId === currentUser.uid;
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-avatar">
        ${c.authorPhoto
          ? `<img src="${escHtml(c.authorPhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
          : escHtml((c.authorName||'?')[0].toUpperCase())}
      </div>
      <div class="comment-body">
        <div class="comment-author">${escHtml(c.authorName||'Unknown')}</div>
        <div class="comment-text">${escHtml(c.text)}</div>
        <div class="comment-meta">
          <span class="comment-time">${c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : ''}</span>
          ${isOwn ? `<button class="comment-delete-btn" data-id="${doc.id}">🗑</button>` : ''}
        </div>
      </div>
    `;
    const delBtn = item.querySelector('.comment-delete-btn');
    if (delBtn) delBtn.onclick = async () => {
      await db.collection('gardens').doc(currentGardenId)
        .collection('tasks').doc(taskId)
        .collection('comments').doc(doc.id).delete();
      loadTaskComments(taskId);
    };
    list.appendChild(item);
  });
}

document.getElementById('taskCommentSubmit').onclick = async () => {
  if (!editingTaskId) return;
  const input = document.getElementById('taskCommentInput');
  const text  = input.value.trim();
  if (!text) return;

  await db.collection('gardens').doc(currentGardenId)
    .collection('tasks').doc(editingTaskId)
    .collection('comments').add({
      text,
      authorId:    currentUser.uid,
      authorName:  currentUser.displayName || currentUser.email,
      authorPhoto: currentUser.photoURL || '',
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });

  input.value = '';
  loadTaskComments(editingTaskId);
};
document.getElementById('taskCommentInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('taskCommentSubmit').click();
});

// ── Recurring task checker ────────────────────────────────────────
// When a recurring task is done and its due date has passed,
// uncheck it and advance the due date
async function checkRecurringTasks() {
  if (!currentGardenId) return;
  const today = new Date(); today.setHours(0,0,0,0);

  for (const task of Object.values(tasksData)) {
    if (!task.recurring || task.recurring === 'none') continue;
    if (task.status !== 'done') continue;
    if (!task.dueDate) continue;

    const due = new Date(task.dueDate + 'T00:00:00');
    if (due > today) continue; // Not time yet

    // Advance due date
    let nextDue = new Date(due);
    if (task.recurring === 'daily')  nextDue.setDate(nextDue.getDate() + 1);
    else if (task.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
    else if (task.recurring === 'custom' && task.recurringDays)
      nextDue.setDate(nextDue.getDate() + task.recurringDays);

    const nextStr = nextDue.toISOString().split('T')[0];

    await db.collection('gardens').doc(currentGardenId)
      .collection('tasks').doc(task.id)
      .update({
        status:  'todo',
        dueDate: nextStr,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }
}
