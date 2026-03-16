// ================================================================
// AUTH
// ================================================================
const auth     = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db       = firebase.firestore();
const storage  = firebase.storage();

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
    const av = document.getElementById('composeAvatar');
    if (av) {
      if (user.photoURL) {
        av.style.backgroundImage = `url(${user.photoURL})`;
        av.style.backgroundSize  = 'cover';
        av.textContent = '';
      } else {
        av.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
      }
    }
    navigateTo('home');
    loadMyGardens();
  } else {
    loginGate.style.display = 'flex';
    appShell.style.display  = 'none';
  }
});

// ================================================================
// IMAGE UPLOAD HELPERS
// ================================================================

/**
 * Opens a file picker, uploads to Firebase Storage, returns download URL.
 * Shows progress in the given bar + label elements.
 */
function uploadImage({ path, barEl, labelEl }) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error('cancelled'));
      const ext      = file.name.split('.').pop();
      const filename = `${Date.now()}.${ext}`;
      const ref      = storage.ref(`${path}/${filename}`);
      const task     = ref.put(file);

      if (barEl)   { barEl.parentElement.style.display = 'block'; barEl.style.width = '0%'; }
      if (labelEl) { labelEl.style.display = 'inline'; labelEl.textContent = 'Uploading…'; }

      task.on('state_changed',
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          if (barEl)   barEl.style.width   = pct + '%';
          if (labelEl) labelEl.textContent = `Uploading… ${pct}%`;
        },
        err => {
          if (barEl)   barEl.parentElement.style.display = 'none';
          if (labelEl) labelEl.style.display = 'none';
          reject(err);
        },
        async () => {
          const url = await task.snapshot.ref.getDownloadURL();
          if (barEl)   barEl.parentElement.style.display = 'none';
          if (labelEl) { labelEl.textContent = '✓ Done'; setTimeout(() => labelEl.style.display = 'none', 1500); }
          resolve(url);
        }
      );
    };
    input.click();
  });
}

async function uploadPostImage() {
  try {
    const url = await uploadImage({
      path:   `posts/${currentUser.uid}`,
      barEl:  document.getElementById('postUploadBar'),
      labelEl: null
    });
    pendingImageUrl = url;
    document.getElementById('composeImgThumb').src = url;
    document.getElementById('composeImgPreview').style.display = 'flex';
  } catch(e) {
    if (e.message !== 'cancelled') alert('Upload failed: ' + e.message);
  }
}

