// ================================================================
// AUTH
// ================================================================
const auth     = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db       = firebase.firestore();

const loginGate       = document.getElementById('loginGate');
const appShell        = document.getElementById('app');
const signOutBtn      = document.getElementById('signOutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');

document.getElementById('googleBtn').onclick = () =>
  auth.signInWithPopup(provider).catch(err => alert(err.message));

signOutBtn.onclick = () => auth.signOut();

let currentUser = null;

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    loginGate.style.display = 'none';
    appShell.style.display  = 'block';
    userNameDisplay.textContent = user.displayName || user.email;
    if (user.photoURL) document.getElementById('profileImg').src = user.photoURL;
    navigateTo('home');
    loadMyGardens();
  } else {
    loginGate.style.display = 'flex';
    appShell.style.display  = 'none';
    userNameDisplay.textContent = '';
    document.getElementById('profileImg').src = '';
  }
});

// ================================================================
// PAGE NAVIGATION
// ================================================================
let currentPage = 'home';

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  currentPage = page;

  if (page === 'public') loadPublicGardens();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    if (currentGardenId) exitGarden();
    navigateTo(btn.dataset.page);
  };
});

document.getElementById('navLogo').onclick = () => {
  if (currentGardenId) exitGarden();
  navigateTo('home');
};

// ================================================================
// HOME PAGE – MY GARDENS
// ================================================================
const gardensCol  = document.getElementById('gardens');
const emptyState  = document.getElementById('empty-state');
const myGrid      = document.getElementById('my-gardens-grid');

document.getElementById('createGardenBtn').onclick  = openCreateModal;
document.getElementById('emptyCreateBtn').onclick   = openCreateModal;

let myGardensUnsubscribe = null;

function loadMyGardens() {
  if (myGardensUnsubscribe) myGardensUnsubscribe();

  myGardensUnsubscribe = db.collection('gardens')
    .where('ownerId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      myGrid.innerHTML = '';
      if (snapshot.empty) {
        emptyState.style.display = 'block';
        return;
      }
      emptyState.style.display = 'none';
      snapshot.forEach(doc => {
        myGrid.appendChild(buildGardenCard(doc.id, doc.data(), true));
      });
    }, err => {
      // If index not ready yet, fall back to unordered query
      db.collection('gardens')
        .where('ownerId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
          myGrid.innerHTML = '';
          if (snapshot.empty) { emptyState.style.display = 'block'; return; }
          emptyState.style.display = 'none';
          snapshot.forEach(doc => myGrid.appendChild(buildGardenCard(doc.id, doc.data(), true)));
        });
    });
}

// ================================================================
// PUBLIC GARDENS
// ================================================================
const publicGrid       = document.getElementById('public-gardens-grid');
const publicEmptyState = document.getElementById('public-empty-state');

function loadPublicGardens() {
  db.collection('gardens')
    .where('visibility', '==', 'public')
    .get()
    .then(snapshot => {
      publicGrid.innerHTML = '';
      if (snapshot.empty) { publicEmptyState.style.display = 'block'; return; }
      publicEmptyState.style.display = 'none';
      snapshot.forEach(doc => {
        const data = doc.data();
        const isOwn = currentUser && data.ownerId === currentUser.uid;
        publicGrid.appendChild(buildGardenCard(doc.id, data, isOwn));
      });
    });
}

