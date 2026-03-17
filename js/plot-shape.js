// ================================================================
// PLOT-SHAPE.JS — per-tile shape, dimensions, and sub-grid planting
//
// Stored in Firestore under the tile doc:
//   plotShape:  'rectangle' | 'square' | 'raised-bed' | 'tower' |
//               'l-shape' | 'u-shape' | 'hexagon' | 'circle' | 'custom'
//   plotDims:   { width, length, unit } (numbers + 'ft'|'m'|'in')
//   subgridRows, subgridCols: number
//   subgridCells: { 'r0c0': { label, color }, ... }
// ================================================================

const SHAPES = [
  { key: 'rectangle',  label: 'Rectangle',    icon: '▬', defaultW: 4,  defaultL: 8  },
  { key: 'square',     label: 'Square',        icon: '■', defaultW: 4,  defaultL: 4  },
  { key: 'raised-bed', label: 'Raised Bed',    icon: '⬛', defaultW: 3,  defaultL: 6  },
  { key: 'tower',      label: 'Tower',         icon: '🏙', defaultW: 1,  defaultL: 3  },
  { key: 'l-shape',    label: 'L-Shape',       icon: '⌐', defaultW: 4,  defaultL: 6  },
  { key: 'u-shape',    label: 'U-Shape',       icon: '⊓', defaultW: 5,  defaultL: 6  },
  { key: 'hexagon',    label: 'Hexagon',       icon: '⬡', defaultW: 4,  defaultL: 4  },
  { key: 'circle',     label: 'Circle',        icon: '⬤', defaultW: 4,  defaultL: 4  },
  { key: 'custom',     label: 'Custom',        icon: '✏', defaultW: 3,  defaultL: 5  },
];

// ── State ─────────────────────────────────────────────────────────
let sgTileId      = null;
let sgShape       = 'rectangle';
let sgWidth       = 4;
let sgLength      = 8;
let sgUnit        = 'ft';
let sgRows        = 2;
let sgCols        = 2;
let sgCells       = {};   // { 'r0c0': { label, color } }
let sgEditingCell = null;

// ── Init (called from tiles.js when sub-grid tab is opened) ───────
function initSubgridPanel(tileId, isMobile) {
  sgTileId = tileId;
  const d  = tilesData[tileId] || {};

  sgShape  = d.plotShape  || 'rectangle';
  sgWidth  = d.plotDims?.width  || 4;
  sgLength = d.plotDims?.length || 8;
  sgUnit   = d.plotDims?.unit   || 'ft';
  sgRows   = d.subgridRows || 2;
  sgCols   = d.subgridCols || 2;
  sgCells  = d.subgridCells ? JSON.parse(JSON.stringify(d.subgridCells)) : {};

  const prefix = isMobile ? 'm' : '';
  renderShapeSelector(prefix);
  renderDiagram(prefix);
  renderSubgrid(prefix);
}

// ── Shape selector ────────────────────────────────────────────────
function renderShapeSelector(prefix) {
  const container = document.getElementById(`${prefix}ShapeSelector`);
  if (!container) return;
  container.innerHTML = '';
  SHAPES.forEach(shape => {
    const btn = document.createElement('button');
    btn.className = 'shape-btn' + (sgShape === shape.key ? ' active' : '');
    btn.innerHTML = `<span class="shape-icon">${shape.icon}</span><span class="shape-label">${shape.label}</span>`;
    btn.onclick = () => {
      sgShape = shape.key;
      // Pre-fill dimensions
      const s = SHAPES.find(s => s.key === shape.key);
      if (s) { sgWidth = s.defaultW; sgLength = s.defaultL; }
      // For square/circle/hexagon, sync width = length
      if (['square','circle','hexagon'].includes(shape.key)) sgLength = sgWidth;
      container.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      syncDimInputs(prefix);
      renderDiagram(prefix);
    };
    container.appendChild(btn);
  });
}

