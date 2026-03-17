// ================================================================
// PLOT-SHAPE.JS
// ================================================================

const SHAPES = [
  { key: 'rectangle',  label: 'Rectangle',  icon: '▬', defaultW: 4, defaultL: 8 },
  { key: 'square',     label: 'Square',     icon: '■', defaultW: 4, defaultL: 4 },
  { key: 'raised-bed', label: 'Raised Bed', icon: '⬛', defaultW: 3, defaultL: 6 },
  { key: 'tower',      label: 'Tower',      icon: '🏙', defaultW: 1, defaultL: 3 },
  { key: 'l-shape',    label: 'L-Shape',    icon: '⌐', defaultW: 4, defaultL: 6 },
  { key: 'u-shape',    label: 'U-Shape',    icon: '⊓', defaultW: 5, defaultL: 6 },
  { key: 'hexagon',    label: 'Hexagon',    icon: '⬡', defaultW: 4, defaultL: 4 },
  { key: 'circle',     label: 'Circle',     icon: '⬤', defaultW: 4, defaultL: 4 },
  { key: 'custom',     label: 'Custom',     icon: '✏', defaultW: 3, defaultL: 5 },
];

// State
let sgTileId = null;
let sgShape  = 'rectangle';
let sgWidth  = 4;
let sgLength = 8;
let sgUnit   = 'ft';
let sgRows   = 3;
let sgCols   = 3;
let sgCells  = {};
const SG_MIN = 1;
const SG_MAX = 10;

// ── Init ──────────────────────────────────────────────────────────
function initSubgridPanel(tileId, isMobile) {
  sgTileId = tileId;
  const d  = tilesData[tileId] || {};
  sgShape  = d.plotShape        || 'rectangle';
  sgWidth  = d.plotDims?.width  || 4;
  sgLength = d.plotDims?.length || 8;
  sgUnit   = d.plotDims?.unit   || 'ft';
  sgRows   = d.subgridRows      || 3;
  sgCols   = d.subgridCols      || 3;
  sgCells  = d.subgridCells ? JSON.parse(JSON.stringify(d.subgridCells)) : {};
  const p = isMobile ? 'm' : '';
  renderShapeSelector(p);
  syncDimInputs(p);
  wireDimInputs(p);
  renderDiagram(p);
  renderSubgrid(p);
  wireGridControls(p);
}

// ── Shape selector ────────────────────────────────────────────────
function renderShapeSelector(p) {
  const el = document.getElementById(p + 'ShapeSelector');
  if (!el) return;
  el.innerHTML = '';
  SHAPES.forEach(function(shape) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shape-btn' + (sgShape === shape.key ? ' active' : '');
    btn.innerHTML = '<span class="shape-icon">' + shape.icon + '</span><span class="shape-label">' + shape.label + '</span>';
    btn.onclick = function() {
      sgShape = shape.key;
      var s = SHAPES.find(function(x) { return x.key === shape.key; });
      if (s) { sgWidth = s.defaultW; sgLength = s.defaultL; }
      if (sgShape === 'square' || sgShape === 'circle' || sgShape === 'hexagon') sgLength = sgWidth;
      el.querySelectorAll('.shape-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      syncDimInputs(p);
      renderDiagram(p);
      applyShapeToSubgrid(p);
    };
    el.appendChild(btn);
  });
}

// ── Dimension inputs ──────────────────────────────────────────────
function syncDimInputs(p) {
  var wIn  = document.getElementById(p + 'SgWidth');
  var lIn  = document.getElementById(p + 'SgLength');
  var uIn  = document.getElementById(p + 'SgUnit');
  var lRow = document.getElementById(p + 'SgLengthRow');
  if (wIn) wIn.value = sgWidth;
  if (lIn) lIn.value = sgLength;
  if (uIn) uIn.value = sgUnit;
  var isSym   = (sgShape === 'square' || sgShape === 'circle' || sgShape === 'hexagon');
  var isTower = sgShape === 'tower';
  if (lRow) {
    lRow.style.display = isSym ? 'none' : 'flex';
    var lbl = lRow.querySelector('label');
    if (lbl) lbl.textContent = isTower ? 'Height' : 'Length';
  }
}