// ================================================================
// GARDEN CARD BUILDER
// ================================================================
function buildGardenCard(gardenId, data, isOwn) {
  const card = document.createElement('div');
  card.className = 'garden-card';

  const rows = data.rows || 6;
  const cols = data.cols || 6;
  const previewRows = Math.min(rows, 12);
  const previewCols = Math.min(cols, 12);

  // Mini grid preview
  const preview = document.createElement('div');
  preview.className = 'garden-card-preview';
  preview.style.gridTemplateColumns = `repeat(${previewCols}, 1fr)`;
  preview.style.gridTemplateRows    = `repeat(${previewRows}, 1fr)`;

  // Build a map of cells by tileId for quick lookup
  const cellMap = {};
  for (let r = 0; r < previewRows; r++) {
    for (let c = 0; c < previewCols; c++) {
      const cell = document.createElement('div');
      cell.className = 'mini-tile';
      cellMap[`r${r}c${c}`] = cell;
      preview.appendChild(cell);
    }
  }

  // Fetch real tile colors from Firestore
  db.collection('gardens').doc(gardenId).collection('tiles').get().then(snap => {
    snap.forEach(doc => {
      const cell = cellMap[doc.id];
      if (cell && doc.data().color) {
        cell.style.background = doc.data().color;
      }
    });
  });

  const badge = data.visibility === 'public'
    ? '<span class="garden-card-badge badge-public">🌍 Public</span>'
    : '<span class="garden-card-badge badge-private">🔒 Private</span>';

  const ownerLine = !isOwn && data.ownerName
    ? `<div class="garden-card-owner">by ${data.ownerName}</div>`
    : '';

  card.innerHTML = `
    <div class="garden-card-meta">
      ${badge}
      <span>${rows}×${cols} grid</span>
    </div>
    <h3>${escHtml(data.name || 'Unnamed Garden')}</h3>
    ${ownerLine}
  `;
  card.insertBefore(preview, card.firstChild);

  card.onclick = () => openGarden(gardenId, data, isOwn);
  return card;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ================================================================
// CREATE GARDEN MODAL
// ================================================================
const createOverlay = document.getElementById('create-modal-overlay');
const gardenNameInput = document.getElementById('gardenNameInput');
const gridRowsInput   = document.getElementById('gridRows');
const gridColsInput   = document.getElementById('gridCols');
const gridPreview     = document.getElementById('gridPreview');
const gridPreviewLabel= document.getElementById('gridPreviewLabel');

let selectedVisibility = 'private';

function openCreateModal() {
  gardenNameInput.value = '';
  gridRowsInput.value = '6';
  gridColsInput.value = '6';
  selectedVisibility = 'private';
  document.getElementById('visPrivate').classList.add('active');
  document.getElementById('visPublic').classList.remove('active');
  updateGridPreview();
  createOverlay.classList.add('open');
  setTimeout(() => gardenNameInput.focus(), 200);
}

document.getElementById('createModalCloseBtn').onclick = () =>
  createOverlay.classList.remove('open');

createOverlay.addEventListener('click', e => {
  if (e.target === createOverlay) createOverlay.classList.remove('open');
});

// Steppers
document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.onclick = () => {
    const target = document.getElementById(btn.dataset.target);
    const dir    = parseInt(btn.dataset.dir);
    const min    = parseInt(target.min) || 2;
    const max    = parseInt(target.max) || 20;
    const val    = Math.min(max, Math.max(min, parseInt(target.value) + dir));
    target.value = val;
    updateGridPreview();
  };
});

gridRowsInput.addEventListener('input', updateGridPreview);
gridColsInput.addEventListener('input', updateGridPreview);

function updateGridPreview() {
  const r = Math.min(20, Math.max(2, parseInt(gridRowsInput.value) || 6));
  const c = Math.min(20, Math.max(2, parseInt(gridColsInput.value) || 6));
  gridPreview.style.gridTemplateColumns = `repeat(${Math.min(c, 16)}, 1fr)`;
  gridPreview.style.gridTemplateRows    = `repeat(${Math.min(r, 16)}, 1fr)`;
  gridPreview.innerHTML = '';
  const count = Math.min(r, 16) * Math.min(c, 16);
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'preview-cell';
    gridPreview.appendChild(cell);
  }
  gridPreviewLabel.textContent = `${r * c} plot${r * c !== 1 ? 's' : ''}`;
}

// Visibility buttons
document.getElementById('visPrivate').onclick = () => setVisibility('private');
document.getElementById('visPublic').onclick  = () => setVisibility('public');
function setVisibility(val) {
  selectedVisibility = val;
  document.getElementById('visPrivate').classList.toggle('active', val === 'private');
  document.getElementById('visPublic').classList.toggle('active', val === 'public');
}