async function uploadTileImage(isMobileModal) {
  const btn      = document.getElementById(isMobileModal ? 'modal-tileUploadBtn' : 'tileUploadBtn');
  const labelEl  = document.getElementById(isMobileModal ? 'modalTileUploadLabel' : 'tileUploadLabel');
  const barEl    = document.getElementById(isMobileModal ? null : 'tileUploadBar');
  if (btn) btn.disabled = true;
  try {
    const url = await uploadImage({
      path:   `tiles/${currentUser.uid}`,
      barEl,
      labelEl
    });
    document.getElementById('imgInput').value       = url;
    document.getElementById('modal-imgInput').value = url;
  } catch(e) {
    if (e.message !== 'cancelled') alert('Upload failed: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Wire up upload buttons
document.getElementById('tileUploadBtn').onclick       = () => uploadTileImage(false);
document.getElementById('modal-tileUploadBtn').onclick = () => uploadTileImage(true);

// ================================================================
// NAVIGATION
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
  if (page === 'public')    loadPublicGardens();
  if (page === 'community') loadFeed();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => { if (currentGardenId) exitGarden(); navigateTo(btn.dataset.page); };
});
document.getElementById('navLogo').onclick = () => {
  if (currentGardenId) exitGarden(); navigateTo('home');
};

// ================================================================
// MY GARDENS
// ================================================================
const myGrid     = document.getElementById('my-gardens-grid');
const emptyState = document.getElementById('empty-state');

document.getElementById('createGardenBtn').onclick = openCreateModal;
document.getElementById('emptyCreateBtn').onclick  = openCreateModal;

let myGardensUnsubscribe = null;

function loadMyGardens() {
  if (myGardensUnsubscribe) myGardensUnsubscribe();

  const mergeAndRender = (ownedSnap, collabSnap) => {
    myGrid.innerHTML = '';
    const allDocs = [];
    ownedSnap.forEach(doc => allDocs.push({ doc, isOwn: true }));
    if (collabSnap) {
      collabSnap.forEach(doc => {
        if (!allDocs.find(d => d.doc.id === doc.id))
          allDocs.push({ doc, isOwn: false });
      });
    }
    if (allDocs.length === 0) { emptyState.style.display = 'block'; return; }
    emptyState.style.display = 'none';
    allDocs.forEach(({ doc, isOwn }) =>
      myGrid.appendChild(buildGardenCard(doc.id, doc.data(), isOwn)));
  };

  const renderAll = (ownedSnap) => {
    db.collection('gardens')
      .where('collaboratorEmails', 'array-contains', currentUser.email)
      .get()
      .then(collabSnap => mergeAndRender(ownedSnap, collabSnap))
      .catch(() => mergeAndRender(ownedSnap, null));
  };

  myGardensUnsubscribe = db.collection('gardens')
    .where('ownerId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snap => renderAll(snap),
      () => {
        db.collection('gardens')
          .where('ownerId', '==', currentUser.uid)
          .get()
          .then(snap => renderAll(snap))
          .catch(err => console.error('loadMyGardens failed:', err));
      }
    );
}

// ================================================================
// PUBLIC GARDENS
// ================================================================
const publicGrid       = document.getElementById('public-gardens-grid');
const publicEmptyState = document.getElementById('public-empty-state');

function loadPublicGardens() {
  db.collection('gardens').where('visibility', '==', 'public').get().then(snapshot => {
    publicGrid.innerHTML = '';
    if (snapshot.empty) { publicEmptyState.style.display = 'block'; return; }
    publicEmptyState.style.display = 'none';
    snapshot.forEach(doc => {
      const isOwn = currentUser && doc.data().ownerId === currentUser.uid;
      publicGrid.appendChild(buildGardenCard(doc.id, doc.data(), isOwn));
    });
  });
}

// ================================================================
// GARDEN CARD
// ================================================================
function buildGardenCard(gardenId, data, isOwn) {
  const card = document.createElement('div');
  card.className = 'garden-card';
  const rows  = data.rows || 6;
  const cols  = data.cols || 6;
  const pRows = Math.min(rows, 12);
  const pCols = Math.min(cols, 12);

  const preview = document.createElement('div');
  preview.className = 'garden-card-preview';
  preview.style.gridTemplateColumns = `repeat(${pCols}, 1fr)`;
  preview.style.gridTemplateRows    = `repeat(${pRows}, 1fr)`;
  const cellMap = {};
  for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
    const cell = document.createElement('div');
    cell.className = 'mini-tile';
    cellMap[`r${r}c${c}`] = cell;
    preview.appendChild(cell);
  }
  db.collection('gardens').doc(gardenId).collection('tiles').get().then(snap => {
    snap.forEach(doc => {
      if (cellMap[doc.id] && doc.data().color)
        cellMap[doc.id].style.background = doc.data().color;
    });
  });

  const isCollab = !isOwn && (data.collaboratorEmails || []).includes(currentUser?.email);
  const badge = data.visibility === 'public'
    ? '<span class="garden-card-badge badge-public">🌍 Public</span>'
    : isCollab
      ? '<span class="garden-card-badge badge-collab">✏ Collaborator</span>'
      : '<span class="garden-card-badge badge-private">🔒 Private</span>';

  const ownerLine = (!isOwn && !isCollab && data.ownerName)
    ? `<div class="garden-card-owner">by ${escHtml(data.ownerName)}</div>` : '';
  const collabLine = (isCollab && data.ownerName)
    ? `<div class="garden-card-owner">by ${escHtml(data.ownerName)}</div>` : '';

  card.innerHTML = `
    <div class="garden-card-meta">${badge}<span>${rows}×${cols}</span></div>
    <h3>${escHtml(data.name || 'Unnamed Garden')}</h3>
    ${ownerLine}${collabLine}
  `;
  card.insertBefore(preview, card.firstChild);
  card.onclick = () => openGarden(gardenId, data, isOwn || isCollab);
  return card;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ================================================================
// CREATE GARDEN MODAL
// ================================================================
const createOverlay    = document.getElementById('create-modal-overlay');
const gardenNameInput  = document.getElementById('gardenNameInput');
const gridRowsInput    = document.getElementById('gridRows');
const gridColsInput    = document.getElementById('gridCols');
const gridPreviewEl    = document.getElementById('gridPreview');
const gridPreviewLabel = document.getElementById('gridPreviewLabel');
let selectedVisibility = 'private';

function openCreateModal() {
  gardenNameInput.value = '';
  gridRowsInput.value = '6'; gridColsInput.value = '6';
  selectedVisibility = 'private';
  document.getElementById('visPrivate').classList.add('active');
  document.getElementById('visPublic').classList.remove('active');
  updateGridPreview();
  createOverlay.classList.add('open');
  setTimeout(() => gardenNameInput.focus(), 200);
}
document.getElementById('createModalCloseBtn').onclick = () => createOverlay.classList.remove('open');
createOverlay.addEventListener('click', e => { if (e.target === createOverlay) createOverlay.classList.remove('open'); });

document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.onclick = () => {
    const t = document.getElementById(btn.dataset.target);
    t.value = Math.min(+t.max||20, Math.max(+t.min||2, +t.value + +btn.dataset.dir));
    updateGridPreview();
  };
});
gridRowsInput.addEventListener('input', updateGridPreview);
gridColsInput.addEventListener('input', updateGridPreview);

