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
// 4. POLISH — UI improvements
// ════════════════════════════════════════════════════════════════

// ── Keyboard shortcuts ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Escape closes any open modal/overlay
  if (e.key === 'Escape') {
    const openOverlays = [
      'create-modal-overlay', 'settings-modal-overlay', 'task-modal-overlay',
      'journal-modal-overlay', 'tracking-modal-overlay', 'photo-modal-overlay',
      'crop-rotation-overlay', 'succession-overlay', 'soil-log-overlay',
      'seed-inventory-overlay', 'pest-log-overlay', 'yield-analytics-overlay',
      'notif-overlay', 'plant-library-overlay',
      'tasks-view-overlay', 'profile-sheet-overlay',
    ];
    for (const id of openOverlays) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.classList.contains('open') || (el.style.display && el.style.display !== 'none')) {
        el.classList.remove('open');
        el.style.display = 'none';
        break;
      }
    }
  }

  // Ctrl/Cmd + S saves active tile panel
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) { e.preventDefault(); saveBtn.click(); }
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
