// ================================================================
// TILES.JS — tile rendering, editing, merge/split, photo timeline
// ================================================================

let tilesData        = {};
let tilesUnsubscribe = null;
let activeId         = null;
let currentSeason    = 'spring';
let companionMap     = {};

// ── Init / cleanup ────────────────────────────────────────────────
function initTiles(gardenId, gardenData) {
  activeId      = null;
  tilesData     = {};
  companionMap  = {};
  currentSeason = gardenData.currentSeason || 'spring';

  updateSeasonDisplay();

  // Set container size
  const rows = gardenData.rows || 6;
  const cols = gardenData.cols || 6;
  const container = document.getElementById('garden-container');
  const maxSize = Math.min(
    window.innerWidth > 900 ? window.innerHeight * 0.75 : window.innerWidth * 0.96,
    700
  );
  container.style.width  = maxSize + 'px';
  container.style.height = maxSize + 'px';
  container.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  container.style.gridTemplateRows    = `repeat(${rows},1fr)`;
  container.style.fontSize = Math.max(8, Math.min(14, (maxSize / Math.max(rows,cols)) * 0.35)) + 'px';

  resetPanel();

  if (tilesUnsubscribe) tilesUnsubscribe();

  tilesUnsubscribe = db.collection('gardens').doc(gardenId)
    .collection('tiles')
    .onSnapshot(snap => {
      tilesData = {};
      snap.forEach(doc => { tilesData[doc.id] = doc.data(); });
      renderGrid();
      // Rebuild companion map async
      if (currentGardenData?.companionPlanting !== false) {
        buildCompanionMap(tilesData, rows, cols).then(map => {
          companionMap = map;
          renderGrid(); // re-render with companion data
        });
      }
    });
}

function cleanupTiles() {
  if (tilesUnsubscribe) { tilesUnsubscribe(); tilesUnsubscribe = null; }
  activeId = null; tilesData = {}; companionMap = {};
}

// ── Season selector ───────────────────────────────────────────────
function updateSeasonDisplay() {
  document.querySelectorAll('.season-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.season === currentSeason);
  });
  const container = document.getElementById('garden-container');
  if (container) container.dataset.season = currentSeason;
}

document.querySelectorAll('.season-btn').forEach(btn => {
  btn.onclick = async () => {
    currentSeason = btn.dataset.season;
    updateSeasonDisplay();
    if (currentGardenId) {
      await db.collection('gardens').doc(currentGardenId).update({ currentSeason });
      currentGardenData.currentSeason = currentSeason;
    }
  };
});

// ── Render grid ───────────────────────────────────────────────────
function renderGrid() {
  if (!currentGardenData) return;
  const garden = document.getElementById('garden-container');
  const rows   = currentGardenData.rows || 6;
  const cols   = currentGardenData.cols || 6;
  garden.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `r${r}c${c}`;
      const d  = tilesData[id] || {};
      const div = document.createElement('div');
      div.className  = 'tile';
      div.dataset.id = id;

      // Base color
      let bg = d.color || '#e8ffd6';

      // Task priority overlay
      const taskInfo = getTilePriorityColor(id);
      if (taskInfo && !taskInfo.badge) bg = taskInfo.color;
      div.style.background = bg;

      // Companion planting indicator
      const companionStatus = currentGardenData?.companionPlanting !== false
        ? companionMap[id] : null;
      if (companionStatus === 'bad')  div.classList.add('companion-bad');
      if (companionStatus === 'good') div.classList.add('companion-good');

      // Content
      const group = d.mergeGroup;
      const label = group
        ? (isMergeLeader(id, group) ? (d.title || '') : '')
        : (d.title || '');

      if (taskInfo?.badge) {
        div.style.display = 'flex';
        div.innerHTML = `<span class="tile-label">${escHtml(label)}</span><span class="priority-exclaim">❗</span>`;
      } else {
        div.textContent = label;
      }

      if (!label && !taskInfo?.badge) div.classList.add('empty');

      applyMergeBorderClasses(div, id, r, c, rows, cols);
      if (id === activeId) div.classList.add('active');

      const canEdit = canEditTiles();
      if (canEdit) {
        div.onclick = () => handleTileClick(id);
      } else if (canEditTasks()) {
        div.onclick = () => openTasksTabForTile(id);
        div.style.cursor = 'pointer';
      } else {
        div.style.cursor = 'default';
        div.onclick = () => showReadOnlyTile(id);
      }

      garden.appendChild(div);
    }
  }

  if (mergeMode) applyMergeModeUI();
}