function wireDimInputs(p) {
  var wIn = document.getElementById(p + 'SgWidth');
  var lIn = document.getElementById(p + 'SgLength');
  var uIn = document.getElementById(p + 'SgUnit');
  if (wIn) wIn.oninput = function() {
    sgWidth = parseFloat(wIn.value) || 1;
    if (sgShape === 'square' || sgShape === 'circle' || sgShape === 'hexagon') {
      sgLength = sgWidth; if (lIn) lIn.value = sgLength;
    }
    renderDiagram(p);
  };
  if (lIn) lIn.oninput = function() { sgLength = parseFloat(lIn.value) || 1; renderDiagram(p); };
  if (uIn) uIn.onchange = function() { sgUnit = uIn.value; renderDiagram(p); };
}

// ── SVG diagram ───────────────────────────────────────────────────
function renderDiagram(p) {
  var el = document.getElementById(p + 'ShapeDiagram');
  if (!el) return;
  el.innerHTML = buildShapeSVG(sgShape, sgWidth, sgLength, sgUnit);
}

function buildShapeSVG(shape, w, l, unit) {
  var S = 160, pad = 20, inner = S - pad * 2;
  var green = '#8ecb68', fill = '#d4f5d4', txt = '#2f4f2f';
  function lbl(v, u) { return v + u; }
  var shapeEl = '', dims = '';

  if (shape === 'square' || shape === 'rectangle' || shape === 'raised-bed' || shape === 'custom') {
    var aspect = Math.min(Math.max(w / l, 0.25), 4);
    var rw = aspect >= 1 ? inner : inner * aspect;
    var rh = aspect >= 1 ? inner / aspect : inner;
    var sw = Math.min(rw, inner), sh = Math.min(rh, inner);
    var rx = pad + (inner - sw) / 2, ry = pad + (inner - sh) / 2;
    var dash = shape === 'custom' ? ' stroke-dasharray="5,3"' : '';
    shapeEl = '<rect x="' + rx + '" y="' + ry + '" width="' + sw + '" height="' + sh + '" fill="' + fill + '" stroke="' + green + '" stroke-width="2.2" rx="3"' + dash + '/>';
    dims = '<text x="' + (rx+sw/2) + '" y="' + (ry+sh+14) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif">' + lbl(w,unit) + '</text>'
         + '<text x="' + (rx-13) + '" y="' + (ry+sh/2) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif" transform="rotate(-90,' + (rx-13) + ',' + (ry+sh/2) + ')">' + lbl(l,unit) + '</text>';
  } else if (shape === 'tower') {
    var tw = inner * 0.28, th = inner * 0.9;
    var tx = pad + (inner - tw) / 2, ty = pad;
    var tiers = Math.max(2, Math.min(7, Math.round(l)));
    var tierH = th / tiers;
    shapeEl = '<rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" fill="' + fill + '" stroke="' + green + '" stroke-width="2.2" rx="3"/>';
    for (var i = 1; i < tiers; i++)
      shapeEl += '<line x1="' + tx + '" y1="' + (ty+i*tierH) + '" x2="' + (tx+tw) + '" y2="' + (ty+i*tierH) + '" stroke="' + green + '" stroke-width="1" stroke-dasharray="3,2"/>';
    dims = '<text x="' + (tx+tw/2) + '" y="' + (ty+th+14) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif">' + lbl(w,unit) + '</text>'
         + '<text x="' + (tx-13) + '" y="' + (ty+th/2) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif" transform="rotate(-90,' + (tx-13) + ',' + (ty+th/2) + ')">' + lbl(l,unit) + ' tall</text>';
  } else if (shape === 'l-shape') {
    var lw = inner * 0.88, lh = inner * 0.88;
    var aw = lw * 0.42, ah = lh * 0.42;
    var ox = pad + (inner-lw)/2, oy = pad;
    shapeEl = '<polygon points="' + ox + ',' + oy + ' ' + (ox+aw) + ',' + oy + ' ' + (ox+aw) + ',' + (oy+lh-ah) + ' ' + (ox+lw) + ',' + (oy+lh-ah) + ' ' + (ox+lw) + ',' + (oy+lh) + ' ' + ox + ',' + (oy+lh) + '" fill="' + fill + '" stroke="' + green + '" stroke-width="2.2"/>';
    dims = '<text x="' + (ox+lw/2) + '" y="' + (oy+lh+14) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif">' + lbl(w,unit) + '</text>'
         + '<text x="' + (ox-13) + '" y="' + (oy+lh/2) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif" transform="rotate(-90,' + (ox-13) + ',' + (oy+lh/2) + ')">' + lbl(l,unit) + '</text>';
  } else if (shape === 'u-shape') {
    var uw = inner * 0.88, uh = inner * 0.88;
    var ww = uw * 0.28;
    var ox2 = pad + (inner-uw)/2, oy2 = pad;
    shapeEl = '<polygon points="' + ox2 + ',' + oy2 + ' ' + (ox2+ww) + ',' + oy2 + ' ' + (ox2+ww) + ',' + (oy2+uh-ww) + ' ' + (ox2+uw-ww) + ',' + (oy2+uh-ww) + ' ' + (ox2+uw-ww) + ',' + oy2 + ' ' + (ox2+uw) + ',' + oy2 + ' ' + (ox2+uw) + ',' + (oy2+uh) + ' ' + ox2 + ',' + (oy2+uh) + '" fill="' + fill + '" stroke="' + green + '" stroke-width="2.2"/>';
    dims = '<text x="' + (ox2+uw/2) + '" y="' + (oy2+uh+14) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif">' + lbl(w,unit) + '</text>'
         + '<text x="' + (ox2-13) + '" y="' + (oy2+uh/2) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif" transform="rotate(-90,' + (ox2-13) + ',' + (oy2+uh/2) + ')">' + lbl(l,unit) + '</text>';
  } else if (shape === 'hexagon') {
    var hcx = S/2, hcy = S/2, hr = inner/2 - 2;
    var pts = '';
    for (var hi = 0; hi < 6; hi++) { var ha = Math.PI/180*(60*hi-30); pts += (hcx+hr*Math.cos(ha)) + ',' + (hcy+hr*Math.sin(ha)) + ' '; }
    shapeEl = '<polygon points="' + pts.trim() + '" fill="' + fill + '" stroke="' + green + '" stroke-width="2.2"/>';
    dims = '<text x="' + hcx + '" y="' + (hcy+hr+14) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif">⌀ ' + lbl(w,unit) + '</text>';
  } else if (shape === 'circle') {
    var ccx = S/2, ccy = S/2-4, cr = inner/2-2;
    shapeEl = '<circle cx="' + ccx + '" cy="' + ccy + '" r="' + cr + '" fill="' + fill + '" stroke="' + green + '" stroke-width="2.2"/>';
    dims = '<text x="' + ccx + '" y="' + (ccy+cr+14) + '" text-anchor="middle" font-size="10" fill="' + txt + '" font-family="sans-serif">⌀ ' + lbl(w,unit) + '</text>';
  }

  return '<svg viewBox="0 0 ' + S + ' ' + S + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;max-width:180px;max-height:180px">' + shapeEl + dims + '</svg>';
}

