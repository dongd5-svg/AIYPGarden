// ---------------- AUTH ----------------
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const loginGate = document.getElementById('loginGate');
const signOutBtn = document.getElementById('signOutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');

document.getElementById('googleBtn').onclick = () => {
  auth.signInWithPopup(provider).catch(err => alert(err.message));
};

signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    loginGate.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    userNameDisplay.textContent = user.displayName || user.email;
    if (user.photoURL) document.getElementById('profileImg').src = user.photoURL;
  } else {
    loginGate.style.display = 'flex';
    signOutBtn.style.display = 'none';
    userNameDisplay.textContent = '';
    document.getElementById('profileImg').src = '';
  }
});

// ---------------- FIREBASE ----------------
const db = firebase.firestore();
const gardenRef = db.collection("gardenTiles");

// ---------------- ELEMENTS ----------------
const garden        = document.getElementById('garden-container');
const editInfo      = document.getElementById('editInfo');
const defaultInfo   = document.getElementById('defaultInfo');
const titleInput    = document.getElementById('titleInput');
const descInput     = document.getElementById('descInput');
const imgInput      = document.getElementById('imgInput');
const colorInput    = document.getElementById('colorInput');
const saveBtn       = document.getElementById('saveBtn');
const clearBtn      = document.getElementById('clearBtn');
const exitBtn       = document.getElementById('exitBtn');
const splitBtn      = document.getElementById('splitBtn');

let tilesData = {};
let activeId  = null;

function tileId(r, c) { return `r${r}c${c}`; }
function tileRC(id)   { return { r: parseInt(id.match(/r(\d+)/)[1]), c: parseInt(id.match(/c(\d+)/)[1]) }; }

// ---------------- REALTIME SYNC ----------------
gardenRef.onSnapshot(snapshot => {
  tilesData = {};
  snapshot.forEach(doc => { tilesData[doc.id] = doc.data(); });
  renderGrid();
});

// ---------------- RENDER GRID ----------------
function renderGrid() {
  garden.innerHTML = '';

  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 12; c++) {
      const id = tileId(r, c);
      const d  = tilesData[id] || {};
      const div = document.createElement('div');

      div.className = 'tile';
      div.dataset.id = id;
      div.style.background = d.color || '#e8ffd6';

      // Only show text on the "primary" tile of a merge group
      // (top-left-most tile) so text doesn't repeat on every cell
      const group = d.mergeGroup;
      if (group) {
        const isLeader = isMergeLeader(id, group);
        div.textContent = isLeader ? (d.title || '') : '';
        if (!d.title) div.classList.add('empty');
      } else {
        div.textContent = d.title || '';
        if (!d.title) div.classList.add('empty');
      }

      // Merged border hiding
      applyMergeBorderClasses(div, id, r, c);

      if (id === activeId) div.classList.add('active');

      div.onclick = () => handleTileClick(id);
      garden.appendChild(div);
    }
  }

  // Re-apply merge mode UI if active
  if (mergeMode) applyMergeModeUI();
}

// Returns true if this tile is the top-left-most in its merge group
function isMergeLeader(id, group) {
  const members = Object.keys(tilesData).filter(k => tilesData[k].mergeGroup === group);
  // Sort by row then col; first one is the leader
  members.sort((a, b) => {
    const ra = tileRC(a), rb = tileRC(b);
    return ra.r !== rb.r ? ra.r - rb.r : ra.c - rb.c;
  });
  return members[0] === id;
}

// Hides the border between two merged tiles
function applyMergeBorderClasses(div, id, r, c) {
  const d = tilesData[id] || {};
  const g = d.mergeGroup;
  if (!g) return;

  const top    = r > 0  ? (tilesData[tileId(r-1, c)] || {}) : {};
  const bottom = r < 11 ? (tilesData[tileId(r+1, c)] || {}) : {};
  const left   = c > 0  ? (tilesData[tileId(r, c-1)] || {}) : {};
  const right  = c < 11 ? (tilesData[tileId(r, c+1)] || {}) : {};

  if (top.mergeGroup    === g) div.classList.add('merge-top');
  if (bottom.mergeGroup === g) div.classList.add('merge-bottom');
  if (left.mergeGroup   === g) div.classList.add('merge-left');
  if (right.mergeGroup  === g) div.classList.add('merge-right');
}