// ── Dimension inputs ──────────────────────────────────────────────
function syncDimInputs(prefix) {
  const wIn = document.getElementById(`${prefix}SgWidth`);
  const lIn = document.getElementById(`${prefix}SgLength`);
  const uIn = document.getElementById(`${prefix}SgUnit`);
  const lRow = document.getElementById(`${prefix}SgLengthRow`);

  if (wIn) wIn.value = sgWidth;
  if (lIn) lIn.value = sgLength;
  if (uIn) uIn.value = sgUnit;

  // For shapes that are symmetrical, hide length input
  const symShapes = ['square','circle','hexagon','tower'];
  const isSquare  = ['square','circle','hexagon'].includes(sgShape);
  const isTower   = sgShape === 'tower';
  if (lRow) {
    if (isSquare) {
      lRow.style.display = 'none';
    } else if (isTower) {
      lRow.style.display = 'flex';
      const lLabel = lRow.querySelector('label');
      if (lLabel) lLabel.textContent = 'Height';
    } else {
      lRow.style.display = 'flex';
      const lLabel = lRow.querySelector('label');
      if (lLabel) lLabel.textContent = 'Length';
    }
  }
}

function wireDimInputs(prefix) {
  const wIn = document.getElementById(`${prefix}SgWidth`);
  const lIn = document.getElementById(`${prefix}SgLength`);
  const uIn = document.getElementById(`${prefix}SgUnit`);

  if (wIn) wIn.oninput = () => {
    sgWidth = parseFloat(wIn.value) || 1;
    if (['square','circle','hexagon'].includes(sgShape)) { sgLength = sgWidth; if(lIn) lIn.value = sgLength; }
    renderDiagram(prefix);
  };
  if (lIn) lIn.oninput = () => { sgLength = parseFloat(lIn.value) || 1; renderDiagram(prefix); };
  if (uIn) uIn.onchange = () => { sgUnit = uIn.value; renderDiagram(prefix); };
}

// ── SVG diagram ───────────────────────────────────────────────────
function renderDiagram(prefix) {
  const container = document.getElementById(`${prefix}ShapeDiagram`);
  if (!container) return;
  container.innerHTML = '';
  const svg = buildShapeSVG(sgShape, sgWidth, sgLength, sgUnit);
  container.innerHTML = svg;
}