function updateGridPreview() {
  const r = Math.min(20, Math.max(2, +gridRowsInput.value || 6));
  const c = Math.min(20, Math.max(2, +gridColsInput.value || 6));
  gridPreviewEl.style.gridTemplateColumns = `repeat(${Math.min(c,16)},1fr)`;
  gridPreviewEl.style.gridTemplateRows    = `repeat(${Math.min(r,16)},1fr)`;
  gridPreviewEl.innerHTML = '';
  for (let i = 0; i < Math.min(r,16)*Math.min(c,16); i++) {
    const cell = document.createElement('div'); cell.className = 'preview-cell';
    gridPreviewEl.appendChild(cell);
  }
  gridPreviewLabel.textContent = `${r*c} plot${r*c !== 1 ? 's' : ''}`;
}

document.getElementById('visPrivate').onclick = () => setVis('private');
document.getElementById('visPublic').onclick  = () => setVis('public');
function setVis(v) {
  selectedVisibility = v;
  document.getElementById('visPrivate').classList.toggle('active', v === 'private');
  document.getElementById('visPublic').classList.toggle('active', v === 'public');
}

document.getElementById('confirmCreateGardenBtn').onclick = async () => {
  const name = gardenNameInput.value.trim();
  if (!name) { gardenNameInput.focus(); return; }
  const rows = Math.min(20, Math.max(2, +gridRowsInput.value || 6));
  const cols = Math.min(20, Math.max(2, +gridColsInput.value || 6));
  const docRef = await db.collection('gardens').add({
    name, rows, cols,
    ownerId:            currentUser.uid,
    ownerName:          currentUser.displayName || currentUser.email,
    ownerEmail:         currentUser.email,
    visibility:         selectedVisibility,
    collaboratorEmails: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  createOverlay.classList.remove('open');
  openGarden(docRef.id, { name, rows, cols, ownerId: currentUser.uid, visibility: selectedVisibility, collaboratorEmails: [] }, true);
};

// ================================================================
// GARDEN SETTINGS MODAL
// ================================================================
const settingsOverlay = document.getElementById('settings-modal-overlay');

document.getElementById('settingsModalCloseBtn').onclick = () => settingsOverlay.classList.remove('open');
settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('open'); });

