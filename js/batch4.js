// ================================================================
// BATCH4.JS — seed inventory, pest/disease log, yield analytics
// ================================================================

// ════════════════════════════════════════════════════════════════
// SEED INVENTORY
// Seeds are stored per-user (not per-garden) so they persist
// across all gardens: users/{uid}/seeds/{seedId}
// ════════════════════════════════════════════════════════════════
let seedData      = [];
let seedUnsub     = null;
let editingSeedId = null;
let seedFilter    = 'all';
let seedSearchQ   = '';

function seedsRef() {
  return db.collection('users').doc(currentUser.uid).collection('seeds');
}

// ── Open / close ──────────────────────────────────────────────────
document.getElementById('seedInventoryCloseBtn').onclick = closeSeedInventory;
document.getElementById('seed-inventory-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('seed-inventory-overlay')) closeSeedInventory();
});

// Opened from profile sheet
document.getElementById('openSeedInventoryBtn')?.addEventListener('click', () => {
  closeProfileSheet();
  openSeedInventory();
});

function openSeedInventory() {
  if (!isFeatureEnabled('seedInventory')) return;
  closeSeedForm();
  populateSeedGardenDropdown();
  document.getElementById('seed-inventory-overlay').style.display = 'flex';
  loadSeeds();
}

function closeSeedInventory() {
  document.getElementById('seed-inventory-overlay').style.display = 'none';
  if (seedUnsub) { seedUnsub(); seedUnsub = null; }
}

// ── Load seeds ────────────────────────────────────────────────────
function loadSeeds() {
  if (seedUnsub) seedUnsub();
  seedUnsub = seedsRef()
    .orderBy('plantName', 'asc')
    .onSnapshot(snap => {
      seedData = [];
      snap.forEach(doc => seedData.push({ id: doc.id, ...doc.data() }));
      renderSeedList();
    });
}

// ── Filters ───────────────────────────────────────────────────────
document.getElementById('seedSearch').addEventListener('input', e => {
  seedSearchQ = e.target.value.toLowerCase();
  renderSeedList();
});

document.querySelectorAll('[data-seed-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-seed-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    seedFilter = btn.dataset.seedFilter;
    renderSeedList();
  });
});

