// ================================================================
// ADVANCED.JS — crop rotation tracker, succession planting,
//               soil amendment log
// Advanced mode features only
// ================================================================

// ── Plant family database ─────────────────────────────────────────
// Rotating plant families prevents disease and nutrient depletion
const PLANT_FAMILIES = {
  solanaceae:  { name: 'Nightshades',   color: '#ffb3b3', emoji: '🍅', members: ['tomato','tomatoes','pepper','peppers','potato','potatoes','eggplant'], restYears: 3, warning: 'Risk of blight and soilborne disease. Rest bed for 3 years.' },
  brassicaceae:{ name: 'Brassicas',     color: '#b3d4ff', emoji: '🥦', members: ['broccoli','cabbage','cauliflower','kale','kohlrabi','brussels sprouts','radish','radishes','turnip','arugula'], restYears: 2, warning: 'Risk of clubroot and cabbage root fly. Rest bed for 2 years.' },
  cucurbitaceae:{ name: 'Cucurbits',    color: '#ffd5a8', emoji: '🥒', members: ['cucumber','cucumbers','zucchini','squash','pumpkin','pumpkins','watermelon','melon'], restYears: 2, warning: 'Risk of cucumber mosaic virus and powdery mildew.' },
  fabaceae:    { name: 'Legumes',       color: '#d4f5d4', emoji: '🫘', members: ['bean','beans','pea','peas','broadbean','broad bean','soybean'], restYears: 1, warning: 'Nitrogen-fixing — beneficial to follow brassicas and heavy feeders.' },
  apiaceae:    { name: 'Umbellifers',   color: '#fff3a8', emoji: '🥕', members: ['carrot','carrots','celery','parsley','dill','fennel','parsnip','cilantro','coriander'], restYears: 2, warning: 'Risk of carrot fly and root diseases.' },
  alliaceae:   { name: 'Alliums',       color: '#f5d4f5', emoji: '🧅', members: ['onion','onions','garlic','leek','leeks','shallot','shallots','chive','chives'], restYears: 2, warning: 'Risk of white rot and onion fly. Avoid planting after legumes.' },
  asteraceae:  { name: 'Composites',    color: '#ffe8b3', emoji: '🌻', members: ['lettuce','sunflower','sunflowers','artichoke','endive','chicory','marigold','marigolds','nasturtium','dahlia'], restYears: 1, warning: 'Generally low disease risk. Good rotation crops.' },
  poaceae:     { name: 'Grasses/Corn',  color: '#e8e8ff', emoji: '🌽', members: ['corn','maize','wheat','barley'], restYears: 2, warning: 'Heavy nitrogen feeder. Follow with legumes.' },
  other:       { name: 'Other',         color: '#e8e8e8', emoji: '🌱', members: [], restYears: 1, warning: 'No specific rotation concerns.' },
};

function getPlantFamily(plantName) {
  if (!plantName) return 'other';
  const lower = plantName.toLowerCase().trim();
  for (const [key, fam] of Object.entries(PLANT_FAMILIES)) {
    if (fam.members.some(m => lower.includes(m) || m.includes(lower))) return key;
  }
  return 'other';
}

// ════════════════════════════════════════════════════════════════
// CROP ROTATION TRACKER
// ════════════════════════════════════════════════════════════════
let crYear = new Date().getFullYear();
let crUnsub = null;
let crData  = {}; // { tileId_year: { plant, family, year, tileId } }

document.getElementById('gardenCropRotationBtn').onclick = openCropRotation;

function openCropRotation() {
  if (!currentGardenId) return;
  if (!isFeatureEnabled('cropRotation')) return;
  crYear = new Date().getFullYear();
  document.getElementById('cropRotationGardenName').textContent = currentGardenData?.name || '';
  document.getElementById('crop-rotation-overlay').style.display = 'flex';
  loadCropRotationData();
  renderCrLegend();
}

document.getElementById('cropRotationCloseBtn').onclick = closeCropRotation;
document.getElementById('crop-rotation-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('crop-rotation-overlay')) closeCropRotation();
});

function closeCropRotation() {
  document.getElementById('crop-rotation-overlay').style.display = 'none';
  if (crUnsub) { crUnsub(); crUnsub = null; }
}