function openSettingsModal() {
  if (!currentGardenData) return;
  document.getElementById('settingsGardenName').textContent = currentGardenData.name || '';
  const isPublic = currentGardenData.visibility === 'public';
  document.getElementById('settingsVisPrivate').classList.toggle('active', !isPublic);
  document.getElementById('settingsVisPublic').classList.toggle('active', isPublic);
  renderCollabList();
  settingsOverlay.classList.add('open');
}
document.getElementById('gardenSettingsBtn').onclick = openSettingsModal;

document.getElementById('settingsVisPrivate').onclick = async () => {
  await updateGardenVisibility('private');
  document.getElementById('settingsVisPrivate').classList.add('active');
  document.getElementById('settingsVisPublic').classList.remove('active');
};
document.getElementById('settingsVisPublic').onclick = async () => {
  await updateGardenVisibility('public');
  document.getElementById('settingsVisPublic').classList.add('active');
  document.getElementById('settingsVisPrivate').classList.remove('active');
};
async function updateGardenVisibility(val) {
  await db.collection('gardens').doc(currentGardenId).update({ visibility: val });
  currentGardenData.visibility = val;
}

function renderCollabList() {
  const list   = document.getElementById('collabList');
  const emails = currentGardenData.collaboratorEmails || [];
  list.innerHTML = '';
  if (emails.length === 0) {
    list.innerHTML = '<p class="collab-empty">No collaborators yet.</p>';
    return;
  }
  emails.forEach(email => {
    const row = document.createElement('div');
    row.className = 'collab-row';
    row.innerHTML = `
      <span class="collab-email">${escHtml(email)}</span>
      <button class="collab-remove-btn" data-email="${escHtml(email)}">✕</button>
    `;
    row.querySelector('.collab-remove-btn').onclick = () => removeCollaborator(email);
    list.appendChild(row);
  });
}

document.getElementById('addCollabBtn').onclick = addCollaborator;
document.getElementById('collabEmailInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCollaborator();
});
async function addCollaborator() {
  const input  = document.getElementById('collabEmailInput');
  const email  = input.value.trim().toLowerCase();
  if (!email || !email.includes('@')) return;
  const emails = currentGardenData.collaboratorEmails || [];
  if (emails.includes(email)) { input.value = ''; return; }
  emails.push(email);
  await db.collection('gardens').doc(currentGardenId).update({ collaboratorEmails: emails });
  currentGardenData.collaboratorEmails = emails;
  input.value = '';
  renderCollabList();
}
async function removeCollaborator(email) {
  const emails = (currentGardenData.collaboratorEmails || []).filter(e => e !== email);
  await db.collection('gardens').doc(currentGardenId).update({ collaboratorEmails: emails });
  currentGardenData.collaboratorEmails = emails;
  renderCollabList();
}

