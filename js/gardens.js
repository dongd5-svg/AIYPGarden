// ================================================================
// GARDENS.JS — garden loading, card building, create modal
// ================================================================

const myGrid        = document.getElementById('my-gardens-grid');
const sharedGrid    = document.getElementById('shared-gardens-grid');
const sharedSection = document.getElementById('shared-section');
const emptyState    = document.getElementById('empty-state');
const publicGrid    = document.getElementById('public-gardens-grid');
const publicEmpty   = document.getElementById('public-empty-state');

document.getElementById('createGardenBtn').onclick = openCreateModal;
document.getElementById('emptyCreateBtn').onclick  = openCreateModal;

let myGardensUnsub    = null;
let sharedGardensInt  = null;

// ── Load my gardens ───────────────────────────────────────────────
function loadMyGardens() {
  if (myGardensUnsub)   myGardensUnsub();
  if (sharedGardensInt) clearInterval(sharedGardensInt);

  const renderOwned = snap => {
    myGrid.innerHTML = '';
    emptyState.style.display = snap.empty ? 'block' : 'none';
    snap.forEach(doc => myGrid.appendChild(buildGardenCard(doc.id, doc.data(), true)));
  };

  const handleError = err => {
    console.error('My gardens error:', err);
    // If index missing, fall back to unordered query
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      console.warn('Index missing — falling back to unordered query');
      db.collection('gardens')
        .where('ownerId', '==', currentUser.uid)
        .get()
        .then(renderOwned)
        .catch(e => {
          console.error('Fallback also failed:', e);
          emptyState.style.display = 'block';
          emptyState.querySelector('p').textContent =
            'Could not load gardens. Check your connection and try refreshing.';
        });
    } else {
      emptyState.style.display = 'block';
    }
  };

  myGardensUnsub = db.collection('gardens')
    .where('ownerId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(renderOwned, handleError);

  // Shared / collaborator — polled every 30s
  const loadShared = () => {
    db.collection('gardens')
      .where('collaboratorEmails', 'array-contains', currentUser.email)
      .get()
      .then(snap => {
        sharedGrid.innerHTML = '';
        sharedSection.style.display = snap.empty ? 'none' : 'block';
        snap.forEach(doc => sharedGrid.appendChild(buildGardenCard(doc.id, doc.data(), false)));
      })
      .catch(() => { sharedSection.style.display = 'none'; });
  };
  loadShared();
  sharedGardensInt = setInterval(loadShared, 30000);
}

// ── Load public gardens ───────────────────────────────────────────
function loadPublicGardens() {
  db.collection('gardens').where('visibility', '==', 'public').get().then(snap => {
    publicGrid.innerHTML = '';
    publicEmpty.style.display = snap.empty ? 'block' : 'none';
    snap.forEach(doc => {
      const isOwn = currentUser && doc.data().ownerId === currentUser.uid;
      publicGrid.appendChild(buildGardenCard(doc.id, doc.data(), isOwn));
    });
  });
}

