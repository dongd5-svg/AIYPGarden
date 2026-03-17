// ================================================================
// BATCH6.JS — offline mode, PDF export, UI polish
// ================================================================

// ════════════════════════════════════════════════════════════════
// 1. SERVICE WORKER REGISTRATION
// ════════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use relative path so it works on GitHub Pages subdirectories
    const swPath = new URL('service-worker.js', window.location.href).href;
    navigator.serviceWorker.register(swPath)
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ════════════════════════════════════════════════════════════════
// 2. OFFLINE / ONLINE DETECTION
// ════════════════════════════════════════════════════════════════
const offlineBanner = document.getElementById('offline-banner');

function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  if (offlineBanner) {
    offlineBanner.style.display = isOnline ? 'none' : 'flex';
  }
  if (!isOnline) {
    showToast('You\'re offline — working from cached data', 'info');
  } else if (document._wasOffline) {
    showToast('Back online — syncing changes ✓', 'success');
  }
  document._wasOffline = !isOnline;
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus(); // Check on load

// ════════════════════════════════════════════════════════════════
// 3. PDF EXPORT
// ════════════════════════════════════════════════════════════════
document.getElementById('exportGardenPdfBtn')?.addEventListener('click', exportGardenPdf);

async function exportGardenPdf() {
  if (!currentGardenId || !currentGardenData) return;
  if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    showToast('PDF library loading, try again in a moment', 'error');
    return;
  }

  showToast('Generating PDF…');
  document.getElementById('settings-modal-overlay').classList.remove('open');

  // Small delay to let toast show
  await new Promise(r => setTimeout(r, 200));

  const { jsPDF } = window.jspdf || window;
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W    = 210; // A4 width mm
  const MARGIN = 14;
  let   y    = MARGIN;

  // ── Brand colors ────────────────────────────────────────────────
  const GREEN  = [61, 112, 53];
  const GREEN2 = [90, 154, 80];
  const TAN    = [250, 246, 238];
  const GRAY   = [100, 100, 100];
  const BLACK  = [26, 46, 26];

  // ── Helper: add page if needed ────────────────────────────────
  function checkPage(needed = 10) {
    if (y + needed > 285) { doc.addPage(); y = MARGIN; }
  }

  // ── Header banner ─────────────────────────────────────────────
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('🌿 Ants In Your Plants', MARGIN, 12);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(currentGardenData.name || 'My Garden', MARGIN, 20);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }),
    W - MARGIN, 20, { align: 'right' });
  y = 34;

  // ── Garden info row ──────────────────────────────────────────
  doc.setTextColor(...BLACK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const infoItems = [
    `Size: ${currentGardenData.rows || 6} × ${currentGardenData.cols || 6}`,
    `Season: ${(currentGardenData.currentSeason || 'spring').charAt(0).toUpperCase() + (currentGardenData.currentSeason || 'spring').slice(1)}`,
    `Visibility: ${(currentGardenData.visibility || 'private').charAt(0).toUpperCase() + (currentGardenData.visibility||'private').slice(1)}`,
    `Owner: ${currentGardenData.ownerName || currentUser?.displayName || ''}`,
  ];
  doc.setTextColor(...GRAY);
  doc.text(infoItems.join('   •   '), MARGIN, y);
  y += 7;

  // ── Divider ──────────────────────────────────────────────────
  doc.setDrawColor(...GREEN2);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 6;

  // ── Garden grid ───────────────────────────────────────────────
  const rows   = currentGardenData.rows || 6;
  const cols   = currentGardenData.cols || 6;
  const gridW  = W - MARGIN * 2;
  const cellW  = gridW / cols;
  const cellH  = Math.min(cellW, 18); // max 18mm tall
  const gridH  = cellH * rows;

  checkPage(gridH + 10);

  // Section title
  doc.setTextColor(...GREEN);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Garden Layout', MARGIN, y);
  y += 5;

  // Draw grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileId = `r${r}c${c}`;
      const tile   = tilesData[tileId] || {};
      const x      = MARGIN + c * cellW;
      const ty     = y + r * cellH;

      // Background
      let bgR = 234, bgG = 255, bgB = 216; // default green-light
      if (tile.color && tile.color.startsWith('#')) {
        const hex = tile.color.replace('#','');
        bgR = parseInt(hex.slice(0,2),16);
        bgG = parseInt(hex.slice(2,4),16);
        bgB = parseInt(hex.slice(4,6),16);
      }
      doc.setFillColor(bgR, bgG, bgB);
      doc.rect(x, ty, cellW, cellH, 'F');

      // Border
      doc.setDrawColor(142, 203, 104);
      doc.setLineWidth(0.2);
      doc.rect(x, ty, cellW, cellH, 'S');

      // Text
      if (tile.title) {
        doc.setTextColor(...BLACK);
        doc.setFontSize(Math.max(5, Math.min(8, cellW * 0.45)));
        doc.setFont('helvetica', 'bold');
        const label = tile.title.slice(0, 12);
        doc.text(label, x + cellW/2, ty + cellH/2 + 1, {
          align: 'center', maxWidth: cellW - 1
        });
      }
    }
  }
  y += gridH + 8;

  // ── Companion planting legend ────────────────────────────────
  const companionWarnings = [];
  const companionGood     = [];
  Object.entries(tilesData).forEach(([id, tile]) => {
    if (!tile.title) return;
    const status = companionMap[id];
    if (status === 'bad')  companionWarnings.push(tile.title);
    if (status === 'good') companionGood.push(tile.title);
  });
  if (companionWarnings.length || companionGood.length) {
    checkPage(20);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
    if (companionGood.length)
      doc.text(`✓ Good companions: ${[...new Set(companionGood)].join(', ')}`, MARGIN, y);
    y += 4;
    if (companionWarnings.length)
      doc.text(`⚠ Companion conflicts: ${[...new Set(companionWarnings)].join(', ')}`, MARGIN, y);
    y += 6;
  }

  // ── Plots detail ────────────────────────────────────────────
  const namedTiles = Object.values(tilesData).filter(t => t.title);
  if (namedTiles.length) {
    checkPage(16);
    doc.setFillColor(...TAN);
    doc.rect(MARGIN, y - 2, W - MARGIN*2, 8, 'F');
    doc.setTextColor(...GREEN);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Plot Details', MARGIN + 2, y + 4);
    y += 10;

    namedTiles.forEach(tile => {
      checkPage(12);
      doc.setFillColor(240, 247, 232);
      doc.rect(MARGIN, y - 1, W - MARGIN*2, tile.description ? 12 : 7, 'F');

      doc.setTextColor(...BLACK);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(tile.title, MARGIN + 2, y + 4);

      if (tile.description) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(tile.description, W - MARGIN*2 - 4);
        doc.text(lines.slice(0, 2), MARGIN + 2, y + 9);
        y += 12;
      } else {
        y += 7;
      }
    });
    y += 4;
  }

  // ── Tasks ─────────────────────────────────────────────────────
  const taskList = Object.values(tasksData || {})
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      const po = ['urgent','high','medium','low','none'];
      return po.indexOf(a.priority) - po.indexOf(b.priority);
    });

  if (taskList.length) {
    checkPage(16);
    doc.setFillColor(...TAN);
    doc.rect(MARGIN, y - 2, W - MARGIN*2, 8, 'F');
    doc.setTextColor(...GREEN);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Open Tasks (${taskList.length})`, MARGIN + 2, y + 4);
    y += 10;

    const PRIOR_COLORS = {
      urgent: [255,179,179], high: [255,213,168],
      medium: [255,243,168], low:  [179,212,255], none: [224,224,224]
    };

    taskList.slice(0, 30).forEach(task => {
      checkPage(8);
      const pc = PRIOR_COLORS[task.priority] || PRIOR_COLORS.none;
      doc.setFillColor(...pc);
      doc.rect(MARGIN, y - 1, 3, 6, 'F');
      doc.setFillColor(248, 248, 248);
      doc.rect(MARGIN + 3, y - 1, W - MARGIN*2 - 3, 6, 'F');

      doc.setTextColor(...BLACK);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', task.priority === 'urgent' ? 'bold' : 'normal');
      doc.text(task.title.slice(0, 55), MARGIN + 5, y + 3);

      if (task.dueDate) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(`Due: ${task.dueDate}`, W - MARGIN - 2, y + 3, { align: 'right' });
      }
      y += 7;
    });

    if (taskList.length > 30) {
      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(`… and ${taskList.length - 30} more tasks`, MARGIN, y + 3);
      y += 7;
    }
    y += 4;
  }

  // ── Frost dates (if available) ───────────────────────────────
  if (frostDates && isFeatureEnabled('frostDates')) {
    checkPage(14);
    doc.setFillColor(212, 236, 255);
    doc.rect(MARGIN, y - 1, W - MARGIN*2, 10, 'F');
    doc.setTextColor(26, 74, 138);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`🌡️  Frost dates for your area`, MARGIN + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`Last spring frost: ~${frostDates.lastSpring}   |   First fall frost: ~${frostDates.firstFall}`,
      MARGIN + 2, y + 9);
    y += 14;
  }

  // ── Footer on each page ──────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text('Ants In Your Plants — antsinyourplants.app', MARGIN, 292);
    doc.text(`Page ${i} of ${pageCount}`, W - MARGIN, 292, { align: 'right' });
    doc.setDrawColor(...GREEN2);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 289, W - MARGIN, 289);
  }

  // ── Save ─────────────────────────────────────────────────────
  const filename = `${(currentGardenData.name || 'garden').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  showToast('PDF exported! 📄', 'success');
}

// ════════════════════════════════════════════════════════════════
// 4. POLISH — UI improvements
// ════════════════════════════════════════════════════════════════

// ── Keyboard shortcuts ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Escape closes any open modal
  if (e.key === 'Escape') {
    const openOverlays = [
      'create-modal-overlay', 'settings-modal-overlay', 'task-modal-overlay',
      'journal-modal-overlay', 'tracking-modal-overlay', 'photo-modal-overlay',
      'crop-rotation-overlay', 'succession-overlay', 'soil-log-overlay',
      'seed-inventory-overlay', 'pest-log-overlay', 'yield-analytics-overlay',
      'messages-overlay', 'notif-overlay', 'plant-library-overlay',
      'tasks-view-overlay', 'profile-sheet-overlay',
    ];
    for (const id of openOverlays) {
      const el = document.getElementById(id);
      if (!el) continue;
      const isOpen = el.classList.contains('open') ||
                     (el.style.display && el.style.display !== 'none');
      if (isOpen) {
        el.classList.remove('open');
        el.style.display = 'none';
        break;
      }
    }
  }

  // Ctrl/Cmd + S saves active tile
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn && document.getElementById('editInfo')?.style.display !== 'none') {
      e.preventDefault();
      saveBtn.click();
    }
  }
});