// ── Task priority color on tile ───────────────────────────────────
function getTilePriorityColor(tileId) {
  const mode = currentGardenData?.taskDisplayMode || 'color';
  if (mode === 'off' || !tasksData) return null;
  const active = Object.values(tasksData)
    .filter(t => (t.linkedTiles||[]).includes(tileId) && t.status !== 'done');
  if (!active.length) return null;
  active.sort((a,b) =>
    PRIORITY_ORDER.indexOf(a.priority||'none') - PRIORITY_ORDER.indexOf(b.priority||'none'));
  const top = active[0];
  if (!top.priority || top.priority === 'none') return null;
  return { color: PRIORITY_COLORS[top.priority], badge: mode === 'badge' };
}

// ── Merge helpers ─────────────────────────────────────────────────
function isMergeLeader(id, group) {
  const members = Object.keys(tilesData).filter(k => tilesData[k].mergeGroup === group);
  members.sort((a,b) => {
    const ra={r:+a.match(/r(\d+)/)[1],c:+a.match(/c(\d+)/)[1]};
    const rb={r:+b.match(/r(\d+)/)[1],c:+b.match(/c(\d+)/)[1]};
    return ra.r !== rb.r ? ra.r - rb.r : ra.c - rb.c;
  });
  return members[0] === id;
}

function applyMergeBorderClasses(div, id, r, c, rows, cols) {
  const g = (tilesData[id]||{}).mergeGroup; if (!g) return;
  if (r > 0      && (tilesData[`r${r-1}c${c}`]||{}).mergeGroup === g) div.classList.add('merge-top');
  if (r < rows-1 && (tilesData[`r${r+1}c${c}`]||{}).mergeGroup === g) div.classList.add('merge-bottom');
  if (c > 0      && (tilesData[`r${r}c${c-1}`]||{}).mergeGroup === g) div.classList.add('merge-left');
  if (c < cols-1 && (tilesData[`r${r}c${c+1}`]||{}).mergeGroup === g) div.classList.add('merge-right');
}

// ── Panel helpers ─────────────────────────────────────────────────
function resetPanel() {
  document.getElementById('editInfo').style.display    = 'none';
  document.getElementById('defaultInfo').style.display = 'block';
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
}

function showReadOnlyTile(id) {
  const d = tilesData[id] || {};
  if (!d.title) return;
  const info = document.getElementById('defaultInfo');
  info.innerHTML = `
    <h2>${escHtml(d.title)}</h2>
    ${d.description ? `<p>${escHtml(d.description)}</p>` : ''}
    ${d.imageUrl ? `<img src="${escHtml(d.imageUrl)}" style="width:100%;border-radius:0.5rem;margin-top:0.5rem"/>` : ''}
  `;
  document.getElementById('editInfo').style.display    = 'none';
  document.getElementById('defaultInfo').style.display = 'block';
}

function openTasksTabForTile(id) {
  openPanel(id);
  switchPanelTab('tasks');
}