// ── Build garden card ─────────────────────────────────────────────
function buildGardenCard(gardenId, data, isOwn) {
  const card = document.createElement('div');
  card.className = 'garden-card';

  const rows = data.rows || 6, cols = data.cols || 6;
  const pR = Math.min(rows, 12), pC = Math.min(cols, 12);

  // Mini preview grid
  const preview = document.createElement('div');
  preview.className = 'garden-card-preview';
  preview.style.gridTemplateColumns = `repeat(${pC},1fr)`;
  preview.style.gridTemplateRows    = `repeat(${pR},1fr)`;
  const cellMap = {};
  for (let r = 0; r < pR; r++) for (let c = 0; c < pC; c++) {
    const cell = document.createElement('div');
    cell.className = 'mini-tile';
    cellMap[`r${r}c${c}`] = cell;
    preview.appendChild(cell);
  }

  // Fetch tile colors async
  db.collection('gardens').doc(gardenId).collection('tiles').get().then(snap => {
    snap.forEach(doc => {
      if (cellMap[doc.id] && doc.data().color)
        cellMap[doc.id].style.background = doc.data().color;
    });
  });

  // isCollab: user is a listed collaborator but NOT the owner
  const isCollab = !isOwn && currentUser &&
    (data.collaboratorEmails || []).includes(currentUser.email || '');

  const badge = data.visibility === 'public'
    ? '<span class="garden-card-badge badge-public">🌍 Public</span>'
    : isCollab
      ? '<span class="garden-card-badge badge-collab">✏ Collab</span>'
      : '<span class="garden-card-badge badge-private">🔒 Private</span>';

  const ownerLine = (!isOwn && data.ownerName)
    ? `<div class="garden-card-owner">by ${escHtml(data.ownerName)}</div>` : '';

  // Task count badge
  const taskCount = document.createElement('span');
  taskCount.className = 'garden-task-count';
  taskCount.style.display = 'none';
  db.collection('gardens').doc(gardenId).collection('tasks')
    .where('status', '!=', 'done').get()
    .then(snap => {
      if (snap.size > 0) {
        taskCount.textContent = `📋 ${snap.size} task${snap.size > 1 ? 's' : ''}`;
        taskCount.style.display = 'inline';
      }
    }).catch(() => {});

  card.innerHTML = `
    <div class="garden-card-meta">${badge}<span>${rows}×${cols}</span></div>
    <h3>${escHtml(data.name || 'Unnamed Garden')}</h3>
    ${ownerLine}
  `;
  card.querySelector('.garden-card-meta').appendChild(taskCount);
  card.insertBefore(preview, card.firstChild);
  card.onclick = () => openGardenPage(gardenId, data, isOwn);
  return card;
}

// ── Create garden modal ───────────────────────────────────────────
const createOverlay    = document.getElementById('create-modal-overlay');
const gardenNameInput  = document.getElementById('gardenNameInput');
const gridRowsInput    = document.getElementById('gridRows');
const gridColsInput    = document.getElementById('gridCols');
const gridPreviewEl    = document.getElementById('gridPreview');
const gridPreviewLabel = document.getElementById('gridPreviewLabel');
let selectedVisibility = 'private';
let selectedShape      = 'square';

// ── Shape definitions ─────────────────────────────────────────────
// Each shape defines rows, cols, and optionally a set of disabled
// tile IDs (rRcC format) that are "inactive" (hollow area)
const GARDEN_SHAPES = {
  square:  { rows: 6,  cols: 6,  label: '6×6',    disabled: [] },
  wide:    { rows: 4,  cols: 10, label: '4×10',   disabled: [] },
  tall:    { rows: 10, cols: 4,  label: '10×4',   disabled: [] },
  tower:   { rows: 12, cols: 2,  label: '12×2',   disabled: [] },
  strip:   { rows: 2,  cols: 10, label: '2×10',   disabled: [] },
  lshape:  { rows: 6,  cols: 6,  label: 'L-shape',
    disabled: ['r0c3','r0c4','r0c5','r1c3','r1c4','r1c5','r2c3','r2c4','r2c5'] },
  ushape:  { rows: 6,  cols: 6,  label: 'U-shape',
    disabled: ['r0c2','r0c3','r1c2','r1c3','r2c2','r2c3','r3c2','r3c3'] },
  custom:  { rows: 6,  cols: 6,  label: 'Custom',  disabled: [] },
};