// ── Apply shape clip-path to subgrid container ────────────────────
function applyShapeToSubgrid(p) {
  var container = document.getElementById(p + 'subgridContainer');
  if (!container) return;
  container.style.clipPath     = '';
  container.style.borderRadius = '';
  container.style.aspectRatio  = '';

  if (sgShape === 'circle') {
    container.style.borderRadius = '50%';
    container.style.aspectRatio  = '1';
  } else if (sgShape === 'hexagon') {
    container.style.clipPath    = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    container.style.aspectRatio = '1';
  } else if (sgShape === 'l-shape') {
    container.style.clipPath = 'polygon(0% 0%, 42% 0%, 42% 58%, 100% 58%, 100% 100%, 0% 100%)';
  } else if (sgShape === 'u-shape') {
    container.style.clipPath = 'polygon(0% 0%, 28% 0%, 28% 72%, 72% 72%, 72% 0%, 100% 0%, 100% 100%, 0% 100%)';
  } else if (sgShape === 'tower') {
    container.style.aspectRatio = '1 / 2.5';
  } else if (sgShape === 'raised-bed') {
    container.style.aspectRatio = '3 / 1';
  } else if (sgShape === 'square') {
    container.style.aspectRatio = '1';
  }
}

// ── Grid resize controls ──────────────────────────────────────────
function wireGridControls(p) {
  function wire(id, fn) {
    var el = document.getElementById(p + id);
    if (el) el.onclick = fn;
  }
  wire('SgAddRow', function() { if (sgRows < SG_MAX) { sgRows++; renderSubgrid(p); } });
  wire('SgRemRow', function() { if (sgRows > SG_MIN) { pruneRow(sgRows-1); sgRows--; renderSubgrid(p); } });
  wire('SgAddCol', function() { if (sgCols < SG_MAX) { sgCols++; renderSubgrid(p); } });
  wire('SgRemCol', function() { if (sgCols > SG_MIN) { pruneCol(sgCols-1); sgCols--; renderSubgrid(p); } });
}