document.getElementById('deleteGardenBtn').onclick = async () => {
  if (!currentGardenId) return;
  const name = currentGardenData?.name || 'this garden';
  if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
  const tilesSnap = await db.collection('gardens').doc(currentGardenId).collection('tiles').get();
  const batch = db.batch();
  tilesSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  await db.collection('gardens').doc(currentGardenId).delete();
  settingsOverlay.classList.remove('open');
  exitGarden();
  navigateTo('home');
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

function tileId(r, c) { return `r${r}c${c}`; }
function tileRC(id)   { return { r: +id.match(/r(\d+)/)[1], c: +id.match(/c(\d+)/)[1] }; }

function openGarden(gardenId, gardenData, isOwn) {
  currentGardenId   = gardenId;
  currentGardenData = gardenData;
  isGardenOwner     = isOwn;

  document.getElementById('gardenTitle').textContent = gardenData.name || 'Garden';
  document.getElementById('gardenOwnerBadge').textContent =
    isOwn ? '' : `by ${gardenData.ownerName || 'unknown'}`;
  document.getElementById('gardenSettingsBtn').style.display =
    (isOwn && gardenData.ownerId === currentUser?.uid) ? 'inline-block' : 'none';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-garden').classList.add('active');
  currentPage = 'garden';

  const rows = gardenData.rows || 6;
  const cols = gardenData.cols || 6;
  const container = document.getElementById('garden-container');
  const maxSize = Math.min(window.innerWidth > 900 ? window.innerHeight * 0.75 : window.innerWidth * 0.96, 700);
  container.style.width  = maxSize + 'px';
  container.style.height = maxSize + 'px';
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  container.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;
  const tilePx = maxSize / Math.max(rows, cols);
  container.style.fontSize = Math.max(8, Math.min(14, tilePx * 0.35)) + 'px';

  activeId = null;
  document.getElementById('editInfo').style.display    = 'none';
  document.getElementById('defaultInfo').style.display = 'block';

  if (tilesUnsubscribe) tilesUnsubscribe();
  tilesData = {};
  tilesUnsubscribe = db.collection('gardens').doc(gardenId).collection('tiles')
    .onSnapshot(snap => {
      tilesData = {};
      snap.forEach(doc => { tilesData[doc.id] = doc.data(); });
      renderGrid();
    });
}

function exitGarden() {
  if (tilesUnsubscribe) { tilesUnsubscribe(); tilesUnsubscribe = null; }
  if (mergeMode) toggleMergeMode(false);
  currentGardenId = null; activeId = null; tilesData = {};
}

document.getElementById('backBtn').onclick = () => {
  exitGarden();
  navigateTo(currentUser ? 'home' : 'public');
};

// ================================================================
// RENDER GRID
// ================================================================
function renderGrid() {
  if (!currentGardenData) return;
  const garden = document.getElementById('garden-container');
  const rows   = currentGardenData.rows || 6;
  const cols   = currentGardenData.cols || 6;
  garden.innerHTML = '';

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id  = tileId(r, c);
    const d   = tilesData[id] || {};
    const div = document.createElement('div');
    div.className  = 'tile';
    div.dataset.id = id;
    div.style.background = d.color || '#e8ffd6';

    const group = d.mergeGroup;
    div.textContent = group ? (isMergeLeader(id, group) ? (d.title || '') : '') : (d.title || '');
    if (!d.title) div.classList.add('empty');
    applyMergeBorderClasses(div, id, r, c, rows, cols);
    if (id === activeId) div.classList.add('active');

    if (isGardenOwner) {
      div.onclick = () => handleTileClick(id);
    } else {
      div.style.cursor = 'default';
      div.onclick = () => showReadOnlyInfo(id);
    }
    garden.appendChild(div);
  }
  if (mergeMode) applyMergeModeUI();
}

function isMergeLeader(id, group) {
  const members = Object.keys(tilesData).filter(k => tilesData[k].mergeGroup === group);
  members.sort((a, b) => { const ra=tileRC(a),rb=tileRC(b); return ra.r!==rb.r ? ra.r-rb.r : ra.c-rb.c; });
  return members[0] === id;
}

function applyMergeBorderClasses(div, id, r, c, rows, cols) {
  const g = (tilesData[id]||{}).mergeGroup; if (!g) return;
  if (r>0      && (tilesData[tileId(r-1,c)]||{}).mergeGroup===g) div.classList.add('merge-top');
  if (r<rows-1 && (tilesData[tileId(r+1,c)]||{}).mergeGroup===g) div.classList.add('merge-bottom');
  if (c>0      && (tilesData[tileId(r,c-1)]||{}).mergeGroup===g) div.classList.add('merge-left');
  if (c<cols-1 && (tilesData[tileId(r,c+1)]||{}).mergeGroup===g) div.classList.add('merge-right');
}

function showReadOnlyInfo(id) {
  const d = tilesData[id] || {};
  if (!d.title) return;
  document.getElementById('defaultInfo').innerHTML = `
    <h2>${escHtml(d.title)}</h2>
    ${d.description ? `<p>${escHtml(d.description)}</p>` : ''}
    ${d.imageUrl ? `<img src="${escHtml(d.imageUrl)}" style="width:100%;border-radius:0.5rem;margin-top:0.5rem"/>` : ''}
  `;
  document.getElementById('editInfo').style.display    = 'none';
  document.getElementById('defaultInfo').style.display = 'block';
}