function renderSeedList() {
  const list  = document.getElementById('seed-list');
  const empty = document.getElementById('seed-empty');
  if (!list) return;

  const thisYear = new Date().getFullYear();
  let seeds = seedData;

  if (seedSearchQ) seeds = seeds.filter(s =>
    s.plantName?.toLowerCase().includes(seedSearchQ) ||
    s.source?.toLowerCase().includes(seedSearchQ)
  );

  if (seedFilter === 'low') {
    seeds = seeds.filter(s => s.lowStockAlert && s.qty <= s.lowStockAlert);
  } else if (seedFilter === 'expiring') {
    seeds = seeds.filter(s => s.expiryYear && s.expiryYear <= thisYear + 1);
  }

  list.innerHTML = '';
  if (!seeds.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  seeds.forEach(seed => {
    const isLow     = seed.lowStockAlert && seed.qty <= seed.lowStockAlert;
    const isExpiring= seed.expiryYear && seed.expiryYear <= thisYear + 1;
    const isExpired = seed.expiryYear && seed.expiryYear < thisYear;

    const card = document.createElement('div');
    card.className = 'seed-card' + (isLow ? ' seed-low' : '') + (isExpired ? ' seed-expired' : '');
    card.innerHTML = `
      <div class="seed-card-main">
        <div class="seed-card-name">🫘 ${escHtml(seed.plantName || 'Unknown')}</div>
        <div class="seed-card-qty">
          <strong>${seed.qty ?? '—'}</strong> <span>${escHtml(seed.unit || 'seeds')}</span>
          ${isLow ? '<span class="seed-alert-badge low">⚠ Low</span>' : ''}
          ${isExpiring && !isExpired ? '<span class="seed-alert-badge expiring">📅 Expiring</span>' : ''}
          ${isExpired ? '<span class="seed-alert-badge expired">❌ Expired</span>' : ''}
        </div>
        <div class="seed-card-meta">
          ${seed.expiryYear ? `<span>📅 ${seed.expiryYear}</span>` : ''}
          ${seed.source ? `<span>🏪 ${escHtml(seed.source)}</span>` : ''}
          ${seed.gardenName ? `<span>🌱 ${escHtml(seed.gardenName)}</span>` : ''}
        </div>
        ${seed.notes ? `<div class="seed-card-notes">💬 ${escHtml(seed.notes)}</div>` : ''}
      </div>
      <div class="seed-card-actions">
        <button class="seed-use-btn" data-id="${seed.id}" title="Record use">−</button>
        <button class="seed-edit-btn" data-id="${seed.id}" title="Edit">✏</button>
      </div>
    `;

    card.querySelector('.seed-edit-btn').addEventListener('click', () => openSeedForm(seed));
    card.querySelector('.seed-use-btn').addEventListener('click', () => recordSeedUse(seed));
    list.appendChild(card);
  });
}

// ── Quick-use (subtract from stock) ──────────────────────────────
async function recordSeedUse(seed) {
  const amount = parseFloat(prompt(`How many ${seed.unit || 'seeds'} did you use?`, '1'));
  if (isNaN(amount) || amount <= 0) return;
  const newQty = Math.max(0, (seed.qty || 0) - amount);
  await seedsRef().doc(seed.id).update({ qty: newQty });
  showToast(`Recorded: used ${amount} ${seed.unit || 'seeds'} of ${seed.plantName}`);
}

// ── Add/edit form ─────────────────────────────────────────────────
document.getElementById('addSeedBtn').onclick    = () => openSeedForm(null);
document.getElementById('seedFormCloseBtn').onclick = closeSeedForm;

function openSeedForm(seed) {
  editingSeedId = seed?.id || null;
  document.getElementById('seed-form').style.display = 'block';
  document.getElementById('seedFormTitle').textContent = seed ? 'Edit Seed' : 'New Seed';
  document.getElementById('seedPlantInput').value    = seed?.plantName  || '';
  document.getElementById('seedQtyInput').value      = seed?.qty        ?? '';
  document.getElementById('seedUnitInput').value     = seed?.unit       || 'seeds';
  document.getElementById('seedExpiryInput').value   = seed?.expiryYear || '';
  document.getElementById('seedLowStockInput').value = seed?.lowStockAlert || '';
  document.getElementById('seedSourceInput').value   = seed?.source     || '';
  document.getElementById('seedNotesInput').value    = seed?.notes      || '';
  document.getElementById('seedGardenInput').value   = seed?.gardenId   || '';
  document.getElementById('deleteSeedBtn').style.display = seed ? 'inline-block' : 'none';
  document.getElementById('seed-form').scrollIntoView({ behavior: 'smooth' });
}

function closeSeedForm() {
  editingSeedId = null;
  document.getElementById('seed-form').style.display = 'none';
}

document.getElementById('saveSeedBtn').onclick = async () => {
  const plantName    = document.getElementById('seedPlantInput').value.trim();
  if (!plantName) { showToast('Enter a plant name', 'error'); return; }

  const gardenSel    = document.getElementById('seedGardenInput');
  const gardenId     = gardenSel.value;
  const gardenName   = gardenSel.options[gardenSel.selectedIndex]?.text || '';

  const payload = {
    plantName,
    qty:           parseFloat(document.getElementById('seedQtyInput').value)    || 0,
    unit:          document.getElementById('seedUnitInput').value                || 'seeds',
    expiryYear:    parseInt(document.getElementById('seedExpiryInput').value)   || null,
    lowStockAlert: parseInt(document.getElementById('seedLowStockInput').value) || null,
    source:        document.getElementById('seedSourceInput').value.trim()       || '',
    notes:         document.getElementById('seedNotesInput').value.trim()        || '',
    gardenId:      gardenId || null,
    gardenName:    gardenName !== 'None' ? gardenName : '',
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (editingSeedId) {
    await seedsRef().doc(editingSeedId).update(payload);
    showToast('Seed updated 🫘');
  } else {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await seedsRef().add(payload);
    showToast('Seed added to inventory 🫘');
  }
  closeSeedForm();
};

document.getElementById('deleteSeedBtn').onclick = async () => {
  if (!editingSeedId || !confirm('Delete this seed from inventory?')) return;
  await seedsRef().doc(editingSeedId).delete();
  closeSeedForm();
  showToast('Seed removed');
};

async function populateSeedGardenDropdown() {
  const sel = document.getElementById('seedGardenInput');
  sel.innerHTML = '<option value="">None</option>';
  try {
    const snap = await db.collection('gardens')
      .where('ownerId', '==', currentUser.uid).get();
    snap.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = doc.data().name || 'Unnamed';
      sel.appendChild(opt);
    });
  } catch {}
}

// ════════════════════════════════════════════════════════════════
// PEST & DISEASE LOG
// ════════════════════════════════════════════════════════════════
let pestLogUnsub = null;
let pestLogData  = [];

document.getElementById('gardenPestLogBtn').onclick = openPestLog;
document.getElementById('pestLogCloseBtn').onclick  = closePestLog;
document.getElementById('pest-log-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('pest-log-overlay')) closePestLog();
});