function updateGridCountDisplay(p) {
  var el = document.getElementById(p + 'SgGridCount');
  if (el) el.textContent = sgRows + ' \u00d7 ' + sgCols;
  var remRow = document.getElementById(p + 'SgRemRow');
  var remCol = document.getElementById(p + 'SgRemCol');
  var addRow = document.getElementById(p + 'SgAddRow');
  var addCol = document.getElementById(p + 'SgAddCol');
  if (remRow) remRow.disabled = sgRows <= SG_MIN;
  if (remCol) remCol.disabled = sgCols <= SG_MIN;
  if (addRow) addRow.disabled = sgRows >= SG_MAX;
  if (addCol) addCol.disabled = sgCols >= SG_MAX;
}

function pruneRow(row) {
  for (var c = 0; c < sgCols; c++) delete sgCells['r' + row + 'c' + c];
}
function pruneCol(col) {
  for (var r = 0; r < sgRows; r++) delete sgCells['r' + r + 'c' + col];
}

// ── Render subgrid ────────────────────────────────────────────────
function renderSubgrid(p) {
  var container = document.getElementById(p + 'subgridContainer');
  if (!container) return;
  container.innerHTML = '';
  container.style.gridTemplateColumns = 'repeat(' + sgCols + ', 1fr)';
  container.style.gridTemplateRows    = 'repeat(' + sgRows + ', 1fr)';

  for (var r = 0; r < sgRows; r++) {
    for (var c = 0; c < sgCols; c++) {
      (function(rr, cc) {
        var key  = 'r' + rr + 'c' + cc;
        var cell = sgCells[key] || {};
        var div  = document.createElement('div');
        div.className = 'sg-cell';
        div.style.background = cell.color || '#f0fae8';
        div.innerHTML = '<span class="sg-cell-label">' + escHtml(cell.label || '') + '</span>';
        div.onclick = function() { openSgCellEditor(key, p); };
        container.appendChild(div);
      })(r, c);
    }
  }

  applyShapeToSubgrid(p);
  updateGridCountDisplay(p);
}

// ── Cell editor ───────────────────────────────────────────────────
function openSgCellEditor(key, p) {
  var cell = sgCells[key] || {};
  var existing = document.getElementById('sgCellEditor');
  if (existing) existing.remove();

  var rNum = parseInt(key.match(/r(\d+)/)[1]) + 1;
  var cNum = parseInt(key.match(/c(\d+)/)[1]) + 1;

  var editor = document.createElement('div');
  editor.id = 'sgCellEditor';
  editor.className = 'sg-cell-editor';
  editor.innerHTML =
    '<div class="sg-cell-editor-header">' +
      '<strong>Row ' + rNum + ', Col ' + cNum + '</strong>' +
      '<button type="button" class="modal-close-btn" id="sgClose">\u2715</button>' +
    '</div>' +
    '<div class="field">' +
      '<label>Plant / Label</label>' +
      '<input id="sgCellLabel" type="text" value="' + escHtml(cell.label||'') + '" placeholder="e.g. Basil" autocomplete="off"/>' +
    '</div>' +
    '<div class="field">' +
      '<label>Color</label>' +
      '<div class="sg-color-row" id="sgColorRow"></div>' +
    '</div>' +
    '<div class="sg-cell-editor-actions">' +
      '<button type="button" class="btn btn-primary" id="sgSave">Save</button>' +
      '<button type="button" class="btn" id="sgClear">Clear</button>' +
    '</div>';

  var panelId = p === 'm' ? 'mPanelSubgrid' : 'panelSubgrid';
  document.getElementById(panelId).appendChild(editor);

  var colorRow = editor.querySelector('#sgColorRow');
  var COLORS = ['#d4f5d4','#fff3a8','#ffd5a8','#ffb3b3','#b3d4ff','#f5d4f5','#d4e8ff','#e8e8ff','#c8f0c8','#ffffff'];
  COLORS.forEach(function(hex) {
    var s = document.createElement('button');
    s.type = 'button';
    s.className = 'sg-color-swatch' + ((cell.color === hex) ? ' selected' : '');
    s.style.background = hex;
    s.onclick = function() {
      colorRow.querySelectorAll('.sg-color-swatch').forEach(function(x) { x.classList.remove('selected'); });
      s.classList.add('selected');
    };
    colorRow.appendChild(s);
  });

  editor.querySelector('#sgClose').onclick = function() { editor.remove(); };
  editor.querySelector('#sgSave').onclick  = function() {
    var label = document.getElementById('sgCellLabel').value.trim();
    var color = (colorRow.querySelector('.sg-color-swatch.selected') || {style:{background:'#f0fae8'}}).style.background;
    if (label || color !== 'rgb(240, 250, 232)') sgCells[key] = { label: label, color: color };
    else delete sgCells[key];
    editor.remove();
    renderSubgrid(p);
  };
  editor.querySelector('#sgClear').onclick = function() {
    delete sgCells[key];
    editor.remove();
    renderSubgrid(p);
  };

  setTimeout(function() { var inp = document.getElementById('sgCellLabel'); if(inp) inp.focus(); }, 50);
}