document.getElementById('confirmCreateGardenBtn').onclick = async () => {
  const name = gardenNameInput.value.trim();
  if (!name) { gardenNameInput.focus(); return; }

  const rows = Math.min(20, Math.max(2, parseInt(gridRowsInput.value) || 6));
  const cols = Math.min(20, Math.max(2, parseInt(gridColsInput.value) || 6));

  const docRef = await db.collection('gardens').add({
    name,
    rows,
    cols,
    ownerId:    currentUser.uid,
    ownerName:  currentUser.displayName || currentUser.email,
    visibility: selectedVisibility,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:  firebase.firestore.FieldValue.serverTimestamp()
  });

  createOverlay.classList.remove('open');
  openGarden(docRef.id, { name, rows, cols, ownerId: currentUser.uid, visibility: selectedVisibility }, true);
};

// ================================================================
// GARDEN VIEW
// ================================================================
let currentGardenId   = null;
let currentGardenData = null;
let isGardenOwner     = false;
let tilesData         = {};
let activeId          = null;
let tilesUnsubscribe  = null;

function tileId(r, c)  { return `r${r}c${c}`; }
function tileRC(id)    { return { r: parseInt(id.match(/r(\d+)/)[1]), c: parseInt(id.match(/c(\d+)/)[1]) }; }

function openGarden(gardenId, gardenData, isOwn) {
  currentGardenId   = gardenId;
  currentGardenData = gardenData;
  isGardenOwner     = isOwn;

  // Update header
  document.getElementById('gardenTitle').textContent = gardenData.name || 'Garden';
  document.getElementById('gardenOwnerBadge').textContent =
    isOwn ? '' : `by ${gardenData.ownerName || 'unknown'}`;

  document.getElementById('togglePublicBtn').style.display = isOwn ? 'inline-block' : 'none';
  updateTogglePublicBtn();

  // Navigate to garden page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-garden').classList.add('active');
  currentPage = 'garden';

  // Set up grid dimensions
  const rows = gardenData.rows || 6;
  const cols = gardenData.cols || 6;
  const container = document.getElementById('garden-container');

  // Size the container
  const maxSize = Math.min(window.innerWidth > 900 ? window.innerHeight * 0.75 : window.innerWidth * 0.96, 700);
  container.style.width  = maxSize + 'px';
  container.style.height = maxSize + 'px';
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  container.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;

  // Tile font size based on grid size
  const tilePx = maxSize / Math.max(rows, cols);
  container.style.fontSize = Math.max(8, Math.min(14, tilePx * 0.35)) + 'px';

  // Reset panel
  activeId = null;
  document.getElementById('editInfo').style.display  = 'none';
  document.getElementById('defaultInfo').style.display = 'block';

  // Subscribe to tiles
  if (tilesUnsubscribe) tilesUnsubscribe();
  tilesData = {};
  tilesUnsubscribe = db.collection('gardens').doc(gardenId)
    .collection('tiles')
    .onSnapshot(snapshot => {
      tilesData = {};
      snapshot.forEach(doc => { tilesData[doc.id] = doc.data(); });
      renderGrid();
    });
}

function exitGarden() {
  if (tilesUnsubscribe) { tilesUnsubscribe(); tilesUnsubscribe = null; }
  if (mergeMode) toggleMergeMode(false);
  currentGardenId = null;
  activeId = null;
  tilesData = {};
}

document.getElementById('backBtn').onclick = () => {
  exitGarden();
  navigateTo(currentUser ? 'home' : 'public');
};

// Toggle public/private
document.getElementById('togglePublicBtn').onclick = async () => {
  if (!currentGardenId || !isGardenOwner) return;
  const newVis = currentGardenData.visibility === 'public' ? 'private' : 'public';
  await db.collection('gardens').doc(currentGardenId).update({ visibility: newVis });
  currentGardenData.visibility = newVis;
  updateTogglePublicBtn();
};

function updateTogglePublicBtn() {
  const btn = document.getElementById('togglePublicBtn');
  if (!currentGardenData) return;
  btn.textContent = currentGardenData.visibility === 'public' ? '🔒 Make Private' : '🌍 Make Public';
}

