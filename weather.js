// ================================================================
// TRACKING.JS — harvest log, spending tracker, yield/spending charts
// ================================================================

let trackingGardenId   = null;
let harvestUnsub       = null;
let expenseUnsub       = null;
let trackingChart      = null;
let activeTrackingTab  = 'harvest';

// ── Init ──────────────────────────────────────────────────────────
function initTracking(gardenId, gardenData) {
  trackingGardenId = gardenId;
}

// ── Open modal ────────────────────────────────────────────────────
document.getElementById('gardenTrackingBtn').onclick = openTrackingModal;

function openTrackingModal() {
  if (!currentGardenId) return;
  document.getElementById('trackingGardenName').textContent = currentGardenData?.name || '';
  switchTrackingTab('harvest');
  document.getElementById('tracking-modal-overlay').classList.add('open');
}

document.getElementById('trackingModalCloseBtn').onclick = () => {
  document.getElementById('tracking-modal-overlay').classList.remove('open');
  if (harvestUnsub) { harvestUnsub(); harvestUnsub = null; }
  if (expenseUnsub) { expenseUnsub(); expenseUnsub = null; }
  if (trackingChart) { trackingChart.destroy(); trackingChart = null; }
};
document.getElementById('tracking-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('tracking-modal-overlay')) {
    document.getElementById('trackingModalCloseBtn').click();
  }
});

// ── Tab switching ─────────────────────────────────────────────────
document.querySelectorAll('[data-track]').forEach(btn => {
  btn.onclick = () => switchTrackingTab(btn.dataset.track);
});

function switchTrackingTab(tab) {
  activeTrackingTab = tab;
  document.querySelectorAll('.track-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('[data-track]').forEach(b =>
    b.classList.toggle('active', b.dataset.track === tab));

  if (tab === 'harvest') {
    document.getElementById('trackHarvest').style.display = 'block';
    loadHarvests();
  } else if (tab === 'spending') {
    document.getElementById('trackSpending').style.display = 'block';
    loadExpenses();
  } else if (tab === 'charts') {
    document.getElementById('trackCharts').style.display = 'block';
    renderTrackingChart();
  }
}

// ── Harvest log ───────────────────────────────────────────────────
function harvestsRef() {
  return db.collection('gardens').doc(currentGardenId).collection('harvests');
}

function loadHarvests() {
  if (harvestUnsub) harvestUnsub();
  document.getElementById('harvestDateInput').value = new Date().toISOString().split('T')[0];

  harvestUnsub = harvestsRef()
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('harvestList');
      list.innerHTML = '';
      if (snap.empty) {
        list.innerHTML = '<p style="color:#888;font-size:0.85rem;margin-top:0.5rem">No harvests logged yet.</p>';
        return;
      }
      snap.forEach(doc => {
        const h = doc.data();
        const row = document.createElement('div');
        row.className = 'harvest-item';
        row.innerHTML = `
          <span>${escHtml(h.date||'')}</span>
          <span>${escHtml(h.item||'')}</span>
          <span><strong>${h.amount} ${escHtml(h.unit||'')}</strong></span>
          ${h.plot ? `<span class="harvest-item-plot">📍 ${escHtml(h.plot)}</span>` : ''}
          ${canEditTiles() ? `<button class="harvest-item-delete" data-id="${doc.id}">🗑</button>` : ''}
        `;
        const del = row.querySelector('.harvest-item-delete');
        if (del) del.onclick = () => harvestsRef().doc(doc.id).delete();
        list.appendChild(row);
      });
    });
}

document.getElementById('addHarvestBtn').onclick = async () => {
  if (!canEditTiles()) return;
  const item   = document.getElementById('harvestItemInput').value.trim();
  const amount = parseFloat(document.getElementById('harvestAmountInput').value);
  const unit   = document.getElementById('harvestUnitInput').value.trim();
  const date   = document.getElementById('harvestDateInput').value;
  const plot   = document.getElementById('harvestPlotInput').value.trim();

  if (!item || isNaN(amount) || !date) {
    showToast('Please fill in item, amount, and date', 'error');
    return;
  }

  await harvestsRef().add({
    item, amount, unit, date, plot,
    gardenId: currentGardenId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById('harvestItemInput').value   = '';
  document.getElementById('harvestAmountInput').value = '';
  document.getElementById('harvestUnitInput').value   = '';
  document.getElementById('harvestPlotInput').value   = '';
  showToast('Harvest logged! 🌾');
};

// ── Spending tracker ──────────────────────────────────────────────
function expensesRef() {
  return db.collection('gardens').doc(currentGardenId).collection('expenses');
}

function loadExpenses() {
  if (expenseUnsub) expenseUnsub();
  document.getElementById('expenseDateInput').value = new Date().toISOString().split('T')[0];

  expenseUnsub = expensesRef()
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('expenseList');
      list.innerHTML = '';
      let total = 0;

      if (snap.empty) {
        list.innerHTML = '<p style="color:#888;font-size:0.85rem;margin-top:0.5rem">No expenses logged yet.</p>';
        document.getElementById('expenseTotal').textContent = '';
        return;
      }

      snap.forEach(doc => {
        const e = doc.data();
        total += e.cost || 0;
        const row = document.createElement('div');
        row.className = 'expense-item';
        row.innerHTML = `
          <span>${escHtml(e.date||'')}</span>
          <span>${escHtml(e.item||'')}</span>
          <span><strong>$${(e.cost||0).toFixed(2)}</strong></span>
          ${e.plot ? `<span class="expense-item-plot">📍 ${escHtml(e.plot)}</span>` : ''}
          ${canEditTiles() ? `<button class="expense-item-delete" data-id="${doc.id}">🗑</button>` : ''}
        `;
        const del = row.querySelector('.expense-item-delete');
        if (del) del.onclick = () => expensesRef().doc(doc.id).delete();
        list.appendChild(row);
      });

      document.getElementById('expenseTotal').textContent = `Total: $${total.toFixed(2)}`;
    });
}