// ================================================================
// TILE PANEL
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
  const cols   = currentGardenData.cols || 6;
  const tiles  = document.querySelectorAll('.tile');
  if (tiles[r * cols + c]) tiles[r * cols + c].classList.add('active');
  const d = tilesData[id] || {};
  titleInput.value = d.title || '';
  descInput.value  = d.description || '';
  imgInput.value   = d.imageUrl || '';
  colorInput.value = d.color || '#e8ffd6';
  splitBtn.style.display = d.mergeGroup ? 'inline-block' : 'none';
}

function handleTileClick(id) {
  if (mergeMode) toggleMergeSelection(id); else openPanel(id);
}

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
  db.collection('gardens').doc(currentGardenId)
    .update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
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
  editInfo.style.display    = 'none';
  defaultInfo.style.display = 'block';
};

document.getElementById('exitBtn').onclick = () => {
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  activeId = null;
  editInfo.style.display    = 'none';
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
  mergeMode = on !== undefined ? on : !mergeMode;
  mergeSelected.clear();
  document.body.classList.toggle('merge-mode', mergeMode);
  mergeModeBtn.classList.toggle('active', mergeMode);
  mergeModeBtn.textContent = mergeMode ? '✕ Cancel' : '⊞ Merge';
  if (mergeMode) {
    editInfo.style.display = 'none'; defaultInfo.style.display = 'block';
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
    activeId = null;
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
  let lockedGroup = null;
  mergeSelected.forEach(id => { const g=(tilesData[id]||{}).mergeGroup; if(g) lockedGroup=g; });
  const eligible = new Set();
  if (mergeSelected.size === 0) {
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) eligible.add(tileId(r,c));
  } else {
    mergeSelected.forEach(id => {
      const {r,c} = tileRC(id);
      [r>0&&tileId(r-1,c), r<rows-1&&tileId(r+1,c), c>0&&tileId(r,c-1), c<cols-1&&tileId(r,c+1)]
        .filter(Boolean).forEach(n => { if (!mergeSelected.has(n)) eligible.add(n); });
    });
    eligible.forEach(id => {
      const g = (tilesData[id]||{}).mergeGroup;
      if (g && lockedGroup && g !== lockedGroup) eligible.delete(id);
    });
  }
  return eligible;
}

function applyMergeModeUI() {
  const eligible = getEligibleIds();
  document.querySelectorAll('.tile').forEach(div => {
    const id = div.dataset.id;
    div.classList.remove('merge-selected','merge-eligible','merge-ineligible');
    if (mergeSelected.has(id))   div.classList.add('merge-selected');
    else if (eligible.has(id))   div.classList.add('merge-eligible');
    else                         div.classList.add('merge-ineligible');
  });
}

function toggleMergeSelection(id) {
  if (mergeSelected.has(id)) {
    mergeSelected.delete(id);
    if (mergeSelected.size > 0 && !isConnected(mergeSelected)) mergeSelected.add(id);
  } else {
    if (!getEligibleIds().has(id)) return;
    mergeSelected.add(id);
  }
  applyMergeModeUI(); updateMergeToolbar();
}