// ================================================================
// RENDER GRID
// ================================================================
function renderGrid() {
  if (!currentGardenData) return;
  const garden = document.getElementById('garden-container');
  const rows = currentGardenData.rows || 6;
  const cols = currentGardenData.cols || 6;

  garden.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id  = tileId(r, c);
      const d   = tilesData[id] || {};
      const div = document.createElement('div');

      div.className = 'tile';
      div.dataset.id = id;
      div.style.background = d.color || '#e8ffd6';

      const group = d.mergeGroup;
      if (group) {
        const isLeader = isMergeLeader(id, group);
        div.textContent = isLeader ? (d.title || '') : '';
        if (!d.title) div.classList.add('empty');
      } else {
        div.textContent = d.title || '';
        if (!d.title) div.classList.add('empty');
      }

      applyMergeBorderClasses(div, id, r, c, rows, cols);

      if (id === activeId) div.classList.add('active');

      if (isGardenOwner) {
        div.onclick = () => handleTileClick(id);
      } else {
        div.style.cursor = 'default';
        // Read-only: clicking shows info only
        div.onclick = () => showReadOnlyInfo(id);
      }

      garden.appendChild(div);
    }
  }

  if (mergeMode) applyMergeModeUI();
}

function isMergeLeader(id, group) {
  const members = Object.keys(tilesData).filter(k => tilesData[k].mergeGroup === group);
  members.sort((a, b) => {
    const ra = tileRC(a), rb = tileRC(b);
    return ra.r !== rb.r ? ra.r - rb.r : ra.c - rb.c;
  });
  return members[0] === id;
}

function applyMergeBorderClasses(div, id, r, c, rows, cols) {
  const d = tilesData[id] || {};
  const g = d.mergeGroup;
  if (!g) return;
  const top    = r > 0       ? (tilesData[tileId(r-1, c)] || {}) : {};
  const bottom = r < rows-1  ? (tilesData[tileId(r+1, c)] || {}) : {};
  const left   = c > 0       ? (tilesData[tileId(r, c-1)] || {}) : {};
  const right  = c < cols-1  ? (tilesData[tileId(r, c+1)] || {}) : {};
  if (top.mergeGroup    === g) div.classList.add('merge-top');
  if (bottom.mergeGroup === g) div.classList.add('merge-bottom');
  if (left.mergeGroup   === g) div.classList.add('merge-left');
  if (right.mergeGroup  === g) div.classList.add('merge-right');
}

function showReadOnlyInfo(id) {
  const d = tilesData[id] || {};
  if (!d.title) return;
  const panel = document.getElementById('defaultInfo');
  panel.innerHTML = `
    <h2 style="font-family:'Schoolbell',cursive">${escHtml(d.title)}</h2>
    ${d.description ? `<p>${escHtml(d.description)}</p>` : ''}
    ${d.imageUrl ? `<img src="${escHtml(d.imageUrl)}" style="width:100%;border-radius:0.5rem;margin-top:0.5rem;" />` : ''}
  `;
  document.getElementById('editInfo').style.display  = 'none';
  document.getElementById('defaultInfo').style.display = 'block';
}

// ================================================================
// OPEN PANEL / TILE CLICK
// ================================================================
const editInfo    = document.getElementById('editInfo');
const defaultInfo = document.getElementById('defaultInfo');
const titleInput  = document.getElementById('titleInput');
const descInput   = document.getElementById('descInput');
const imgInput    = document.getElementById('imgInput');
const colorInput  = document.getElementById('colorInput');
const splitBtn    = document.getElementById('splitBtn');

function openPanel(id) {
  activeId = id;
  defaultInfo.style.display = 'none';
  editInfo.style.display    = 'block';

  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  const { r, c } = tileRC(id);
  const rows = currentGardenData.rows || 6;
  const tiles = document.querySelectorAll('.tile');
  if (tiles[r * (currentGardenData.cols || 6) + c])
    tiles[r * (currentGardenData.cols || 6) + c].classList.add('active');

  const d = tilesData[id] || {};
  titleInput.value  = d.title       || '';
  descInput.value   = d.description || '';
  imgInput.value    = d.imageUrl    || '';
  colorInput.value  = d.color       || '#e8ffd6';
  splitBtn.style.display = d.mergeGroup ? 'inline-block' : 'none';
}

function handleTileClick(id) {
  if (mergeMode) {
    toggleMergeSelection(id);
  } else {
    openPanel(id);
  }
}

// ================================================================
// SAVE / CLEAR / EXIT / SPLIT
// ================================================================
function tilesRef() {
  return db.collection('gardens').doc(currentGardenId).collection('tiles');
}