// ── Open panel ────────────────────────────────────────────────────
function openPanel(id) {
  activeId = id;
  document.getElementById('defaultInfo').style.display = 'none';
  document.getElementById('editInfo').style.display    = 'block';

  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  const { r, c } = { r: +id.match(/r(\d+)/)[1], c: +id.match(/c(\d+)/)[1] };
  const tiles = document.querySelectorAll('.tile');
  const cols  = currentGardenData.cols || 6;
  if (tiles[r * cols + c]) tiles[r * cols + c].classList.add('active');

  const d = tilesData[id] || {};
  document.getElementById('titleInput').value  = d.title       || '';
  document.getElementById('descInput').value   = d.description || '';
  document.getElementById('imgInput').value    = d.imageUrl    || '';
  document.getElementById('colorInput').value  = d.color       || '#e8ffd6';
  document.getElementById('splitBtn').style.display = d.mergeGroup ? 'inline-block' : 'none';
  document.getElementById('tasksTileLabel').textContent  = d.title || 'This plot';
  document.getElementById('historyTileLabel').textContent = d.title || 'This plot';

  // Show plant info if title matches
  if (d.title) showPlantInfo(d.title);
  else document.getElementById('plantInfoCard').style.display = 'none';

  switchPanelTab('plot');
  refreshTileTasksList(id);
  refreshPhotoTimeline(id);
}

function handleTileClick(id) {
  if (mergeMode) toggleMergeSelection(id);
  else openPanel(id);
}

// ── Panel tabs ────────────────────────────────────────────────────
document.getElementById('tabPlot').onclick    = () => switchPanelTab('plot');
document.getElementById('tabTasks').onclick   = () => switchPanelTab('tasks');
document.getElementById('tabHistory').onclick = () => switchPanelTab('history');

function switchPanelTab(tab) {
  ['plot','tasks','history'].forEach(t => {
    document.getElementById('panelPlot')   .style.display = t === 'plot'    && tab === 'plot'    ? 'block' : 'none';
    document.getElementById('panelTasks')  .style.display = t === 'tasks'   && tab === 'tasks'   ? 'block' : 'none';
    document.getElementById('panelHistory').style.display = t === 'history' && tab === 'history' ? 'block' : 'none';
  });
  document.getElementById('panelPlot').style.display    = tab === 'plot'    ? 'block' : 'none';
  document.getElementById('panelTasks').style.display   = tab === 'tasks'   ? 'block' : 'none';
  document.getElementById('panelHistory').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('tabPlot').classList.toggle('active',    tab === 'plot');
  document.getElementById('tabTasks').classList.toggle('active',   tab === 'tasks');
  document.getElementById('tabHistory').classList.toggle('active', tab === 'history');
  if (tab === 'tasks' && activeId)   refreshTileTasksList(activeId);
  if (tab === 'history' && activeId) refreshPhotoTimeline(activeId);
}

// ── Tile ref helper ───────────────────────────────────────────────
function tilesRef() {
  return db.collection('gardens').doc(currentGardenId).collection('tiles');
}

// ── Save tile ─────────────────────────────────────────────────────
document.getElementById('saveBtn').onclick = async () => {
  if (!activeId) return;
  if (!canEditTiles()) {
    showToast('You don\'t have permission to edit this garden', 'error');
    return;
  }
  const d = tilesData[activeId] || {};
  const payload = {
    title:       document.getElementById('titleInput').value.trim(),
    description: document.getElementById('descInput').value.trim(),
    imageUrl:    document.getElementById('imgInput').value.trim(),
    color:       document.getElementById('colorInput').value,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    if (d.mergeGroup) {
      const batch = db.batch();
      Object.keys(tilesData).forEach(k => {
        if (tilesData[k].mergeGroup === d.mergeGroup)
          batch.set(tilesRef().doc(k), { ...payload, mergeGroup: d.mergeGroup });
      });
      await batch.commit();
    } else {
      await tilesRef().doc(activeId).set(payload);
    }
    db.collection('gardens').doc(currentGardenId)
      .update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    // Hook for advanced features (crop rotation auto-record)
    if (typeof onTileSaved === 'function') onTileSaved(activeId, payload.title);
    showToast('Plot saved!');
  } catch (err) {
    console.error('Tile save error:', err);
    showToast('Save failed — check your connection or permissions', 'error');
  }
};