document.getElementById('crPrevYear').onclick = () => { crYear--; updateCrYearLabel(); renderCrGrid(); };
document.getElementById('crNextYear').onclick = () => { crYear++; updateCrYearLabel(); renderCrGrid(); };

function updateCrYearLabel() {
  document.getElementById('crYearLabel').textContent = crYear;
}

async function loadCropRotationData() {
  updateCrYearLabel();
  // Load all rotation records for this garden
  const snap = await db.collection('gardens').doc(currentGardenId)
    .collection('cropRotation').get();
  crData = {};
  snap.forEach(doc => { crData[doc.id] = doc.data(); });

  // Also populate from current tile data for current year
  const currentYear = new Date().getFullYear();
  Object.entries(tilesData).forEach(([tileId, tile]) => {
    if (!tile.title) return;
    const key = `${tileId}_${currentYear}`;
    if (!crData[key]) {
      crData[key] = { tileId, plant: tile.title, family: getPlantFamily(tile.title), year: currentYear };
    }
  });

  renderCrGrid();
}

function renderCrGrid() {
  const grid = document.getElementById('cr-grid');
  if (!grid || !currentGardenData) return;

  const rows = currentGardenData.rows || 6;
  const cols = currentGardenData.cols || 6;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';

  // Show years: crYear-2, crYear-1, crYear (3-column per tile is complex for small screens)
  // Instead render the grid for crYear, with warnings based on history
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileId = `r${r}c${c}`;
      const tile   = tilesData[tileId] || {};

      // Get rotation history for this tile
      const history = [];
      for (let y = crYear - 3; y < crYear; y++) {
        const rec = crData[`${tileId}_${y}`];
        if (rec) history.push({ year: y, ...rec });
      }
      const current = crData[`${tileId}_${crYear}`];

      // Rotation warning check
      let warning = null;
      if (current) {
        const fam = getPlantFamily(current.plant);
        const famData = PLANT_FAMILIES[fam];
        const sameFamily = history.filter(h => getPlantFamily(h.plant) === fam);
        const yearsAgo = sameFamily.length ? crYear - Math.max(...sameFamily.map(h => h.year)) : 999;
        if (sameFamily.length && yearsAgo < famData.restYears) {
          warning = { text: `Same family ${yearsAgo}yr ago`, detail: famData.warning };
        }
      }

      const fam    = current ? getPlantFamily(current.plant) : 'other';
      const famDat = PLANT_FAMILIES[fam];
      const bg     = current ? famDat.color : 'var(--bg)';

      const cell = document.createElement('div');
      cell.className = 'cr-cell' + (warning ? ' cr-warning' : '');
      cell.style.background = bg;
      cell.title = warning ? warning.detail : (current?.plant || 'Empty');

      cell.innerHTML = `
        <div class="cr-cell-current">${current ? `${famDat.emoji} ${escHtml(current.plant)}` : ''}</div>
        ${history.length ? `<div class="cr-cell-history">${history.slice(-2).map(h => `<span>${h.year}: ${escHtml(h.plant||'')}</span>`).join('')}</div>` : ''}
        ${warning ? `<div class="cr-cell-warn">⚠ ${warning.text}</div>` : ''}
        ${crYear === new Date().getFullYear() ? '' : `<button class="cr-cell-edit-btn" data-tile="${tileId}">✏</button>`}
      `;

      // Click to edit rotation record (past years)
      if (crYear !== new Date().getFullYear()) {
        cell.querySelector('.cr-cell-edit-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          editCrRecord(tileId, crYear);
        });
      }

      grid.appendChild(cell);
    }
  }
}

async function editCrRecord(tileId, year) {
  const existing = crData[`${tileId}_${year}`];
  const plant = prompt(`What was planted in tile ${tileId} in ${year}?`, existing?.plant || '');
  if (plant === null) return;

  const key = `${tileId}_${year}`;
  const record = { tileId, plant: plant.trim(), family: getPlantFamily(plant), year };

  await db.collection('gardens').doc(currentGardenId)
    .collection('cropRotation').doc(key).set(record);

  crData[key] = record;
  renderCrGrid();
  showToast(`Rotation record saved for ${year} 🔄`);
}