function isConnected(ids) {
  if (ids.size <= 1) return true;
  const rows=currentGardenData.rows||6, cols=currentGardenData.cols||6;
  const arr=[...ids], visited=new Set(), queue=[arr[0]]; visited.add(arr[0]);
  while (queue.length) {
    const cur=queue.shift(), {r,c}=tileRC(cur);
    [r>0&&tileId(r-1,c), r<rows-1&&tileId(r+1,c), c>0&&tileId(r,c-1), c<cols-1&&tileId(r,c+1)]
      .filter(Boolean)
      .forEach(n => { if (ids.has(n) && !visited.has(n)) { visited.add(n); queue.push(n); } });
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
    const ra=tileRC(a), rb=tileRC(b); return ra.r!==rb.r ? ra.r-rb.r : ra.c-rb.c;
  });
  const leaderData = tilesData[sorted[0]] || {};
  const batch = db.batch();
  mergeSelected.forEach(id => {
    const ex = tilesData[id] || {};
    batch.set(tilesRef().doc(id), {
      title:       leaderData.title       || ex.title       || '',
      description: leaderData.description || ex.description || '',
      imageUrl:    leaderData.imageUrl    || ex.imageUrl    || '',
      color:       leaderData.color       || ex.color       || '#e8ffd6',
      mergeGroup:  group,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  toggleMergeMode(false);
};
mergeCancelBtn.onclick = () => toggleMergeMode(false);

// ================================================================
// COMMUNITY FEED
// ================================================================
let pendingImageUrl      = '';
let pendingTaggedGardens = [];

const submitPostBtn     = document.getElementById('submitPostBtn');
const postTextInput     = document.getElementById('postTextInput');
const addImgBtn         = document.getElementById('addImgBtn');
const composeImgPreview = document.getElementById('composeImgPreview');
const composeImgThumb   = document.getElementById('composeImgThumb');
const removeImgBtn      = document.getElementById('removeImgBtn');
const tagGardenBtn      = document.getElementById('tagGardenBtn');
const composeTagsEl     = document.getElementById('composeTags');
const feedEl            = document.getElementById('community-feed');
const feedEmpty         = document.getElementById('feed-empty');

addImgBtn.onclick = () => uploadPostImage();

removeImgBtn.onclick = () => {
  pendingImageUrl = '';
  composeImgThumb.src = '';
  composeImgPreview.style.display = 'none';
};

tagGardenBtn.onclick = () => {
  const list = document.getElementById('tag-picker-list');
  list.innerHTML = '<p style="color:#888;font-size:0.9rem">Loading…</p>';
  document.getElementById('tag-picker-overlay').classList.add('open');
  db.collection('gardens').where('ownerId','==',currentUser.uid).get().then(snap => {
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p style="color:#888;font-size:0.9rem">You have no gardens to tag yet.</p>';
      return;
    }
    snap.forEach(doc => {
      const d = doc.data();
      const already = pendingTaggedGardens.find(g => g.id === doc.id);
      const btn = document.createElement('button');
      btn.className   = 'tag-picker-item' + (already ? ' selected' : '');
      btn.textContent = d.name || 'Unnamed';
      btn.onclick = () => {
        if (already) {
          pendingTaggedGardens = pendingTaggedGardens.filter(g => g.id !== doc.id);
        } else {
          pendingTaggedGardens.push({ id: doc.id, name: d.name || 'Unnamed' });
        }
        renderComposeTags();
        document.getElementById('tag-picker-overlay').classList.remove('open');
      };
      list.appendChild(btn);
    });
  });
};

document.getElementById('tagPickerCloseBtn').onclick = () =>
  document.getElementById('tag-picker-overlay').classList.remove('open');
document.getElementById('tag-picker-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('tag-picker-overlay'))
    document.getElementById('tag-picker-overlay').classList.remove('open');
});

function renderComposeTags() {
  composeTagsEl.innerHTML = '';
  pendingTaggedGardens.forEach(g => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `🌿 ${escHtml(g.name)} <button class="chip-remove" data-id="${g.id}">✕</button>`;
    chip.querySelector('.chip-remove').onclick = e => {
      e.stopPropagation();
      pendingTaggedGardens = pendingTaggedGardens.filter(x => x.id !== g.id);
      renderComposeTags();
    };
    composeTagsEl.appendChild(chip);
  });
}

submitPostBtn.onclick = async () => {
  const text = postTextInput.value.trim();
  if (!text && !pendingImageUrl) return;
  submitPostBtn.disabled = true;
  try {
    await db.collection('posts').add({
      authorId:      currentUser.uid,
      authorName:    currentUser.displayName || currentUser.email,
      authorPhoto:   currentUser.photoURL || '',
      text,
      imageUrl:      pendingImageUrl,
      taggedGardens: pendingTaggedGardens,
      createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
      likes:         []
    });
    postTextInput.value = '';
    pendingImageUrl = '';
    pendingTaggedGardens = [];
    composeImgPreview.style.display = 'none';
    composeImgThumb.src = '';
    renderComposeTags();
  } finally {
    submitPostBtn.disabled = false;
  }
};