function buildShapeSVG(shape, w, l, unit) {
  const size  = 160; // SVG viewBox size
  const pad   = 18;
  const inner = size - pad * 2;
  const green = '#8ecb68';
  const fill  = '#d4f5d4';
  const text  = '#2f4f2f';
  const label = (val, u) => `${val}${u}`;

  let shapeEl = '';
  let dimLabels = '';

  switch (shape) {
    case 'square':
    case 'rectangle':
    case 'raised-bed': {
      const aspect = shape === 'raised-bed' ? Math.min(w/l, 0.45) : (w/l);
      const rw = shape === 'tower' ? inner * 0.3 : inner * Math.min(aspect, 1.5) / Math.max(aspect, 1/1.5) ;
      const rl = inner;
      const rx = pad + (inner - Math.min(rw, inner)) / 2;
      const ry = pad;
      const rectW = Math.min(rw, inner);
      const rectH = rl;
      shapeEl = `<rect x="${rx}" y="${ry}" width="${rectW}" height="${rectH}" fill="${fill}" stroke="${green}" stroke-width="2.5" rx="3"/>`;
      // Width label (bottom)
      dimLabels = `
        <line x1="${rx}" y1="${ry+rectH+6}" x2="${rx+rectW}" y2="${ry+rectH+6}" stroke="${green}" stroke-width="1.5" marker-start="url(#arr)" marker-end="url(#arr)"/>
        <text x="${rx+rectW/2}" y="${ry+rectH+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">${label(w,unit)}</text>
        <line x1="${rx-8}" y1="${ry}" x2="${rx-8}" y2="${ry+rectH}" stroke="${green}" stroke-width="1.5"/>
        <text x="${rx-14}" y="${ry+rectH/2}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif" transform="rotate(-90,${rx-14},${ry+rectH/2})">${label(l,unit)}</text>
      `;
      break;
    }
    case 'tower': {
      const tw = inner * 0.28;
      const th = inner * 0.92;
      const tx = pad + (inner - tw) / 2;
      const ty = pad;
      // Draw tower tiers
      const tiers = Math.max(2, Math.min(6, Math.round(l)));
      const tierH = th / tiers;
      shapeEl = `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="${fill}" stroke="${green}" stroke-width="2.5" rx="3"/>`;
      for (let i = 1; i < tiers; i++) {
        shapeEl += `<line x1="${tx}" y1="${ty + i*tierH}" x2="${tx+tw}" y2="${ty + i*tierH}" stroke="${green}" stroke-width="1" stroke-dasharray="3,2"/>`;
      }
      dimLabels = `
        <text x="${tx+tw/2}" y="${ty+th+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">${label(w,unit)}</text>
        <text x="${tx-14}" y="${ty+th/2}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif" transform="rotate(-90,${tx-14},${ty+th/2})">${label(l,unit)} tall</text>
      `;
      break;
    }
    case 'l-shape': {
      const lw = inner * 0.9;
      const lh = inner * 0.9;
      const armW = lw * 0.4;
      const armH = lh * 0.4;
      const ox = pad + (inner - lw) / 2;
      const oy = pad;
      shapeEl = `
        <polygon points="
          ${ox},${oy}
          ${ox+armW},${oy}
          ${ox+armW},${oy+lh-armH}
          ${ox+lw},${oy+lh-armH}
          ${ox+lw},${oy+lh}
          ${ox},${oy+lh}
        " fill="${fill}" stroke="${green}" stroke-width="2.5"/>
      `;
      dimLabels = `
        <text x="${ox+lw/2}" y="${oy+lh+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">${label(w,unit)}</text>
        <text x="${ox-14}" y="${oy+lh/2}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif" transform="rotate(-90,${ox-14},${oy+lh/2})">${label(l,unit)}</text>
      `;
      break;
    }
    case 'u-shape': {
      const uw = inner * 0.88;
      const uh = inner * 0.88;
      const wallW = uw * 0.25;
      const ox = pad + (inner - uw) / 2;
      const oy = pad;
      shapeEl = `
        <polygon points="
          ${ox},${oy}
          ${ox+wallW},${oy}
          ${ox+wallW},${oy+uh-wallW}
          ${ox+uw-wallW},${oy+uh-wallW}
          ${ox+uw-wallW},${oy}
          ${ox+uw},${oy}
          ${ox+uw},${oy+uh}
          ${ox},${oy+uh}
        " fill="${fill}" stroke="${green}" stroke-width="2.5"/>
      `;
      dimLabels = `
        <text x="${ox+uw/2}" y="${oy+uh+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">${label(w,unit)}</text>
        <text x="${ox-14}" y="${oy+uh/2}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif" transform="rotate(-90,${ox-14},${oy+uh/2})">${label(l,unit)}</text>
      `;
      break;
    }
    case 'hexagon': {
      const cx = size / 2, cy = size / 2;
      const r  = inner / 2;
      const pts = Array.from({length:6}, (_,i) => {
        const a = Math.PI/180 * (60*i - 30);
        return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`;
      }).join(' ');
      shapeEl = `<polygon points="${pts}" fill="${fill}" stroke="${green}" stroke-width="2.5"/>`;
      dimLabels = `<text x="${cx}" y="${cy+r+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">⌀ ${label(w,unit)}</text>`;
      break;
    }
    case 'circle': {
      const cx = size/2, cy = size/2 - 5;
      const r  = inner/2 - 2;
      shapeEl = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${green}" stroke-width="2.5"/>`;
      dimLabels = `<text x="${cx}" y="${cy+r+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">⌀ ${label(w,unit)}</text>`;
      break;
    }
    case 'custom':
    default: {
      const aspect = Math.min(Math.max(w/l, 0.3), 3);
      const rw = aspect >= 1 ? inner : inner * aspect;
      const rh = aspect >= 1 ? inner / aspect : inner;
      const rx = pad + (inner - rw) / 2;
      const ry = pad + (inner - rh) / 2;
      shapeEl = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fill}" stroke="${green}" stroke-width="2" rx="4" stroke-dasharray="6,3"/>`;
      dimLabels = `
        <text x="${rx+rw/2}" y="${ry+rh+16}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif">${label(w,unit)}</text>
        <text x="${rx-14}" y="${ry+rh/2}" text-anchor="middle" font-size="11" fill="${text}" font-family="sans-serif" transform="rotate(-90,${rx-14},${ry+rh/2})">${label(l,unit)}</text>
      `;
    }
  }

  return `
    <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;max-width:180px;max-height:180px">
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="${green}"/>
        </marker>
      </defs>
      ${shapeEl}
      ${dimLabels}
    </svg>
  `;
}

// ── Sub-grid ──────────────────────────────────────────────────────
function renderSubgrid(prefix) {
  const container = document.getElementById(`${prefix}subgridContainer`);
  if (!container) return;

  // Sync size buttons
  const sizeBtns = (prefix === 'm')
    ? document.getElementById('mSubgridSizeBtns')
    : document.querySelector('#panelSubgrid .subgrid-size-btns');

  sizeBtns?.querySelectorAll('.sg-size-btn').forEach(btn => {
    const r = +btn.dataset.rows, c = +btn.dataset.cols;
    btn.classList.toggle('active', r === sgRows && c === sgCols);
    btn.onclick = () => {
      sgRows = r; sgCols = c;
      sizeBtns.querySelectorAll('.sg-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSubgrid(prefix);
    };
  });

  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${sgCols}, 1fr)`;
  container.style.gridTemplateRows    = `repeat(${sgRows}, 1fr)`;

  for (let r = 0; r < sgRows; r++) {
    for (let c = 0; c < sgCols; c++) {
      const key  = `r${r}c${c}`;
      const cell = sgCells[key] || {};
      const div  = document.createElement('div');
      div.className = 'sg-cell';
      div.style.background = cell.color || '#f0fae8';
      div.innerHTML = `<span class="sg-cell-label">${escHtml(cell.label || '')}</span>`;
      div.onclick = () => openSgCellEditor(key, prefix);
      container.appendChild(div);
    }
  }
}

// ── Cell editor popup ─────────────────────────────────────────────
function openSgCellEditor(key, prefix) {
  sgEditingCell = key;
  const cell = sgCells[key] || {};

  const existing = document.getElementById('sgCellEditor');
  if (existing) existing.remove();

  const editor = document.createElement('div');
  editor.id = 'sgCellEditor';
  editor.className = 'sg-cell-editor';
  editor.innerHTML = `
    <div class="sg-cell-editor-header">
      <strong>Edit cell ${key}</strong>
      <button class="modal-close-btn" id="sgCellEditorClose">✕</button>
    </div>
    <div class="field">
      <label>Plant / Label</label>
      <input id="sgCellLabel" type="text" value="${escHtml(cell.label||'')}" placeholder="e.g. Basil" autocomplete="off"/>
    </div>
    <div class="field">
      <label>Color</label>
      <div class="sg-color-row" id="sgColorRow"></div>
    </div>
    <div class="sg-cell-editor-actions">
      <button class="btn btn-primary" id="sgCellSave">Save</button>
      <button class="btn" id="sgCellClear">Clear</button>
    </div>
  `;

  // Insert below the subgrid container
  const panelId = prefix === 'm' ? 'mPanelSubgrid' : 'panelSubgrid';
  document.getElementById(panelId)?.appendChild(editor);

  // Color swatches
  const colorRow = editor.querySelector('#sgColorRow');
  const cellColors = ['#d4f5d4','#fff3a8','#ffd5a8','#ffb3b3','#b3d4ff','#f5d4f5','#d4e8ff','#e8e8ff','#ffffff'];
  cellColors.forEach(hex => {
    const s = document.createElement('button');
    s.className = 'sg-color-swatch' + (hex === (cell.color||'#f0fae8') ? ' selected' : '');
    s.style.background = hex;
    s.onclick = e => {
      e.preventDefault();
      colorRow.querySelectorAll('.sg-color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
      s.dataset.selected = 'true';
    };
    colorRow.appendChild(s);
  });

  editor.querySelector('#sgCellEditorClose').onclick = () => editor.remove();
  editor.querySelector('#sgCellSave').onclick = () => {
    const label = document.getElementById('sgCellLabel').value.trim();
    const selectedColor = colorRow.querySelector('.sg-color-swatch.selected')?.style.background || '#f0fae8';
    sgCells[key] = { label, color: selectedColor };
    editor.remove();
    renderSubgrid(prefix);
  };
  editor.querySelector('#sgCellClear').onclick = () => {
    delete sgCells[key];
    editor.remove();
    renderSubgrid(prefix);
  };

  // Focus label
  setTimeout(() => document.getElementById('sgCellLabel')?.focus(), 50);
}

// ── Save ──────────────────────────────────────────────────────────
async function saveSubgrid(isMobile) {
  if (!sgTileId || !currentGardenId) return;
  const prefix = isMobile ? 'm' : '';

  // Read current dim inputs
  const wIn = document.getElementById(`${prefix}SgWidth`);
  const lIn = document.getElementById(`${prefix}SgLength`);
  const uIn = document.getElementById(`${prefix}SgUnit`);
  if (wIn) sgWidth  = parseFloat(wIn.value) || sgWidth;
  if (lIn) sgLength = parseFloat(lIn.value) || sgLength;
  if (uIn) sgUnit   = uIn.value || sgUnit;

  try {
    await db.collection('gardens').doc(currentGardenId)
      .collection('tiles').doc(sgTileId).update({
        plotShape:    sgShape,
        plotDims:     { width: sgWidth, length: sgLength, unit: sgUnit },
        subgridRows:  sgRows,
        subgridCols:  sgCols,
        subgridCells: sgCells,
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      });
    showToast('Plot shape saved 🔲');
  } catch (err) {
    showToast('Save failed — check permissions', 'error');
  }
}

async function clearSubgrid(isMobile) {
  if (!sgTileId || !currentGardenId) return;
  sgCells  = {};
  sgShape  = 'rectangle';
  sgWidth  = 4; sgLength = 8; sgUnit = 'ft';
  sgRows   = 2; sgCols   = 2;
  const prefix = isMobile ? 'm' : '';
  renderShapeSelector(prefix);
  renderDiagram(prefix);
  syncDimInputs(prefix);
  renderSubgrid(prefix);
  try {
    await db.collection('gardens').doc(currentGardenId)
      .collection('tiles').doc(sgTileId).update({
        plotShape: null, plotDims: null,
        subgridRows: null, subgridCols: null, subgridCells: null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    showToast('Plot shape cleared');
  } catch {}
}

// ── Wire buttons in HTML ──────────────────────────────────────────
document.getElementById('saveSubgridBtn')?.addEventListener('click',  () => saveSubgrid(false));
document.getElementById('clearSubgridBtn')?.addEventListener('click', () => clearSubgrid(false));
document.getElementById('mSaveSubgridBtn')?.addEventListener('click',  () => saveSubgrid(true));
document.getElementById('mClearSubgridBtn')?.addEventListener('click', () => clearSubgrid(true));