document.getElementById('clearBtn').onclick = async () => {
  if (!activeId || !confirm('Clear this plot?')) return;
  const d = tilesData[activeId] || {};
  if (d.mergeGroup) {
    const batch = db.batch();
    Object.keys(tilesData).forEach(k => {
      if (tilesData[k].mergeGroup === d.mergeGroup) batch.delete(tilesRef().doc(k));
    });
    await batch.commit();
  } else {
    await tilesRef().doc(activeId).delete();
  }
  resetPanel();
  activeId = null;
};

document.getElementById('exitBtn').onclick = () => { resetPanel(); activeId = null; };

document.getElementById('splitBtn').onclick = async () => {
  if (!activeId) return;
  const d = tilesData[activeId] || {};
  if (!d.mergeGroup) return;
  const batch = db.batch();
  Object.keys(tilesData).forEach(k => {
    if (tilesData[k].mergeGroup === d.mergeGroup) {
      const { mergeGroup, ...rest } = tilesData[k];
      batch.set(tilesRef().doc(k), { ...rest, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
  document.getElementById('splitBtn').style.display = 'none';
};

// ── Upload btn ────────────────────────────────────────────────────
document.getElementById('tileUploadBtn').onclick       = () => uploadTileImage(false);
document.getElementById('modal-tileUploadBtn').onclick = () => uploadTileImage(true);

async function uploadTileImage(isMobile) {
  const btn     = document.getElementById(isMobile ? 'modal-tileUploadBtn' : 'tileUploadBtn');
  const labelEl = document.getElementById(isMobile ? 'modalTileUploadLabel' : 'tileUploadLabel');
  if (btn) btn.disabled = true;
  try {
    const url = await uploadImage({ path: `tiles/${currentUser.uid}`, labelEl });
    document.getElementById('imgInput').value       = url;
    document.getElementById('modal-imgInput').value = url;
    showToast('Photo uploaded!');
  } catch(e) {
    if (e.message !== 'cancelled') alert('Upload failed: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Upload helper (shared with community) ────────────────────────
function uploadImage({ path, barEl, labelEl }) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error('cancelled'));
      const ref  = storage.ref(`${path}/${Date.now()}.${file.name.split('.').pop()}`);
      const task = ref.put(file);
      if (barEl)   { barEl.parentElement.style.display = 'block'; barEl.style.width = '0%'; }
      if (labelEl) { labelEl.style.display = 'inline'; labelEl.textContent = 'Uploading…'; }
      task.on('state_changed',
        snap => {
          const p = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
          if (barEl)   barEl.style.width = p + '%';
          if (labelEl) labelEl.textContent = `${p}%`;
        },
        err => { if (barEl) barEl.parentElement.style.display='none'; if (labelEl) labelEl.style.display='none'; reject(err); },
        async () => {
          const url = await task.snapshot.ref.getDownloadURL();
          if (barEl)   barEl.parentElement.style.display = 'none';
          if (labelEl) { labelEl.textContent = '✓'; setTimeout(() => labelEl.style.display='none', 1500); }
          resolve(url);
        }
      );
    };
    input.click();
  });
}

// ── Photo timeline ────────────────────────────────────────────────
document.getElementById('addPhotoBtn').onclick  = () => openPhotoModal(activeId);
document.getElementById('mAddPhotoBtn').onclick = () => openPhotoModal(activeId);

function openPhotoModal(tileId) {
  if (!tileId) return;
  document.getElementById('photoUrlInput').value     = '';
  document.getElementById('photoDateInput').value    = toInputDate(new Date());
  document.getElementById('photoCaptionInput').value = '';
  document.getElementById('photo-modal-overlay').classList.add('open');
}

document.getElementById('photoModalCloseBtn').onclick = () =>
  document.getElementById('photo-modal-overlay').classList.remove('open');
document.getElementById('photo-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('photo-modal-overlay'))
    document.getElementById('photo-modal-overlay').classList.remove('open');
});

document.getElementById('photoUploadBtn').onclick = async () => {
  const btn = document.getElementById('photoUploadBtn');
  btn.disabled = true;
  try {
    const url = await uploadImage({ path: `tiles/${currentUser.uid}` });
    document.getElementById('photoUrlInput').value = url;
  } catch(e) {
    if (e.message !== 'cancelled') alert('Upload failed');
  } finally { btn.disabled = false; }
};

document.getElementById('savePhotoBtn').onclick = async () => {
  if (!activeId) return;
  const url     = document.getElementById('photoUrlInput').value.trim();
  const caption = document.getElementById('photoCaptionInput').value.trim();
  const dateStr = document.getElementById('photoDateInput').value;
  if (!url) return;

  await db.collection('gardens').doc(currentGardenId)
    .collection('tiles').doc(activeId)
    .collection('photos').add({
      url, caption,
      date:      dateStr,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  document.getElementById('photo-modal-overlay').classList.remove('open');
  refreshPhotoTimeline(activeId);
  showToast('Photo added!');
};

async function refreshPhotoTimeline(tileId) {
  const desktop = document.getElementById('tilePhotoTimeline');
  const mobile  = document.getElementById('mTilePhotoTimeline');
  if (!tileId || !currentGardenId) return;

  const snap = await db.collection('gardens').doc(currentGardenId)
    .collection('tiles').doc(tileId)
    .collection('photos').orderBy('date', 'desc').get();

  const html = snap.empty
    ? '<p style="color:#888;font-size:0.85rem;margin-top:0.5rem">No photos yet — add the first one!</p>'
    : snap.docs.map(doc => {
        const p = doc.data();
        return `
          <div class="photo-timeline-item">
            <img src="${escHtml(p.url)}" class="photo-timeline-img" onerror="this.style.display='none'" />
            <div class="photo-timeline-meta">
              <span class="photo-timeline-date">${escHtml(p.date || '')}</span>
              ${p.caption ? `<span class="photo-timeline-caption">${escHtml(p.caption)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

  if (desktop) desktop.innerHTML = html;
  if (mobile)  mobile.innerHTML  = html;
}

// ── Merge mode ────────────────────────────────────────────────────
let mergeMode     = false;
let mergeSelected = new Set();

const mergeModeBtn    = document.getElementById('mergeModeBtn');
const mergeToolbar    = document.getElementById('merge-toolbar');
const mergeConfirmBtn = document.getElementById('mergeConfirmBtn');
const mergeCancelBtn  = document.getElementById('mergeCancelBtn');
const mergeCountSpan  = document.getElementById('mergeCount');

mergeModeBtn.onclick = () => toggleMergeMode();

function toggleMergeMode(on) {
  mergeMode = on !== undefined ? on : !mergeMode;
  mergeSelected.clear();
  document.body.classList.toggle('merge-mode', mergeMode);
  mergeModeBtn.classList.toggle('active', mergeMode);
  mergeModeBtn.textContent = mergeMode ? '✕ Cancel' : '⊞ Merge';
  if (mergeMode) {
    resetPanel(); activeId = null;
    mergeToolbar.classList.add('visible');
    updateMergeToolbar(); applyMergeModeUI();
  } else {
    mergeToolbar.classList.remove('visible');
    document.querySelectorAll('.tile').forEach(t =>
      t.classList.remove('merge-selected','merge-eligible','merge-ineligible'));
  }
}

function getEligibleIds() {
  const rows = currentGardenData.rows||6, cols = currentGardenData.cols||6;
  let lg = null;
  mergeSelected.forEach(id => { const g=(tilesData[id]||{}).mergeGroup; if(g) lg=g; });
  const el = new Set();
  if (mergeSelected.size === 0) {
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) el.add(`r${r}c${c}`);
  } else {
    mergeSelected.forEach(id => {
      const r=+id.match(/r(\d+)/)[1], c=+id.match(/c(\d+)/)[1];
      [r>0&&`r${r-1}c${c}`,r<rows-1&&`r${r+1}c${c}`,c>0&&`r${r}c${c-1}`,c<cols-1&&`r${r}c${c+1}`]
        .filter(Boolean).forEach(n => { if (!mergeSelected.has(n)) el.add(n); });
    });
    el.forEach(id => { const g=(tilesData[id]||{}).mergeGroup; if(g&&lg&&g!==lg) el.delete(id); });
  }
  return el;
}

function applyMergeModeUI() {
  const el = getEligibleIds();
  document.querySelectorAll('.tile').forEach(div => {
    const id = div.dataset.id;
    div.classList.remove('merge-selected','merge-eligible','merge-ineligible');
    if (mergeSelected.has(id))   div.classList.add('merge-selected');
    else if (el.has(id))         div.classList.add('merge-eligible');
    else                         div.classList.add('merge-ineligible');
  });
}

function toggleMergeSelection(id) {
  if (mergeSelected.has(id)) {
    mergeSelected.delete(id);
    if (mergeSelected.size > 0 && !isMergeConnected(mergeSelected)) mergeSelected.add(id);
  } else {
    if (!getEligibleIds().has(id)) return;
    mergeSelected.add(id);
  }
  applyMergeModeUI(); updateMergeToolbar();
}

function isMergeConnected(ids) {
  if (ids.size <= 1) return true;
  const rows=currentGardenData.rows||6, cols=currentGardenData.cols||6;
  const arr=[...ids], visited=new Set(), queue=[arr[0]]; visited.add(arr[0]);
  while (queue.length) {
    const cur=queue.shift(), r=+cur.match(/r(\d+)/)[1], c=+cur.match(/c(\d+)/)[1];
    [r>0&&`r${r-1}c${c}`,r<rows-1&&`r${r+1}c${c}`,c>0&&`r${r}c${c-1}`,c<cols-1&&`r${r}c${c+1}`]
      .filter(Boolean).forEach(n => { if(ids.has(n)&&!visited.has(n)){visited.add(n);queue.push(n);} });
  }
  return visited.size === ids.size;
}

function updateMergeToolbar() {
  const n = mergeSelected.size;
  mergeCountSpan.textContent = n === 0 ? 'Tap tiles to select' : `${n} tile${n>1?'s':''} selected`;
  mergeConfirmBtn.disabled = n < 2;
}

mergeConfirmBtn.onclick = async () => {
  if (mergeSelected.size < 2) return;
  let group = null;
  mergeSelected.forEach(id => { const g=(tilesData[id]||{}).mergeGroup; if(g) group=g; });
  if (!group) group = crypto.randomUUID();
  const sorted = [...mergeSelected].sort((a,b) => {
    const ra={r:+a.match(/r(\d+)/)[1],c:+a.match(/c(\d+)/)[1]};
    const rb={r:+b.match(/r(\d+)/)[1],c:+b.match(/c(\d+)/)[1]};
    return ra.r!==rb.r?ra.r-rb.r:ra.c-rb.c;
  });
  const ld = tilesData[sorted[0]] || {};
  const batch = db.batch();
  mergeSelected.forEach(id => {
    const ex = tilesData[id] || {};
    batch.set(tilesRef().doc(id), {
      title:       ld.title||ex.title||'',
      description: ld.description||ex.description||'',
      imageUrl:    ld.imageUrl||ex.imageUrl||'',
      color:       ld.color||ex.color||'#e8ffd6',
      mergeGroup:  group,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  toggleMergeMode(false);
};
mergeCancelBtn.onclick = () => toggleMergeMode(false);

// ── Mobile modal bridge ───────────────────────────────────────────
(function() {
  const overlay  = document.getElementById('modal-overlay');
  const mTitle   = document.getElementById('modal-plotTitle');
  const mTitleIn = document.getElementById('modal-titleInput');
  const mDesc    = document.getElementById('modal-descInput');
  const mImg     = document.getElementById('modal-imgInput');
  const mColor   = document.getElementById('modal-colorInput');
  const mSplit   = document.getElementById('modal-splitBtn');

  function isMobile() { return window.innerWidth <= 900; }
  function closeModal() {
    overlay.classList.add('closing');
    setTimeout(() => overlay.classList.remove('open','closing'), 180);
  }

  const _orig = openPanel;
  window.openPanel = function(id) {
    _orig(id);
    if (!isMobile()) return;
    const d = tilesData[id] || {};
    mTitle.textContent = d.title || 'Empty Plot';
    mTitleIn.value = d.title||''; mDesc.value=d.description||'';
    mImg.value=d.imageUrl||''; mColor.value=d.color||'#e8ffd6';
    if (mSplit) mSplit.style.display = d.mergeGroup ? 'inline-block' : 'none';
    // Switch to plot tab
    ['mPanelPlot','mPanelTasks','mPanelHistory'].forEach(id =>
      document.getElementById(id).style.display = 'none');
    document.getElementById('mPanelPlot').style.display = 'block';
    ['mTabPlot','mTabTasks','mTabHistory'].forEach(id =>
      document.getElementById(id).classList.remove('active'));
    document.getElementById('mTabPlot').classList.add('active');
    overlay.classList.add('open');
  };

  document.getElementById('mTabPlot').onclick = () => {
    document.getElementById('mPanelPlot').style.display='block';
    document.getElementById('mPanelTasks').style.display='none';
    document.getElementById('mPanelHistory').style.display='none';
    document.getElementById('mTabPlot').classList.add('active');
    document.getElementById('mTabTasks').classList.remove('active');
    document.getElementById('mTabHistory').classList.remove('active');
  };
  document.getElementById('mTabTasks').onclick = () => {
    document.getElementById('mPanelPlot').style.display='none';
    document.getElementById('mPanelTasks').style.display='block';
    document.getElementById('mPanelHistory').style.display='none';
    document.getElementById('mTabPlot').classList.remove('active');
    document.getElementById('mTabTasks').classList.add('active');
    document.getElementById('mTabHistory').classList.remove('active');
    if (activeId) {
      document.getElementById('mTasksTileLabel').textContent = (tilesData[activeId]||{}).title||'This plot';
      refreshTileTasksList(activeId);
    }
  };
  document.getElementById('mTabHistory').onclick = () => {
    document.getElementById('mPanelPlot').style.display='none';
    document.getElementById('mPanelTasks').style.display='none';
    document.getElementById('mPanelHistory').style.display='block';
    document.getElementById('mTabPlot').classList.remove('active');
    document.getElementById('mTabTasks').classList.remove('active');
    document.getElementById('mTabHistory').classList.add('active');
    if (activeId) refreshPhotoTimeline(activeId);
  };
  document.getElementById('mAddTaskBtn').onclick  = () => openTaskModal(null, activeId);
  document.getElementById('mAddPhotoBtn').onclick = () => openPhotoModal(activeId);

  overlay.addEventListener('click', e => { if (e.target===overlay) closeModal(); });

  document.getElementById('modal-saveBtn').onclick = async () => {
    if (!activeId) return;
    document.getElementById('titleInput').value  = mTitleIn.value;
    document.getElementById('descInput').value   = mDesc.value;
    document.getElementById('imgInput').value    = mImg.value;
    document.getElementById('colorInput').value  = mColor.value;
    document.getElementById('saveBtn').click();
    closeModal();
  };
  document.getElementById('modal-clearBtn').onclick = () => {
    document.getElementById('clearBtn').click(); closeModal();
  };
  document.getElementById('modal-exitBtn').onclick = () => {
    document.getElementById('exitBtn').click(); closeModal();
  };
  if (mSplit) mSplit.onclick = () => {
    document.getElementById('splitBtn').click(); closeModal();
  };
})();