document.getElementById('addExpenseBtn').onclick = async () => {
  if (!canEditTiles()) return;
  const item = document.getElementById('expenseItemInput').value.trim();
  const cost = parseFloat(document.getElementById('expenseCostInput').value);
  const date = document.getElementById('expenseDateInput').value;
  const plot = document.getElementById('expensePlotInput').value.trim();

  if (!item || isNaN(cost) || !date) {
    showToast('Please fill in item, cost, and date', 'error');
    return;
  }

  await expensesRef().add({
    item, cost, date, plot,
    gardenId: currentGardenId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById('expenseItemInput').value = '';
  document.getElementById('expenseCostInput').value = '';
  document.getElementById('expensePlotInput').value = '';
  showToast('Expense logged! 💰');
};

// ── Charts ────────────────────────────────────────────────────────
document.getElementById('chartRangeSelect').onchange = renderTrackingChart;
document.getElementById('chartTypeSelect').onchange  = renderTrackingChart;

async function renderTrackingChart() {
  const range     = document.getElementById('chartRangeSelect').value;
  const type      = document.getElementById('chartTypeSelect').value;
  const canvas    = document.getElementById('trackingChart');

  if (trackingChart) { trackingChart.destroy(); trackingChart = null; }

  const now   = new Date();
  let startDate;
  if (range === 'week')  { startDate = new Date(now); startDate.setDate(now.getDate() - 6); }
  else if (range === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (range === 'year')  { startDate = new Date(now.getFullYear(), 0, 1); }
  else startDate = new Date(2020, 0, 1);

  const startStr = startDate.toISOString().split('T')[0];

  // Fetch data
  const ref     = type === 'harvest' ? harvestsRef() : expensesRef();
  const snap    = await ref.where('date', '>=', startStr).orderBy('date', 'asc').get();

  if (snap.empty) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data for this period', canvas.width/2, canvas.height/2);
    return;
  }

  // Group by date
  const byDate = {};
  snap.forEach(doc => {
    const d = doc.data();
    const key = d.date;
    if (!byDate[key]) byDate[key] = 0;
    byDate[key] += type === 'harvest' ? (d.amount || 0) : (d.cost || 0);
  });

  const labels = Object.keys(byDate).sort();
  const values = labels.map(l => byDate[l]);

  const color = type === 'harvest' ? '#9fd07a' : '#ffd5a8';

  trackingChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: type === 'harvest' ? 'Harvest (units)' : 'Spending ($)',
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => type === 'spending'
              ? `$${ctx.raw.toFixed(2)}`
              : `${ctx.raw} units`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });
}

// ── Journal modal ─────────────────────────────────────────────────
document.getElementById('gardenJournalBtn').onclick = openJournalModal;

function openJournalModal() {
  if (!currentGardenId) return;
  document.getElementById('journalGardenName').textContent = currentGardenData?.name || '';
  document.getElementById('journalNewEntry').value = '';
  loadJournalEntries();
  document.getElementById('journal-modal-overlay').classList.add('open');
}

document.getElementById('journalModalCloseBtn').onclick = () =>
  document.getElementById('journal-modal-overlay').classList.remove('open');
document.getElementById('journal-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('journal-modal-overlay'))
    document.getElementById('journal-modal-overlay').classList.remove('open');
});

function journalRef() {
  return db.collection('gardens').doc(currentGardenId).collection('journal');
}

async function loadJournalEntries() {
  const list = document.getElementById('journal-entries');
  list.innerHTML = '<p style="color:#888;text-align:center">Loading…</p>';

  const snap = await journalRef()
    .orderBy('createdAt', 'desc').limit(50).get();

  list.innerHTML = '';
  if (snap.empty) {
    list.innerHTML = '<p style="color:#888;font-size:0.88rem;text-align:center">No entries yet. Write the first one!</p>';
    return;
  }

  snap.forEach(doc => {
    const e    = doc.data();
    const isOwn = e.authorId === currentUser?.uid;
    const entry = document.createElement('div');
    entry.className = 'journal-entry';
    entry.innerHTML = `
      <div class="journal-entry-date">
        ${e.createdAt?.toDate ? formatDate(e.createdAt) : ''}
        ${isOwn ? `<button class="journal-entry-delete" data-id="${doc.id}">🗑</button>` : ''}
      </div>
      <div class="journal-entry-text">${escHtml(e.text)}</div>
    `;
    const del = entry.querySelector('.journal-entry-delete');
    if (del) del.onclick = async () => {
      await journalRef().doc(doc.id).delete();
      loadJournalEntries();
    };
    list.appendChild(entry);
  });
}

document.getElementById('saveJournalBtn').onclick = async () => {
  const text = document.getElementById('journalNewEntry').value.trim();
  if (!text) return;

  await journalRef().add({
    text,
    authorId:    currentUser.uid,
    authorName:  currentUser.displayName || currentUser.email,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById('journalNewEntry').value = '';
  loadJournalEntries();
  showToast('Entry added! 📓');
};