// ---------------- OPEN PANEL ----------------
function openPanel(id) {
  activeId = id;
  defaultInfo.style.display = 'none';
  editInfo.style.display    = 'block';

  // Highlight active tile
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  const { r, c } = tileRC(id);
  const tiles = document.querySelectorAll('.tile');
  if (tiles[r * 12 + c]) tiles[r * 12 + c].classList.add('active');

  const d = tilesData[id] || {};
  titleInput.value  = d.title       || '';
  descInput.value   = d.description || '';
  imgInput.value    = d.imageUrl    || '';
  colorInput.value  = d.color       || '#e8ffd6';

  // Show split button only if this tile is part of a merge group
  splitBtn.style.display = d.mergeGroup ? 'inline-block' : 'none';
}

// ---------------- TILE CLICK ----------------
function handleTileClick(id) {
  if (mergeMode) {
    toggleMergeSelection(id);
  } else {
    openPanel(id);
  }
}

// ---------------- SAVE ----------------
saveBtn.onclick = async () => {
  if (!activeId) return;
  const d = tilesData[activeId] || {};
  const payload = {
    title:       titleInput.value.trim(),
    description: descInput.value.trim(),
    imageUrl:    imgInput.value.trim(),
    color:       colorInput.value,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  // If part of a merge group, save to ALL tiles in the group
  if (d.mergeGroup) {
    const batch = db.batch();
    Object.keys(tilesData).forEach(k => {
      if (tilesData[k].mergeGroup === d.mergeGroup) {
        batch.set(gardenRef.doc(k), { ...payload, mergeGroup: d.mergeGroup });
      }
    });
    await batch.commit();
  } else {
    await gardenRef.doc(activeId).set(payload);
  }
};

// ---------------- CLEAR ----------------
clearBtn.onclick = async () => {
  if (!activeId) return;
  const d = tilesData[activeId] || {};

  // If part of a merge group, clear ALL tiles in the group
  if (d.mergeGroup) {
    const batch = db.batch();
    Object.keys(tilesData).forEach(k => {
      if (tilesData[k].mergeGroup === d.mergeGroup) {
        batch.delete(gardenRef.doc(k));
      }
    });
    await batch.commit();
  } else {
    await gardenRef.doc(activeId).delete();
  }

  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  activeId = null;
  editInfo.style.display  = 'none';
  defaultInfo.style.display = 'block';
};

// ---------------- EXIT ----------------
exitBtn.onclick = () => {
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  activeId = null;
  editInfo.style.display  = 'none';
  defaultInfo.style.display = 'block';
};

// ---------------- SPLIT ----------------
splitBtn.onclick = async () => {
  if (!activeId) return;
  const d = tilesData[activeId] || {};
  if (!d.mergeGroup) return;

  const batch = db.batch();
  Object.keys(tilesData).forEach(k => {
    if (tilesData[k].mergeGroup === d.mergeGroup) {
      // Keep title/desc/color but remove mergeGroup
      const { mergeGroup, ...rest } = tilesData[k];
      batch.set(gardenRef.doc(k), { ...rest, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();

  splitBtn.style.display = 'none';
};

// ================================================================
// ---------------- MERGE MODE ------------------------------------
// ================================================================

let mergeMode     = false;
let mergeSelected = new Set(); // Set of tile IDs selected for merging

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
    // Close any open panel
    editInfo.style.display  = 'none';
    defaultInfo.style.display = 'block';
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
    activeId = null;
    mergeToolbar.classList.add('visible');
    updateMergeToolbar();
    applyMergeModeUI();
  } else {
    mergeToolbar.classList.remove('visible');
    // Clear all merge-mode classes
    document.querySelectorAll('.tile').forEach(t => {
      t.classList.remove('merge-selected', 'merge-eligible', 'merge-ineligible');
    });
  }
}

// Determines which tiles are eligible to be added to the current selection.
// A tile is eligible if it shares at least one edge with an already-selected tile
// AND is not already part of a DIFFERENT merge group from any selected tile.
function getEligibleIds() {
  // Figure out if the selection is locked to a merge group
  let lockedGroup = null;
  mergeSelected.forEach(id => {
    const g = (tilesData[id] || {}).mergeGroup;
    if (g) lockedGroup = g;
  });

  const eligible = new Set();

  if (mergeSelected.size === 0) {
    // All tiles are eligible to start
    for (let r = 0; r < 12; r++)
      for (let c = 0; c < 12; c++)
        eligible.add(tileId(r, c));
  } else {
    // Expand from selected tiles — flood-fill neighbours
    mergeSelected.forEach(id => {
      const { r, c } = tileRC(id);
      const neighbours = [];
      if (r > 0)  neighbours.push(tileId(r-1, c));
      if (r < 11) neighbours.push(tileId(r+1, c));
      if (c > 0)  neighbours.push(tileId(r, c-1));
      if (c < 11) neighbours.push(tileId(r, c+1));
      neighbours.forEach(n => {
        if (!mergeSelected.has(n)) eligible.add(n);
      });
    });

    // Remove tiles that belong to a DIFFERENT merge group
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
    if (mergeSelected.has(id)) {
      div.classList.add('merge-selected');
    } else if (eligible.has(id)) {
      div.classList.add('merge-eligible');
    } else {
      div.classList.add('merge-ineligible');
    }
  });
}

function toggleMergeSelection(id) {
  if (mergeSelected.has(id)) {
    // Deselect — but only if removing it doesn't disconnect the remaining group
    mergeSelected.delete(id);
    if (mergeSelected.size > 0 && !isConnected(mergeSelected)) {
      // Reconnect — put it back
      mergeSelected.add(id);
    }
  } else {
    const eligible = getEligibleIds();
    if (!eligible.has(id)) return; // not allowed
    mergeSelected.add(id);
  }
  applyMergeModeUI();
  updateMergeToolbar();
}

// BFS connectivity check — ensures all selected tiles form one connected group
function isConnected(ids) {
  if (ids.size <= 1) return true;
  const arr = [...ids];
  const visited = new Set();
  const queue = [arr[0]];
  visited.add(arr[0]);
  while (queue.length) {
    const cur = queue.shift();
    const { r, c } = tileRC(cur);
    const neighbours = [];
    if (r > 0)  neighbours.push(tileId(r-1, c));
    if (r < 11) neighbours.push(tileId(r+1, c));
    if (c > 0)  neighbours.push(tileId(r, c-1));
    if (c < 11) neighbours.push(tileId(r, c+1));
    neighbours.forEach(n => {
      if (ids.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    });
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

// ---------------- CONFIRM MERGE ----------------
mergeConfirmBtn.onclick = async () => {
  if (mergeSelected.size < 2) return;

  // Check if any selected tile already has a mergeGroup — reuse it, else create new
  let group = null;
  mergeSelected.forEach(id => {
    const g = (tilesData[id] || {}).mergeGroup;
    if (g) group = g;
  });
  if (!group) group = crypto.randomUUID();

  // Use the data from the "leader" tile (top-left-most selected)
  const sortedIds = [...mergeSelected].sort((a, b) => {
    const ra = tileRC(a), rb = tileRC(b);
    return ra.r !== rb.r ? ra.r - rb.r : ra.c - rb.c;
  });
  const leaderData = tilesData[sortedIds[0]] || {};

  const batch = db.batch();
  mergeSelected.forEach(id => {
    const existing = tilesData[id] || {};
    batch.set(gardenRef.doc(id), {
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

// ---------------- CANCEL MERGE ----------------
mergeCancelBtn.onclick = () => toggleMergeMode(false);

// ================================================================
// ---------------- MOBILE MODAL BRIDGE --------------------------
// ================================================================
(function(){
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
      document.body.classList.remove('modal-open');
    }, 180);
  }

  const _origOpen = openPanel;
  window.openPanel = function(id) {
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
    document.body.classList.add('modal-open');
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById('modal-saveBtn').onclick = async function() {
    if (!activeId) return;
    titleInput.value = mTitleInput.value;
    descInput.value  = mDesc.value;
    imgInput.value   = mImg.value;
    colorInput.value = mColor.value;
    saveBtn.click();
    closeModal();
  };

  document.getElementById('modal-clearBtn').onclick = function() {
    clearBtn.click();
    closeModal();
  };

  document.getElementById('modal-exitBtn').onclick = function() {
    exitBtn.click();
    closeModal();
  };

  if (mSplitBtn) {
    mSplitBtn.onclick = function() {
      splitBtn.click();
      closeModal();
    };
  }
})();
