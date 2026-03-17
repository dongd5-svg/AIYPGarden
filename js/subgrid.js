// ================================================================
// SUBGRID.JS — per-tile sub-grid for plotting multiple plants
//              inside a single tile
//
// Data stored on the tile document itself:
//   subGrid: {
//     rows: number,
//     cols: number,
//     cells: { "r0c0": { title: string, color: string }, ... }
//   }
// ================================================================

// ── State ─────────────────────────────────────────────────────────
let subgridRows   = 2;
let subgridCols   = 2;
let subgridCells  = {}; // { "r0c0": { title, color } }
let editingSubCell = null; // { row, col, isMobile }

// Default cell colors to cycle through
const SUBCELL_COLORS = [
  '#d4f5d4','#ffd5a8','#fff3a8','#b3d4ff','#ffb3b3',
  '#f5d4f5','#d4e8ff','#ffe8b3','#c8f0c8','#f0c8c8',
];

// ── Wire tab buttons ──────────────────────────────────────────────
document.getElementById('tabSubgrid').onclick = () => {
  switchPanelTab('subgrid');
};

document.getElementById('mTabSubgrid').onclick = () => {
  switchMobilePanelTab('subgrid');
};

// ── Size buttons ──────────────────────────────────────────────────
document.querySelectorAll('#panelSubgrid .sg-size-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#panelSubgrid .sg-size-btn')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    subgridRows = parseInt(btn.dataset.rows);
    subgridCols = parseInt(btn.dataset.cols);
    renderSubgrid('subgridContainer', false);
  };
});

document.querySelectorAll('#mSubgridSizeBtns .sg-size-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#mSubgridSizeBtns .sg-size-btn')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    subgridRows = parseInt(btn.dataset.rows);
    subgridCols = parseInt(btn.dataset.cols);
    renderSubgrid('mSubgridContainer', true);
  };
});

// ── Save / clear buttons ──────────────────────────────────────────
document.getElementById('saveSubgridBtn').onclick  = () => saveSubgrid();
document.getElementById('clearSubgridBtn').onclick = () => {
  if (!confirm('Clear all sub-grid data for this tile?')) return;
  subgridCells = {};
  renderSubgrid('subgridContainer', false);
  saveSubgrid();
};

document.getElementById('mSaveSubgridBtn').onclick  = () => saveSubgrid();
document.getElementById('mClearSubgridBtn').onclick = () => {
  if (!confirm('Clear all sub-grid data for this tile?')) return;
  subgridCells = {};
  renderSubgrid('mSubgridContainer', true);
  saveSubgrid();
};

// ── Load sub-grid when a tile is opened ───────────────────────────
// Called from tiles.js openPanel — patched below
const _origSwitchPanelTab = window.switchPanelTab;

function loadSubgridForTile(tileId) {
  const d = tilesData[tileId] || {};
  const sg = d.subGrid;

  if (sg) {
    subgridRows  = sg.rows  || 2;
    subgridCols  = sg.cols  || 2;
    subgridCells = sg.cells ? JSON.parse(JSON.stringify(sg.cells)) : {};
  } else {
    subgridRows  = 2;
    subgridCols  = 2;
    subgridCells = {};
  }

  // Sync size button active states
  syncSizeButtons();
}

function syncSizeButtons() {
  const key = `${subgridRows}-${subgridCols}`;
  const matchMap = { '2-2':'2×2','3-3':'3×3','4-4':'4×4','3-4':'3×4','2-3':'2×3' };
  const label = matchMap[key];

  ['#panelSubgrid .sg-size-btn','#mSubgridSizeBtns .sg-size-btn'].forEach(sel => {
    document.querySelectorAll(sel).forEach(btn => {
      const isMatch = `${btn.dataset.rows}-${btn.dataset.cols}` === key;
      btn.classList.toggle('active', isMatch);
    });
  });
}