function openCreateModal() {
  gardenNameInput.value = '';
  gridRowsInput.value   = '6';
  gridColsInput.value   = '6';
  selectedVisibility    = 'private';
  selectedShape         = 'square';
  document.getElementById('visPrivate').classList.add('active');
  document.getElementById('visPublic').classList.remove('active');
  document.querySelectorAll('.shape-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.shape === 'square'));
  document.getElementById('customSizeInputs').style.display = 'none';
  updateGridPreview();
  createOverlay.classList.add('open');
  setTimeout(() => gardenNameInput.focus(), 200);
}

document.getElementById('createModalCloseBtn').onclick = () => createOverlay.classList.remove('open');
createOverlay.addEventListener('click', e => {
  if (e.target === createOverlay) createOverlay.classList.remove('open');
});

// Shape picker
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.onclick = () => {
    selectedShape = btn.dataset.shape;
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const shape = GARDEN_SHAPES[selectedShape];
    const isCustom = selectedShape === 'custom';
    document.getElementById('customSizeInputs').style.display = isCustom ? 'block' : 'none';
    if (!isCustom) {
      gridRowsInput.value = shape.rows;
      gridColsInput.value = shape.cols;
    }
    updateGridPreview();
  };
});

// Custom size steppers
document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.onclick = () => {
    const t = document.getElementById(btn.dataset.target);
    t.value = Math.min(+t.max||20, Math.max(+t.min||1, +t.value + +btn.dataset.dir));
    updateGridPreview();
  };
});
gridRowsInput.addEventListener('input', updateGridPreview);
gridColsInput.addEventListener('input', updateGridPreview);

function updateGridPreview() {
  const shape    = GARDEN_SHAPES[selectedShape] || GARDEN_SHAPES.custom;
  const r        = Math.min(20, Math.max(1, +gridRowsInput.value || shape.rows));
  const c        = Math.min(20, Math.max(1, +gridColsInput.value || shape.cols));
  const disabled = new Set(shape.disabled || []);

  const dispR = Math.min(r, 12);
  const dispC = Math.min(c, 12);
  gridPreviewEl.style.gridTemplateColumns = `repeat(${dispC},1fr)`;
  gridPreviewEl.style.gridTemplateRows    = `repeat(${dispR},1fr)`;
  gridPreviewEl.innerHTML = '';

  let activePlots = 0;
  for (let ri = 0; ri < dispR; ri++) {
    for (let ci = 0; ci < dispC; ci++) {
      const cell = document.createElement('div');
      const id   = `r${ri}c${ci}`;
      if (disabled.has(id)) {
        cell.className = 'preview-cell preview-cell-disabled';
      } else {
        cell.className = 'preview-cell';
        activePlots++;
      }
      gridPreviewEl.appendChild(cell);
    }
  }
  const totalPlots = r * c - disabled.size;
  gridPreviewLabel.textContent = `${totalPlots} plot${totalPlots !== 1 ? 's' : ''}`;
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

  const shape = GARDEN_SHAPES[selectedShape] || GARDEN_SHAPES.custom;
  const rows  = Math.min(20, Math.max(1, +gridRowsInput.value || shape.rows));
  const cols  = Math.min(20, Math.max(1, +gridColsInput.value || shape.cols));
  const disabledTiles = shape.disabled || [];

  const btn = document.getElementById('confirmCreateGardenBtn');
  btn.disabled = true;
  try {
    const gardenDoc = {
      name, rows, cols,
      shape:              selectedShape,
      disabledTiles,
      ownerId:            currentUser.uid,
      ownerName:          currentUser.displayName || currentUser.email,
      ownerEmail:         currentUser.email,
      visibility:         selectedVisibility,
      publicPermission:   'viewonly',
      collaboratorEmails: [],
      taskDisplayMode:    'color',
      companionPlanting:  true,
      showWeather:        true,
      currentSeason:      'spring',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('gardens').add(gardenDoc);
    createOverlay.classList.remove('open');
    showToast('Garden created! 🌱');
    openGardenPage(docRef.id, { ...gardenDoc }, true);
      ownerId: currentUser.uid,
      visibility: selectedVisibility,
      publicPermission: 'viewonly',
      collaboratorEmails: [],
      taskDisplayMode: 'color',
      companionPlanting: true,
      showWeather: true,
      currentSeason: 'spring'
    }, true);
  } finally {
    btn.disabled = false;
  }
};