function renderCrLegend() {
  const grid = document.getElementById('crLegendGrid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.entries(PLANT_FAMILIES).forEach(([key, fam]) => {
    if (key === 'other') return;
    const row = document.createElement('div');
    row.className = 'cr-legend-item';
    row.innerHTML = `
      <span class="cr-legend-swatch" style="background:${fam.color}"></span>
      <span class="cr-legend-name">${fam.emoji} ${fam.name}</span>
      <span class="cr-legend-rest">Rest ${fam.restYears}yr</span>
      <span class="cr-legend-members">${fam.members.slice(0,4).join(', ')}…</span>
    `;
    grid.appendChild(row);
  });
}

// Auto-save rotation record when a tile is saved
function saveCropRotationRecord(tileId, plantName) {
  if (!isFeatureEnabled('cropRotation') || !currentGardenId || !plantName) return;
  const year = new Date().getFullYear();
  const key  = `${tileId}_${year}`;
  const record = { tileId, plant: plantName, family: getPlantFamily(plantName), year };
  db.collection('gardens').doc(currentGardenId)
    .collection('cropRotation').doc(key).set(record);
}

// ════════════════════════════════════════════════════════════════
// SUCCESSION PLANTING
// ════════════════════════════════════════════════════════════════
let sucPlans  = [];
let sucUnsub  = null;

document.getElementById('gardenSuccessionBtn').onclick = openSuccession;

function openSuccession() {
  if (!currentGardenId) return;
  if (!isFeatureEnabled('succession')) return;
  document.getElementById('successionGardenName').textContent = currentGardenData?.name || '';
  document.getElementById('sucStartDate').value = new Date().toISOString().split('T')[0];
  populateSucPlantSelect();
  document.getElementById('succession-overlay').style.display = 'flex';
  loadSuccessionPlans();
}

document.getElementById('successionCloseBtn').onclick = closeSuccession;
document.getElementById('succession-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('succession-overlay')) closeSuccession();
});

function closeSuccession() {
  document.getElementById('succession-overlay').style.display = 'none';
  if (sucUnsub) { sucUnsub(); sucUnsub = null; }
}

// Plants that benefit most from succession sowing
const SUCCESSION_PLANTS = [
  { name: 'Lettuce',    days: 45,  interval: 14 },
  { name: 'Radish',     days: 25,  interval: 10 },
  { name: 'Spinach',    days: 40,  interval: 14 },
  { name: 'Bean',       days: 55,  interval: 14 },
  { name: 'Pea',        days: 60,  interval: 14 },
  { name: 'Cilantro',   days: 45,  interval: 14 },
  { name: 'Dill',       days: 40,  interval: 14 },
  { name: 'Basil',      days: 30,  interval: 14 },
  { name: 'Kale',       days: 60,  interval: 21 },
  { name: 'Beet',       days: 60,  interval: 14 },
  { name: 'Carrot',     days: 75,  interval: 21 },
  { name: 'Broccoli',   days: 80,  interval: 21 },
  { name: 'Zucchini',   days: 50,  interval: 21 },
  { name: 'Cucumber',   days: 55,  interval: 21 },
];

function populateSucPlantSelect() {
  const sel = document.getElementById('sucPlantSelect');
  sel.innerHTML = '<option value="">Choose a plant…</option>';
  SUCCESSION_PLANTS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = `${p.name} (~${p.days}d to harvest)`;
    sel.appendChild(opt);
  });

  // Auto-fill interval when plant selected
  sel.onchange = () => {
    const plant = SUCCESSION_PLANTS.find(p => p.name === sel.value);
    if (plant) {
      document.getElementById('sucIntervalDays').value = plant.interval;
    }
  };
}

function loadSuccessionPlans() {
  if (sucUnsub) sucUnsub();
  sucUnsub = db.collection('gardens').doc(currentGardenId)
    .collection('successionPlans')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      sucPlans = [];
      snap.forEach(doc => sucPlans.push({ id: doc.id, ...doc.data() }));
      renderSuccessionTimeline();
    });
}