document.getElementById('saveBtn').onclick = async () => {
  if (!activeId) return;
  const d = tilesData[activeId] || {};
  const payload = {
    title:       titleInput.value.trim(),
    description: descInput.value.trim(),
    imageUrl:    imgInput.value.trim(),
    color:       colorInput.value,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };
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
  // Update garden updatedAt
  db.collection('gardens').doc(currentGardenId).update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
};

document.getElementById('clearBtn').onclick = async () => {
  if (!activeId) return;
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
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  activeId = null;
  editInfo.style.display  = 'none';
  defaultInfo.style.display = 'block';
};

document.getElementById('exitBtn').onclick = () => {
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  activeId = null;
  editInfo.style.display  = 'none';
  defaultInfo.style.display = 'block';
};

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
  splitBtn.style.display = 'none';
};

// ================================================================
// MERGE MODE
// ================================================================
let mergeMode     = false;
let mergeSelected = new Set();

const mergeModeBtn    = document.getElementById('mergeModeBtn');
const mergeToolbar    = document.getElementById('merge-toolbar');
const mergeConfirmBtn = document.getElementById('mergeConfirmBtn');
const mergeCancelBtn  = document.getElementById('mergeCancelBtn');
const mergeCountSpan  = document.getElementById('mergeCount');

mergeModeBtn.onclick = () => toggleMergeMode();

function toggleMergeMode(on) {
  mergeMode = (on !== undefined) ? on : !mergeMode;
  mergeSelected.clear();

  document.body.classList.toggle('merge-mode', mergeMode);
  mergeModeBtn.classList.toggle('active', mergeMode);
  mergeModeBtn.textContent = mergeMode ? '✕ Cancel Merge' : '⊞ Merge Tiles';

  if (mergeMode) {
    editInfo.style.display  = 'none';
    defaultInfo.style.display = 'block';
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
    activeId = null;
    mergeToolbar.classList.add('visible');
    updateMergeToolbar();
    applyMergeModeUI();
  } else {
    mergeToolbar.classList.remove('visible');
    document.querySelectorAll('.tile').forEach(t =>
      t.classList.remove('merge-selected', 'merge-eligible', 'merge-ineligible'));
  }
}

function getEligibleIds() {
  const rows = currentGardenData.rows || 6;
  const cols = currentGardenData.cols || 6;
  let lockedGroup = null;
  mergeSelected.forEach(id => {
    const g = (tilesData[id] || {}).mergeGroup;
    if (g) lockedGroup = g;
  });
  const eligible = new Set();
  if (mergeSelected.size === 0) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        eligible.add(tileId(r, c));
  } else {
    mergeSelected.forEach(id => {
      const { r, c } = tileRC(id);
      const neighbours = [];
      if (r > 0)       neighbours.push(tileId(r-1, c));
      if (r < rows-1)  neighbours.push(tileId(r+1, c));
      if (c > 0)       neighbours.push(tileId(r, c-1));
      if (c < cols-1)  neighbours.push(tileId(r, c+1));
      neighbours.forEach(n => { if (!mergeSelected.has(n)) eligible.add(n); });
    });
    eligible.forEach(id => {
      const g = (tilesData[id] || {}).mergeGroup;
      if (g && lockedGroup && g !== lockedGroup) eligible.delete(id);
    });
  }
  return eligible;
}

function applyMergeModeUI() {
  const eligible = getEligibleIds();
  document.querySelectorAll('.tile').forEach(div => {
    const id = div.dataset.id;
    div.classList.remove('merge-selected', 'merge-eligible', 'merge-ineligible');
    if (mergeSelected.has(id))      div.classList.add('merge-selected');
    else if (eligible.has(id))      div.classList.add('merge-eligible');
    else                            div.classList.add('merge-ineligible');
  });
}

function toggleMergeSelection(id) {
  if (mergeSelected.has(id)) {
    mergeSelected.delete(id);
    if (mergeSelected.size > 0 && !isConnected(mergeSelected)) mergeSelected.add(id);
  } else {
    const eligible = getEligibleIds();
    if (!eligible.has(id)) return;
    mergeSelected.add(id);
  }
  applyMergeModeUI();
  updateMergeToolbar();
}