// ── Pull-to-refresh on mobile home page ──────────────────────────
(function() {
  let startY = 0, pulling = false;
  const pagesWrapper = document.getElementById('pages-wrapper');
  if (!pagesWrapper) return;

  pagesWrapper.addEventListener('touchstart', e => {
    if (document.getElementById('page-home')?.classList.contains('active')) {
      startY = e.touches[0].clientY;
      pulling = pagesWrapper.scrollTop === 0;
    }
  }, { passive: true });

  pagesWrapper.addEventListener('touchend', e => {
    if (!pulling) return;
    const diff = e.changedTouches[0].clientY - startY;
    if (diff > 80) {
      showToast('Refreshing…');
      loadMyGardens();
      if (typeof renderWhatToPlantNow === 'function') renderWhatToPlantNow();
    }
    pulling = false;
  }, { passive: true });
})();

// ── Auto-resize textarea elements ────────────────────────────────
document.querySelectorAll('textarea').forEach(ta => {
  ta.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
  });
});

// ── Smooth scroll garden grid into view on mobile ────────────────
function scrollGridIntoView() {
  if (window.innerWidth >= 768) return;
  const gardenCol = document.querySelector('.garden-col');
  if (gardenCol) {
    gardenCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Debounced window resize for grid ─────────────────────────────
window.addEventListener('resize', debounce(() => {
  if (currentGardenId && currentGardenData) {
    const rows = currentGardenData.rows || 6;
    const cols = currentGardenData.cols || 6;
    const container = document.getElementById('garden-container');
    if (!container) return;
    const maxSize = Math.min(
      window.innerWidth > 768 ? window.innerHeight * 0.75 : window.innerWidth * 0.96,
      700
    );
    container.style.width  = maxSize + 'px';
    container.style.height = maxSize + 'px';
    container.style.fontSize = Math.max(8, Math.min(14, (maxSize / Math.max(rows,cols)) * 0.35)) + 'px';
  }
}, 150));

// ── "Install app" prompt ──────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  const existing = document.getElementById('install-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id        = 'install-banner';
  banner.className = 'install-banner';
  banner.innerHTML = `
    <span class="install-banner-text">🌱 Install Ants In Your Plants for quick access</span>
    <button class="install-banner-btn" id="installConfirmBtn">Install</button>
    <button class="install-banner-dismiss" id="installDismissBtn">✕</button>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.classList.add('visible'), 100);

  document.getElementById('installConfirmBtn').onclick = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') showToast('App installed! 🌱', 'success');
    deferredInstallPrompt = null;
    banner.remove();
  };
  document.getElementById('installDismissBtn').onclick = () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
  };
}

// ── Garden search on home page ────────────────────────────────────
(function addHomeSearch() {
  const header = document.querySelector('#page-home .page-header');
  if (!header) return;

  const searchWrap = document.createElement('div');
  searchWrap.className = 'home-search-wrap';
  searchWrap.innerHTML = `<input id="gardenSearchInput" type="text" placeholder="🔍 Search my gardens…" autocomplete="off"/>`;
  header.insertAdjacentElement('afterend', searchWrap);

  const input = searchWrap.querySelector('input');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('#my-gardens-grid .garden-card, #shared-gardens-grid .garden-card')
      .forEach(card => {
        const name = card.querySelector('.garden-card h3')?.textContent?.toLowerCase() || '';
        card.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
  });
})();

// ── Task overdue badge on garden cards ────────────────────────────
// Called from gardens.js after building a card — adds a badge
// if the garden has overdue tasks
async function addOverdueBadgeToCard(gardenId, cardEl) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snap  = await db.collection('gardens').doc(gardenId)
      .collection('tasks')
      .where('status', 'in', ['todo', 'inprogress'])
      .where('dueDate', '<', today)
      .limit(1)
      .get();
    if (!snap.empty) {
      const meta = cardEl.querySelector('.garden-card-meta');
      if (meta) {
        const badge = document.createElement('span');
        badge.className = 'garden-task-count overdue-badge';
        badge.textContent = '⚠ Overdue tasks';
        meta.appendChild(badge);
      }
    }
  } catch {}
}

// ── Smooth page transitions ───────────────────────────────────────
(function patchNavigateTo() {
  const originalNavigateTo = window.navigateTo;
  if (!originalNavigateTo) return;
  window.navigateTo = function(page) {
    // Call navigate immediately — don't delay with setTimeout
    // Opacity transitions were causing pages to get stuck at opacity:0
    originalNavigateTo(page);
    const newEl = document.querySelector('.page.active');
    if (newEl) {
      // Reset any stuck opacity first
      newEl.style.transition = 'none';
      newEl.style.opacity = '1';
    }
  };
})();

// ── Confirm before leaving a garden with unsaved changes ──────────
let tileHasUnsavedChanges = false;

document.getElementById('titleInput')?.addEventListener('input', () => {
  tileHasUnsavedChanges = true;
});
document.getElementById('descInput')?.addEventListener('input', () => {
  tileHasUnsavedChanges = true;
});
document.getElementById('saveBtn')?.addEventListener('click', () => {
  tileHasUnsavedChanges = false;
});
document.getElementById('exitBtn')?.addEventListener('click', () => {
  if (tileHasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Exit anyway?')) return;
  }
  tileHasUnsavedChanges = false;
});
document.getElementById('backBtn')?.addEventListener('click', () => {
  if (tileHasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Leave the garden?')) return;
  }
  tileHasUnsavedChanges = false;
}, true); // capture phase so it fires before tiles.js handler

// ── Long-press tile for quick actions on mobile ───────────────────
(function addTileLongPress() {
  let pressTimer = null;

  document.getElementById('garden-container')?.addEventListener('touchstart', e => {
    const tile = e.target.closest('.tile');
    if (!tile || !canEditTiles()) return;
    pressTimer = setTimeout(() => {
      const id    = tile.dataset.id;
      const title = tilesData[id]?.title || 'Empty';
      showTileQuickMenu(tile, id, title);
    }, 500);
  }, { passive: true });

  document.getElementById('garden-container')?.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  }, { passive: true });

  document.getElementById('garden-container')?.addEventListener('touchmove', () => {
    clearTimeout(pressTimer);
  }, { passive: true });
})();

function showTileQuickMenu(tileEl, tileId, title) {
  const existing = document.getElementById('tile-quick-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id        = 'tile-quick-menu';
  menu.className = 'tile-quick-menu';

  const actions = [
    { label: '✏ Edit plot',  action: () => { openPanel(tileId); setTimeout(openMobileModal, 50); } },
    { label: '📋 Add task',  action: () => { if (typeof openTaskModal === 'function') openTaskModal(null, tileId); } },
    { label: '🔄 Rotate…',  action: () => { if (typeof openCropRotation === 'function') openCropRotation(); } },
  ];

  menu.innerHTML = `<div class="tqm-title">${escHtml(title)}</div>`;
  actions.forEach(({ label, action }) => {
    const btn = document.createElement('button');
    btn.className  = 'tqm-btn';
    btn.textContent = label;
    btn.onclick = () => { menu.remove(); action(); };
    menu.appendChild(btn);
  });

  const cancel = document.createElement('button');
  cancel.className  = 'tqm-cancel';
  cancel.textContent = 'Cancel';
  cancel.onclick = () => menu.remove();
  menu.appendChild(cancel);

  document.body.appendChild(menu);

  // Close on outside tap
  setTimeout(() => {
    document.addEventListener('touchstart', function dismiss(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('touchstart', dismiss); }
    }, { passive: true });
  }, 50);
}

// ── Expose for garden cards ───────────────────────────────────────
window.addOverdueBadgeToCard = addOverdueBadgeToCard;