function loadFeed() {
  feedEl.innerHTML = '';
  db.collection('posts').orderBy('createdAt','desc').limit(50)
    .onSnapshot(snap => {
      feedEl.innerHTML = '';
      if (snap.empty) { feedEmpty.style.display = 'block'; return; }
      feedEmpty.style.display = 'none';
      snap.forEach(doc => feedEl.appendChild(buildPostCard(doc.id, doc.data())));
    });
}

function buildPostCard(postId, data) {
  const card    = document.createElement('div');
  card.className = 'post-card';
  const isOwn   = currentUser && data.authorId === currentUser.uid;
  const liked   = (data.likes||[]).includes(currentUser?.uid);
  const likeCount = (data.likes||[]).length;
  const initials  = (data.authorName||'?')[0].toUpperCase();
  const avatarHtml = data.authorPhoto
    ? `<img src="${escHtml(data.authorPhoto)}" class="post-avatar-img" alt="" />`
    : `<div class="post-avatar-initials">${initials}</div>`;
  const imgHtml = data.imageUrl
    ? `<img src="${escHtml(data.imageUrl)}" class="post-image" alt="" onerror="this.style.display='none'" />`
    : '';
  const tagsHtml = (data.taggedGardens||[]).length
    ? `<div class="post-tags">${data.taggedGardens.map(g =>
        `<span class="post-tag-chip" data-garden-id="${escHtml(g.id)}">🌿 ${escHtml(g.name)}</span>`
      ).join('')}</div>` : '';
  const timeStr  = data.createdAt?.toDate ? timeAgo(data.createdAt.toDate()) : 'just now';
  const deleteBtn = isOwn ? `<button class="post-delete-btn" data-id="${postId}">🗑</button>` : '';

  card.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${avatarHtml}</div>
      <div class="post-meta">
        <span class="post-author">${escHtml(data.authorName||'Unknown')}</span>
        <span class="post-time">${timeStr}</span>
      </div>
      ${deleteBtn}
    </div>
    ${data.text ? `<p class="post-text">${escHtml(data.text)}</p>` : ''}
    ${imgHtml}
    ${tagsHtml}
    <div class="post-actions">
      <button class="like-btn ${liked?'liked':''}" data-id="${postId}">
        ${liked ? '❤' : '🤍'} <span>${likeCount}</span>
      </button>
    </div>
  `;

  card.querySelector('.like-btn').onclick = async () => {
    const ref = db.collection('posts').doc(postId);
    if (liked) await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
    else       await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
  };

  const delBtn = card.querySelector('.post-delete-btn');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Delete this post?')) return;
    await db.collection('posts').doc(postId).delete();
  };

  card.querySelectorAll('.post-tag-chip').forEach(chip => {
    chip.onclick = async () => {
      const doc = await db.collection('gardens').doc(chip.dataset.gardenId).get();
      if (doc.exists) {
        const own    = currentUser && doc.data().ownerId === currentUser.uid;
        const collab = (doc.data().collaboratorEmails||[]).includes(currentUser?.email);
        openGarden(doc.id, doc.data(), own || collab);
      }
    };
  });

  return card;
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

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
    setTimeout(() => overlay.classList.remove('open','closing'), 180);
  }

  const _orig = openPanel;
  window.openPanel = function(id) {
    _orig(id);
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

  document.getElementById('modal-saveBtn').onclick = async () => {
    if (!activeId) return;
    titleInput.value = mTitleInput.value;
    descInput.value  = mDesc.value;
    imgInput.value   = mImg.value;
    colorInput.value = mColor.value;
    document.getElementById('saveBtn').click();
    closeModal();
  };
  document.getElementById('modal-clearBtn').onclick = () => { document.getElementById('clearBtn').click(); closeModal(); };
  document.getElementById('modal-exitBtn').onclick  = () => { document.getElementById('exitBtn').click();  closeModal(); };
  if (mSplitBtn) mSplitBtn.onclick = () => { document.getElementById('splitBtn').click(); closeModal(); };
})();