// ── Render the sub-grid ───────────────────────────────────────────
function renderSubgrid(containerId, isMobile) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${subgridCols}, 1fr)`;
  container.style.gridTemplateRows    = `repeat(${subgridRows}, 1fr)`;

  for (let r = 0; r < subgridRows; r++) {
    for (let c = 0; c < subgridCols; c++) {
      const key  = `r${r}c${c}`;
      const cell = subgridCells[key] || {};
      const div  = document.createElement('div');
      div.className = 'sg-cell';
      div.style.background = cell.color || '#f0f7e8';

      div.innerHTML = `
        <span class="sg-cell-label">${escHtml(cell.title || '')}</span>
        ${cell.title ? `<span class="sg-cell-dot"></span>` : ''}
      `;

      div.onclick = () => openSubcellEditor(r, c, isMobile);
      container.appendChild(div);
    }
  }

  // Update the main tile indicator
  updateTileSubgridIndicator();
}

// ── Sub-cell editor (inline popup) ───────────────────────────────
function openSubcellEditor(row, col, isMobile) {
  // Remove any existing editor
  document.getElementById('subcell-editor')?.remove();

  editingSubCell = { row, col, isMobile };
  const key   = `r${row}c${col}`;
  const cell  = subgridCells[key] || {};
  const containerId = isMobile ? 'mSubgridContainer' : 'subgridContainer';
  const container   = document.getElementById(containerId);
  const cells       = container.querySelectorAll('.sg-cell');
  const cellEl      = cells[row * subgridCols + col];
  if (!cellEl) return;

  const editor = document.createElement('div');
  editor.id = 'subcell-editor';
  editor.className = 'sg-cell-editor';

  editor.innerHTML = `
    <div class="sg-editor-title">Cell ${row + 1},${col + 1}</div>
    <input id="sgCellTitle" type="text" placeholder="Plant name…" value="${escHtml(cell.title || '')}" autocomplete="off"/>
    <div class="sg-color-row">
      ${SUBCELL_COLORS.map(c => `
        <button class="sg-color-swatch${cell.color === c ? ' selected' : ''}"
          style="background:${c}" data-color="${c}"></button>
      `).join('')}
    </div>
    <div class="sg-editor-actions">
      <button class="btn btn-primary sg-editor-save">✓ Apply</button>
      <button class="btn sg-editor-clear">✕ Clear</button>
    </div>
  `;

  // Position editor near the cell
  const rect      = cellEl.getBoundingClientRect();
  const panelRect = container.closest('#info-panel, #modal-box')?.getBoundingClientRect();
  editor.style.position = 'fixed';
  editor.style.zIndex   = '4000';
  editor.style.top      = `${Math.min(rect.bottom + 4, window.innerHeight - 200)}px`;
  editor.style.left     = `${Math.max(4, Math.min(rect.left, window.innerWidth - 244))}px`;

  document.body.appendChild(editor);

  // Focus input
  setTimeout(() => document.getElementById('sgCellTitle')?.focus(), 50);

  // Color swatches
  editor.querySelectorAll('.sg-color-swatch').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      editor.querySelectorAll('.sg-color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });

  // Save
  editor.querySelector('.sg-editor-save').onclick = () => {
    const title = document.getElementById('sgCellTitle').value.trim();
    const colorBtn = editor.querySelector('.sg-color-swatch.selected');
    const color    = colorBtn?.dataset.color || cell.color || SUBCELL_COLORS[0];
    subgridCells[key] = { title, color };
    editor.remove();
    renderSubgrid(containerId, isMobile);
  };

  // Clear cell
  editor.querySelector('.sg-editor-clear').onclick = () => {
    delete subgridCells[key];
    editor.remove();
    renderSubgrid(containerId, isMobile);
  };

  // Enter key saves
  editor.querySelector('#sgCellTitle').onkeydown = e => {
    if (e.key === 'Enter') editor.querySelector('.sg-editor-save').click();
    if (e.key === 'Escape') editor.remove();
  };

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function dismiss(e) {
      if (!editor.contains(e.target)) {
        editor.remove();
        document.removeEventListener('click', dismiss);
      }
    });
  }, 10);
}

// ── Save sub-grid to Firestore ────────────────────────────────────
async function saveSubgrid() {
  if (!activeId || !currentGardenId) return;

  const hasData = Object.keys(subgridCells).some(k => subgridCells[k]?.title);

  const payload = hasData
    ? { subGrid: { rows: subgridRows, cols: subgridCols, cells: subgridCells } }
    : { subGrid: null };

  try {
    await db.collection('gardens').doc(currentGardenId)
      .collection('tiles').doc(activeId).update({
        ...payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    showToast(hasData ? 'Sub-grid saved! 🔲' : 'Sub-grid cleared');
    updateTileSubgridIndicator();
  } catch (err) {
    // Tile doc might not exist yet — use set with merge
    await db.collection('gardens').doc(currentGardenId)
      .collection('tiles').doc(activeId).set({
        ...payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    showToast(hasData ? 'Sub-grid saved! 🔲' : 'Sub-grid cleared');
  }
}

// ── Show a small indicator on the main grid tile ──────────────────
function updateTileSubgridIndicator() {
  if (!activeId) return;
  const hasData = Object.keys(subgridCells).some(k => subgridCells[k]?.title);

  // Find the tile element in the main grid and toggle indicator
  const tileEl = document.querySelector(`[data-id="${activeId}"]`);
  if (!tileEl) return;
  let indicator = tileEl.querySelector('.sg-indicator');
  if (hasData && !indicator) {
    indicator = document.createElement('div');
    indicator.className = 'sg-indicator';
    indicator.title = 'Has sub-grid';
    tileEl.appendChild(indicator);
  } else if (!hasData && indicator) {
    indicator.remove();
  }
}

// ── Hook into tiles.js panel tab switching ────────────────────────
// Patch switchPanelTab to handle subgrid tab
const _origSwitchTab = window.switchPanelTab;
if (typeof switchPanelTab === 'function') {
  // Wrap after tiles.js has defined it
  const origSwitch = switchPanelTab;
  window.switchPanelTab = function(tab) {
    // Handle subgrid tab ourselves, delegate everything else
    if (tab === 'subgrid') {
      ['plot','tasks','history','subgrid'].forEach(t => {
        const el = document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1));
        if (el) el.style.display = t === 'subgrid' ? 'block' : 'none';
      });
      ['tabPlot','tabTasks','tabHistory','tabSubgrid'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === 'tabSubgrid');
      });
      // Load and render
      if (activeId) {
        loadSubgridForTile(activeId);
        renderSubgrid('subgridContainer', false);
      }
    } else {
      origSwitch(tab);
      // Hide subgrid panel when switching away
      const sgPanel = document.getElementById('panelSubgrid');
      if (sgPanel) sgPanel.style.display = 'none';
      const sgTab = document.getElementById('tabSubgrid');
      if (sgTab) sgTab.classList.remove('active');
    }
  };
}

// ── Hook into mobile tab switching in tiles.js ────────────────────
// tiles.js handles mTabPlot/mTabTasks/mTabHistory inline —
// we just need to add the subgrid tab handler
document.getElementById('mTabSubgrid').onclick = () => {
  ['mPanelPlot','mPanelTasks','mPanelHistory','mPanelSubgrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === 'mPanelSubgrid' ? 'block' : 'none';
  });
  ['mTabPlot','mTabTasks','mTabHistory','mTabSubgrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === 'mTabSubgrid');
  });
  if (activeId) {
    loadSubgridForTile(activeId);
    renderSubgrid('mSubgridContainer', true);
  }
};

// When switching to any other mobile tab, hide subgrid panel
['mTabPlot','mTabTasks','mTabHistory'].forEach(tabId => {
  const el = document.getElementById(tabId);
  if (!el) return;
  const orig = el.onclick;
  el.onclick = function(e) {
    document.getElementById('mPanelSubgrid').style.display = 'none';
    document.getElementById('mTabSubgrid').classList.remove('active');
    if (orig) orig.call(this, e);
  };
});

// ── Render sub-grid indicators on all tiles at grid render time ───
// Called by renderGrid in tiles.js after tiles are built
function applySubgridIndicators() {
  document.querySelectorAll('.tile[data-id]').forEach(tileEl => {
    const id = tileEl.dataset.id;
    const d  = tilesData[id] || {};
    const hasSubgrid = d.subGrid &&
      d.subGrid.cells &&
      Object.keys(d.subGrid.cells).some(k => d.subGrid.cells[k]?.title);

    // Remove old indicator
    tileEl.querySelector('.sg-indicator')?.remove();

    if (hasSubgrid) {
      const ind = document.createElement('div');
      ind.className = 'sg-indicator';
      ind.title = 'Has sub-grid — click to view';
      tileEl.appendChild(ind);
    }
  });
}

// Expose so tiles.js renderGrid can call it
window.applySubgridIndicators = applySubgridIndicators;