function isConnected(ids) {
  if (ids.size <= 1) return true;
  const arr = [...ids];
  const visited = new Set();
  const rows = currentGardenData.rows || 6;
  const cols = currentGardenData.cols || 6;
  const queue = [arr[0]]; visited.add(arr[0]);
  while (queue.length) {
    const cur = queue.shift();
    const { r, c } = tileRC(cur);
    const neighbours = [];
    if (r > 0)       neighbours.push(tileId(r-1, c));
    if (r < rows-1)  neighbours.push(tileId(r+1, c));
    if (c > 0)       neighbours.push(tileId(r, c-1));
    if (c < cols-1)  neighbours.push(tileId(r, c+1));
    neighbours.forEach(n => { if (ids.has(n) && !visited.has(n)) { visited.add(n); queue.push(n); } });
  }
  return visited.size === ids.size;
}

function updateMergeToolbar() {
  const n = mergeSelected.size;
  mergeCountSpan.textContent = n === 0
    ? 'Tap tiles to select'
    : `${n} tile${n > 1 ? 's' : ''} selected`;
  mergeConfirmBtn.disabled = n < 2;
}

mergeConfirmBtn.onclick = async () => {
  if (mergeSelected.size < 2) return;
  let group = null;
  mergeSelected.forEach(id => {
    const g = (tilesData[id] || {}).mergeGroup;
    if (g) group = g;
  });
  if (!group) group = crypto.randomUUID();
  const sortedIds = [...mergeSelected].sort((a, b) => {
    const ra = tileRC(a), rb = tileRC(b);
    return ra.r !== rb.r ? ra.r - rb.r : ra.c - rb.c;
  });
  const leaderData = tilesData[sortedIds[0]] || {};
  const batch = db.batch();
  mergeSelected.forEach(id => {
    const existing = tilesData[id] || {};
    batch.set(tilesRef().doc(id), {
      title:       leaderData.title       || existing.title       || '',
      description: leaderData.description || existing.description || '',
      imageUrl:    leaderData.imageUrl    || existing.imageUrl    || '',
      color:       leaderData.color       || existing.color       || '#e8ffd6',
      mergeGroup:  group,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  toggleMergeMode(false);
};

mergeCancelBtn.onclick = () => toggleMergeMode(false);

// ================================================================
// MOBILE MODAL BRIDGE
// ================================================================
(function () {
  const overlay     = document.getElementById('modal-overlay');
  const mTitle      = document.getElementById('modal-plotTitle');
  const mTitleInput = document.getElementById('modal-titleInput');
  const mDesc       = document.getElementById('modal-descInput');
  const mImg        = document.getElementById('modal-imgInput');
  const mColor      = document.getElementById('modal-colorInput');
  const mSplitBtn   = document.getElementById('modal-splitBtn');

  function isMobile() { return window.innerWidth <= 900; }

  function closeModal() {
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.remove('open', 'closing');
    }, 180);
  }

  const _origOpen = openPanel;
  window.openPanel = function (id) {
    _origOpen(id);
    if (!isMobile()) return;

    const d = tilesData[id] || {};
    mTitle.textContent = d.title || 'Empty Plot';
    mTitleInput.value  = d.title       || '';
    mDesc.value        = d.description || '';
    mImg.value         = d.imageUrl    || '';
    mColor.value       = d.color       || '#e8ffd6';
    if (mSplitBtn) mSplitBtn.style.display = d.mergeGroup ? 'inline-block' : 'none';
    overlay.classList.add('open');
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  document.getElementById('modal-saveBtn').onclick = async function () {
    if (!activeId) return;
    titleInput.value = mTitleInput.value;
    descInput.value  = mDesc.value;
    imgInput.value   = mImg.value;
    colorInput.value = mColor.value;
    document.getElementById('saveBtn').click();
    closeModal();
  };

  document.getElementById('modal-clearBtn').onclick = function () {
    document.getElementById('clearBtn').click();
    closeModal();
  };

  document.getElementById('modal-exitBtn').onclick = function () {
    document.getElementById('exitBtn').click();
    closeModal();
  };

  if (mSplitBtn) {
    mSplitBtn.onclick = function () {
      document.getElementById('splitBtn').click();
      closeModal();
    };
  }
})();