function pestLogRef() {
  return db.collection('gardens').doc(currentGardenId).collection('pestLogs');
}

function openPestLog() {
  if (!currentGardenId || !isFeatureEnabled('pestLog')) return;
  document.getElementById('pestLogGardenName').textContent = currentGardenData?.name || '';
  document.getElementById('pestDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('pest-log-overlay').style.display = 'flex';
  loadPestLog();
  populatePestPlotSuggestions();
}

function closePestLog() {
  document.getElementById('pest-log-overlay').style.display = 'none';
  if (pestLogUnsub) { pestLogUnsub(); pestLogUnsub = null; }
}

function populatePestPlotSuggestions() {
  // Build datalist from named tiles
  let dl = document.getElementById('pestPlotList');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'pestPlotList';
    document.body.appendChild(dl);
    document.getElementById('pestPlot').setAttribute('list', 'pestPlotList');
  }
  dl.innerHTML = '';
  Object.values(tilesData || {})
    .filter(t => t.title)
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.title;
      dl.appendChild(opt);
    });
}

function loadPestLog() {
  if (pestLogUnsub) pestLogUnsub();
  pestLogUnsub = pestLogRef()
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      pestLogData = [];
      snap.forEach(doc => pestLogData.push({ id: doc.id, ...doc.data() }));
      renderPestLog();
    });
}