document.getElementById('addSuccessionBtn').onclick = async () => {
  const plant       = document.getElementById('sucPlantSelect').value;
  const startDate   = document.getElementById('sucStartDate').value;
  const intervalDays= parseInt(document.getElementById('sucIntervalDays').value) || 14;
  const numSowings  = parseInt(document.getElementById('sucNumSowings').value)   || 4;

  if (!plant || !startDate) { showToast('Choose a plant and start date', 'error'); return; }

  const plantData = SUCCESSION_PLANTS.find(p => p.name === plant);
  const daysToHarvest = plantData?.days || 60;

  // Build sowing dates
  const sowings = [];
  for (let i = 0; i < numSowings; i++) {
    const sowDate     = new Date(startDate);
    sowDate.setDate(sowDate.getDate() + i * intervalDays);
    const harvestDate = new Date(sowDate);
    harvestDate.setDate(harvestDate.getDate() + daysToHarvest);
    sowings.push({
      sowDate:     sowDate.toISOString().split('T')[0],
      harvestDate: harvestDate.toISOString().split('T')[0],
    });
  }

  await db.collection('gardens').doc(currentGardenId)
    .collection('successionPlans').add({
      plant, intervalDays, numSowings, daysToHarvest, sowings,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

  // Auto-create sowing tasks
  if (isFeatureEnabled('tasks')) {
    const batch = db.batch();
    const tasksRef = db.collection('gardens').doc(currentGardenId).collection('tasks');
    sowings.forEach((s, i) => {
      const ref = tasksRef.doc();
      batch.set(ref, {
        title:       `Sow ${plant} — batch ${i + 1}`,
        description: `Succession sowing ${i + 1} of ${numSowings}. Harvest expected around ${formatDateStr(s.harvestDate)}.`,
        priority:    'low',
        status:      'todo',
        dueDate:     s.sowDate,
        linkedTiles: [],
        isSuccession: true,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    showToast(`${numSowings} sowing tasks created in calendar 📅`);
  }

  showToast(`Succession plan for ${plant} added 🗓`);
};

function renderSuccessionTimeline() {
  const container = document.getElementById('suc-timeline');
  const empty     = document.getElementById('suc-empty');
  if (!container) return;
  container.innerHTML = '';

  if (!sucPlans.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const today = new Date().toISOString().split('T')[0];

  sucPlans.forEach(plan => {
    const block = document.createElement('div');
    block.className = 'suc-plan-block';

    const plantData = SUCCESSION_PLANTS.find(p => p.name === plan.plant);

    block.innerHTML = `
      <div class="suc-plan-header">
        <span class="suc-plan-name">🌱 ${escHtml(plan.plant)}</span>
        <span class="suc-plan-meta">${plan.numSowings} sowings · every ${plan.intervalDays} days · ~${plan.daysToHarvest}d to harvest</span>
        <button class="suc-delete-btn" data-id="${plan.id}">🗑</button>
      </div>
      <div class="suc-sowings">
        ${(plan.sowings || []).map((s, i) => {
          const isPast     = s.sowDate < today;
          const isHarvested= s.harvestDate < today;
          const statusCls  = isHarvested ? 'suc-done' : isPast ? 'suc-sow-due' : 'suc-upcoming';
          const statusText = isHarvested ? '✓ Harvested by now' : isPast ? '⚠ Sow overdue' : `Sow ${formatDateStr(s.sowDate)}`;
          return `
            <div class="suc-sowing ${statusCls}">
              <span class="suc-batch">Batch ${i+1}</span>
              <span class="suc-sow-date">${statusText}</span>
              <span class="suc-harvest-date">🌾 ~${formatDateStr(s.harvestDate)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    block.querySelector('.suc-delete-btn').onclick = async e => {
      e.stopPropagation();
      if (!confirm(`Delete succession plan for ${plan.plant}?`)) return;
      await db.collection('gardens').doc(currentGardenId)
        .collection('successionPlans').doc(plan.id).delete();
    };

    container.appendChild(block);
  });
}

// ════════════════════════════════════════════════════════════════
// SOIL AMENDMENT LOG
// ════════════════════════════════════════════════════════════════
let soilLogUnsub = null;
let soilLogData  = [];

document.getElementById('gardenSoilLogBtn').onclick = openSoilLog;

function openSoilLog() {
  if (!currentGardenId) return;
  if (!isFeatureEnabled('soilLog')) return;
  document.getElementById('soilLogGardenName').textContent = currentGardenData?.name || '';
  document.getElementById('soilAmendmentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('soil-log-overlay').style.display = 'flex';
  loadSoilLog();
  populateSoilPlotFilter();
}

document.getElementById('soilLogCloseBtn').onclick = closeSoilLog;
document.getElementById('soil-log-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('soil-log-overlay')) closeSoilLog();
});

function closeSoilLog() {
  document.getElementById('soil-log-overlay').style.display = 'none';
  if (soilLogUnsub) { soilLogUnsub(); soilLogUnsub = null; }
}

function populateSoilPlotFilter() {
  const sel = document.getElementById('soilFilterPlot');
  // Get named tiles
  const namedTiles = Object.values(tilesData).filter(t => t.title).map(t => t.title);
  const unique = [...new Set(namedTiles)];
  sel.innerHTML = '<option value="">All beds</option>';
  unique.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
}

function loadSoilLog() {
  if (soilLogUnsub) soilLogUnsub();
  soilLogUnsub = db.collection('gardens').doc(currentGardenId)
    .collection('soilLogs')
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      soilLogData = [];
      snap.forEach(doc => soilLogData.push({ id: doc.id, ...doc.data() }));
      renderSoilLog();
    });
}

document.getElementById('addSoilLogBtn').onclick = async () => {
  if (!canEditTiles()) { showToast('No permission to edit', 'error'); return; }
  const type   = document.getElementById('soilAmendmentType').value;
  const name   = document.getElementById('soilAmendmentName').value.trim();
  const plot   = document.getElementById('soilAmendmentPlot').value.trim();
  const amount = document.getElementById('soilAmendmentAmount').value.trim();
  const date   = document.getElementById('soilAmendmentDate').value;
  const notes  = document.getElementById('soilAmendmentNotes').value.trim();

  if (!date) { showToast('Please enter a date', 'error'); return; }

  const AMENDMENT_EMOJIS = { compost:'🍂', fertilizer:'🌱', lime:'🪨', manure:'💩', mulch:'🍃', sulfur:'🟡', bonemeal:'🦴', bloodmeal:'🔴', other:'📦' };

  await db.collection('gardens').doc(currentGardenId)
    .collection('soilLogs').add({
      type, name, plot, amount, date, notes,
      emoji: AMENDMENT_EMOJIS[type] || '📦',
      addedBy: currentUser?.uid || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

  // Clear inputs
  ['soilAmendmentName','soilAmendmentPlot','soilAmendmentAmount','soilAmendmentNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('soilAmendmentDate').value = new Date().toISOString().split('T')[0];
  showToast('Soil amendment logged 🪱');
};

// Filters
document.getElementById('soilFilterPlot').onchange = renderSoilLog;
document.getElementById('soilFilterType').onchange = renderSoilLog;

function renderSoilLog() {
  const list      = document.getElementById('soil-log-list');
  const empty     = document.getElementById('soil-empty');
  const filterPlot= document.getElementById('soilFilterPlot').value;
  const filterType= document.getElementById('soilFilterType').value;
  if (!list) return;

  let data = soilLogData;
  if (filterPlot) data = data.filter(e => e.plot && e.plot.toLowerCase().includes(filterPlot.toLowerCase()));
  if (filterType) data = data.filter(e => e.type === filterType);

  list.innerHTML = '';
  if (!data.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  data.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'soil-log-row';
    row.innerHTML = `
      <div class="soil-log-emoji">${entry.emoji || '📦'}</div>
      <div class="soil-log-body">
        <div class="soil-log-title">
          ${escHtml(entry.name || entry.type)}
          ${entry.amount ? `<span class="soil-log-amount">${escHtml(entry.amount)}</span>` : ''}
        </div>
        <div class="soil-log-meta">
          <span>📅 ${entry.date}</span>
          ${entry.plot ? `<span>📍 ${escHtml(entry.plot)}</span>` : ''}
          ${entry.notes ? `<span class="soil-log-notes">💬 ${escHtml(entry.notes)}</span>` : ''}
        </div>
      </div>
      ${canEditTiles() ? `<button class="soil-log-delete" data-id="${entry.id}">🗑</button>` : ''}
    `;
    row.querySelector('.soil-log-delete')?.addEventListener('click', async e => {
      e.stopPropagation();
      await db.collection('gardens').doc(currentGardenId)
        .collection('soilLogs').doc(entry.id).delete();
    });
    list.appendChild(row);
  });
}

// ════════════════════════════════════════════════════════════════
// HOOK INTO TILE SAVE (called by tiles.js after saving)
// ════════════════════════════════════════════════════════════════
function onTileSaved(tileId, plantName) {
  if (plantName && isFeatureEnabled('cropRotation')) {
    saveCropRotationRecord(tileId, plantName);
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function formatDateStr(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}