// ── Save / Clear ──────────────────────────────────────────────────
async function saveSubgrid(isMobile) {
  if (!sgTileId || !currentGardenId) {
    showToast('No tile selected', 'error'); return;
  }
  // Check permission before even trying
  if (typeof canEditTiles === 'function' && !canEditTiles()) {
    showToast('You don\'t have edit permission for this garden', 'error'); return;
  }
  var p   = isMobile ? 'm' : '';
  var wIn = document.getElementById(p + 'SgWidth');
  var lIn = document.getElementById(p + 'SgLength');
  var uIn = document.getElementById(p + 'SgUnit');
  if (wIn) sgWidth  = parseFloat(wIn.value)  || sgWidth;
  if (lIn) sgLength = parseFloat(lIn.value)  || sgLength;
  if (uIn) sgUnit   = uIn.value               || sgUnit;
  try {
    // Sanitize cells — remove any undefined values Firestore would reject
    var cleanCells = {};
    Object.keys(sgCells).forEach(function(k) {
      var c = sgCells[k];
      if (c && (c.label || c.color)) {
        cleanCells[k] = { label: c.label || '', color: c.color || '#f0fae8' };
      }
    });

    // Use set+merge so it works even if the tile doc hasn't been created yet
    await db.collection('gardens').doc(currentGardenId)
      .collection('tiles').doc(sgTileId).set({
        plotShape:    sgShape,
        plotDims:     { width: sgWidth, length: sgLength, unit: sgUnit },
        subgridRows:  sgRows,
        subgridCols:  sgCols,
        subgridCells: cleanCells,
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    showToast('Plot saved \uD83D\uDD32');
  } catch(e) {
    console.error('saveSubgrid error:', e.code, e.message);
    if (e.code === 'permission-denied') {
      showToast('Permission denied — are you the garden owner?', 'error');
    } else {
      showToast('Save failed: ' + e.message, 'error');
    }
  }
}

async function clearSubgrid(isMobile) {
  if (!sgTileId || !currentGardenId) return;
  sgCells = {}; sgShape = 'rectangle';
  sgWidth = 4; sgLength = 8; sgUnit = 'ft';
  sgRows = 3; sgCols = 3;
  var p = isMobile ? 'm' : '';
  renderShapeSelector(p); syncDimInputs(p); renderDiagram(p); renderSubgrid(p);
  try {
    await db.collection('gardens').doc(currentGardenId)
      .collection('tiles').doc(sgTileId).set({
        plotShape: null, plotDims: null,
        subgridRows: null, subgridCols: null, subgridCells: null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    showToast('Plot cleared');
  } catch(e) { console.error('clearSubgrid error:', e); }
}

document.getElementById('saveSubgridBtn')?.addEventListener('click',  function() { saveSubgrid(false); });
document.getElementById('clearSubgridBtn')?.addEventListener('click', function() { clearSubgrid(false); });
document.getElementById('mSaveSubgridBtn')?.addEventListener('click',  function() { saveSubgrid(true); });
document.getElementById('mClearSubgridBtn')?.addEventListener('click', function() { clearSubgrid(true); });