document.getElementById('addPestLogBtn').onclick = async () => {
  if (!canEditTiles()) { showToast('No permission to edit', 'error'); return; }
  const type      = document.getElementById('pestType').value;
  const name      = document.getElementById('pestName').value.trim();
  const plot      = document.getElementById('pestPlot').value.trim();
  const date      = document.getElementById('pestDate').value;
  const severity  = document.getElementById('pestSeverity').value;
  const treatment = document.getElementById('pestTreatment').value.trim();
  const outcome   = document.getElementById('pestOutcome').value.trim();

  if (!name || !date) { showToast('Enter a name and date', 'error'); return; }

  const TYPE_EMOJIS = { pest: '🐛', disease: '🍄', deficiency: '🟡', other: '❓' };
  await pestLogRef().add({
    type, name, plot, date, severity, treatment, outcome,
    emoji: TYPE_EMOJIS[type] || '❓',
    addedBy: currentUser?.uid || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  ['pestName','pestPlot','pestTreatment','pestOutcome'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('pestDate').value = new Date().toISOString().split('T')[0];
  showToast('Pest/disease logged 🐛');
};

document.getElementById('pestFilterType').onchange     = renderPestLog;
document.getElementById('pestFilterSeverity').onchange = renderPestLog;

function renderPestLog() {
  const list     = document.getElementById('pest-log-list');
  const empty    = document.getElementById('pest-empty');
  const fType    = document.getElementById('pestFilterType').value;
  const fSev     = document.getElementById('pestFilterSeverity').value;
  if (!list) return;

  let data = pestLogData;
  if (fType) data = data.filter(e => e.type     === fType);
  if (fSev)  data = data.filter(e => e.severity === fSev);

  list.innerHTML = '';
  if (!data.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  const SEV_COLORS = { minor: '#d4f5d4', moderate: '#fff3a8', severe: '#ffb3b3' };
  const SEV_ICONS  = { minor: '🟢', moderate: '🟡', severe: '🔴' };

  data.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'pest-log-row';
    row.style.borderLeftColor = SEV_COLORS[entry.severity] || '#e0e0e0';
    row.innerHTML = `
      <div class="pest-log-top">
        <span class="pest-log-emoji">${entry.emoji || '❓'}</span>
        <div class="pest-log-body">
          <div class="pest-log-title">${escHtml(entry.name)}</div>
          <div class="pest-log-meta">
            <span>${SEV_ICONS[entry.severity] || ''} ${entry.severity || ''}</span>
            <span>📅 ${entry.date}</span>
            ${entry.plot ? `<span>📍 ${escHtml(entry.plot)}</span>` : ''}
          </div>
          ${entry.treatment ? `<div class="pest-log-treatment">💊 Treatment: ${escHtml(entry.treatment)}</div>` : ''}
          ${entry.outcome   ? `<div class="pest-log-outcome">✓ Outcome: ${escHtml(entry.outcome)}</div>` : ''}
        </div>
        ${canEditTiles() ? `<button class="soil-log-delete pest-del-btn" data-id="${entry.id}">🗑</button>` : ''}
      </div>
    `;
    row.querySelector('.pest-del-btn')?.addEventListener('click', async e => {
      e.stopPropagation();
      await pestLogRef().doc(entry.id).delete();
    });
    list.appendChild(row);
  });
}

// ════════════════════════════════════════════════════════════════
// YIELD ANALYTICS
// ════════════════════════════════════════════════════════════════
let yieldChart    = null;
let yieldUnsub    = null;
let yieldHarvests = [];
let yieldExpenses = [];

document.getElementById('gardenYieldBtn').onclick      = openYieldAnalytics;
document.getElementById('yieldAnalyticsCloseBtn').onclick = closeYieldAnalytics;
document.getElementById('yield-analytics-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('yield-analytics-overlay')) closeYieldAnalytics();
});

function openYieldAnalytics() {
  if (!currentGardenId || !isFeatureEnabled('yieldAnalytics')) return;
  document.getElementById('yieldGardenName').textContent = currentGardenData?.name || '';
  populateYieldYearSelect();
  document.getElementById('yield-analytics-overlay').style.display = 'flex';
  loadYieldData();
}

function closeYieldAnalytics() {
  document.getElementById('yield-analytics-overlay').style.display = 'none';
  if (yieldChart) { yieldChart.destroy(); yieldChart = null; }
}

function populateYieldYearSelect() {
  const sel  = document.getElementById('yieldYearSelect');
  const year = new Date().getFullYear();
  sel.innerHTML = '';
  for (let y = year; y >= year - 4; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  }
}

document.getElementById('yieldYearSelect').onchange  = () => loadYieldData();
document.getElementById('yieldViewSelect').onchange  = renderYieldChart;

async function loadYieldData() {
  const year     = document.getElementById('yieldYearSelect').value;
  const startStr = `${year}-01-01`;
  const endStr   = `${year}-12-31`;

  // Load harvests and expenses for the year
  const [hSnap, eSnap] = await Promise.all([
    db.collection('gardens').doc(currentGardenId).collection('harvests')
      .where('date', '>=', startStr).where('date', '<=', endStr).get(),
    db.collection('gardens').doc(currentGardenId).collection('expenses')
      .where('date', '>=', startStr).where('date', '<=', endStr).get(),
  ]);

  yieldHarvests = [];
  yieldExpenses = [];
  hSnap.forEach(doc => yieldHarvests.push({ id: doc.id, ...doc.data() }));
  eSnap.forEach(doc => yieldExpenses.push({ id: doc.id, ...doc.data() }));

  renderYieldSummary();
  renderYieldChart();
}

function renderYieldSummary() {
  const el = document.getElementById('yield-summary');
  if (!el) return;

  const totalHarvests = yieldHarvests.length;
  const totalSpend    = yieldExpenses.reduce((s, e) => s + (e.cost || 0), 0);
  const totalUnits    = yieldHarvests.reduce((s, h) => s + (h.amount || 0), 0);

  // Garden area in sq ft (rows × cols × tile sq ft — assume 1 sq ft per tile)
  const gardenSqFt = (currentGardenData?.rows || 6) * (currentGardenData?.cols || 6);
  const yieldPerSqFt = gardenSqFt > 0 ? (totalUnits / gardenSqFt).toFixed(2) : '—';

  // Unique plants harvested
  const plants = [...new Set(yieldHarvests.map(h => h.item).filter(Boolean))];

  el.innerHTML = `
    <div class="yield-stat-grid">
      <div class="yield-stat">
        <div class="yield-stat-val">${totalHarvests}</div>
        <div class="yield-stat-label">Harvests logged</div>
      </div>
      <div class="yield-stat">
        <div class="yield-stat-val">${totalUnits.toFixed(1)}</div>
        <div class="yield-stat-label">Total units</div>
      </div>
      <div class="yield-stat">
        <div class="yield-stat-val">${yieldPerSqFt}</div>
        <div class="yield-stat-label">Units / sq ft</div>
      </div>
      <div class="yield-stat">
        <div class="yield-stat-val">$${totalSpend.toFixed(2)}</div>
        <div class="yield-stat-label">Total spent</div>
      </div>
    </div>
    ${plants.length ? `<div class="yield-plants">🌱 Harvested: ${plants.slice(0, 8).map(escHtml).join(', ')}${plants.length > 8 ? ` +${plants.length - 8} more` : ''}</div>` : ''}
  `;
}

function renderYieldChart() {
  const canvas = document.getElementById('yieldChart');
  const empty  = document.getElementById('yield-empty');
  const view   = document.getElementById('yieldViewSelect').value;
  if (yieldChart) { yieldChart.destroy(); yieldChart = null; }

  if (!yieldHarvests.length && view !== 'roi') {
    empty.style.display = 'flex';
    canvas.style.display = 'none';
    renderYieldTable([]);
    return;
  }
  empty.style.display = 'none';
  canvas.style.display = 'block';

  let labels, datasets, chartType = 'bar';

  if (view === 'byplant') {
    // Aggregate by plant
    const byPlant = {};
    yieldHarvests.forEach(h => {
      if (!h.item) return;
      byPlant[h.item] = (byPlant[h.item] || 0) + (h.amount || 0);
    });
    const sorted = Object.entries(byPlant).sort((a, b) => b[1] - a[1]);
    labels   = sorted.map(([k]) => k);
    datasets = [{ label: 'Units harvested', data: sorted.map(([,v]) => +v.toFixed(2)), backgroundColor: '#8ecb68', borderRadius: 6 }];
    renderYieldTable(sorted.map(([plant, units]) => ({ plant, units: units.toFixed(2), spend: yieldExpenses.filter(e => e.plot?.toLowerCase().includes(plant.toLowerCase())).reduce((s,e) => s + e.cost, 0).toFixed(2) })));

  } else if (view === 'bysqft') {
    const gardenSqFt = (currentGardenData?.rows || 6) * (currentGardenData?.cols || 6);
    const byPlot = {};
    yieldHarvests.forEach(h => {
      const key = h.plot || 'Untracked';
      byPlot[key] = (byPlot[key] || 0) + (h.amount || 0);
    });
    const sorted = Object.entries(byPlot).sort((a, b) => b[1] - a[1]);
    labels   = sorted.map(([k]) => k);
    // Per tile: assume each named plot = 1 sq ft for now
    datasets = [{ label: 'Units / sq ft', data: sorted.map(([,v]) => +(v / 1).toFixed(2)), backgroundColor: '#5a9a50', borderRadius: 6 }];
    renderYieldTable(sorted.map(([plot, units]) => ({ plant: plot, units: units.toFixed(2), spend: '—' })));

  } else if (view === 'roi') {
    // ROI: compare total yield units vs spending by month
    const months = Array.from({length: 12}, (_, i) => {
      const d = new Date(2000, i); return d.toLocaleDateString('en-US', { month: 'short' });
    });
    const harvestByMonth = new Array(12).fill(0);
    const spendByMonth   = new Array(12).fill(0);
    yieldHarvests.forEach(h => {
      const m = h.date ? parseInt(h.date.split('-')[1]) - 1 : -1;
      if (m >= 0) harvestByMonth[m] += h.amount || 0;
    });
    yieldExpenses.forEach(e => {
      const m = e.date ? parseInt(e.date.split('-')[1]) - 1 : -1;
      if (m >= 0) spendByMonth[m] += e.cost || 0;
    });
    labels = months;
    datasets = [
      { label: 'Harvest units', data: harvestByMonth.map(v => +v.toFixed(2)), backgroundColor: '#8ecb68', borderRadius: 4, yAxisID: 'y' },
      { label: 'Spending ($)',  data: spendByMonth.map(v => +v.toFixed(2)),   backgroundColor: '#ffd5a8', borderRadius: 4, yAxisID: 'y2' },
    ];
    renderYieldTable(null);

  } else { // monthly
    const byMonth = {};
    yieldHarvests.forEach(h => {
      if (!h.date) return;
      const key = h.date.slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + (h.amount || 0);
    });
    const sorted = Object.keys(byMonth).sort();
    labels   = sorted.map(k => { const [y,m] = k.split('-'); return `${new Date(2000, +m-1).toLocaleDateString('en-US',{month:'short'})} ${y}`; });
    datasets = [{ label: 'Units harvested', data: sorted.map(k => +byMonth[k].toFixed(2)), backgroundColor: '#8ecb68', borderRadius: 6 }];
    renderYieldTable(null);
  }

  const isRoi  = view === 'roi';
  const config = {
    type: chartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { display: isRoi || datasets.length > 1 },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { grid: { display: false } },
        y:  { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, position: 'left' },
        ...(isRoi ? { y2: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { callback: v => `$${v}` } } } : {}),
      },
    },
  };

  yieldChart = new Chart(canvas, config);
}

function renderYieldTable(rows) {
  const el = document.getElementById('yield-table');
  if (!el || !rows?.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <table class="yield-tbl">
      <thead><tr><th>Plant / Plot</th><th>Units</th><th>Spend</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${escHtml(r.plant)}</td>
          <td>${r.units}</td>
          <td>${r.spend !== '—' ? `$${parseFloat(r.spend).toFixed(2)}` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

// ── Expose globally ───────────────────────────────────────────────
// So profile sheet can call openSeedInventory without a garden context
window.openSeedInventory = openSeedInventory;
