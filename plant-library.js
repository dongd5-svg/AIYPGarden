// ================================================================
// MODE.JS — app mode system (simple | standard | advanced)
//           and per-feature visibility toggles
// ================================================================

// ── Mode definitions ──────────────────────────────────────────────
const MODES = {
  simple: {
    label: '🌱 Simple',
    features: {
      tasks:          true,
      weather:        true,
      plantLibrary:   true,
      companionPlant: true,
      frostDates:     false,
      calendar:       false,
      tracking:       false,
      journal:        false,
      photoTimeline:  false,
      careReminders:  false,
      cropRotation:   false,
      soilLog:        false,
      seedInventory:  false,
      pestLog:        false,
      yieldAnalytics: false,
      succession:     false,
    }
  },
  standard: {
    label: '🌿 Standard',
    features: {
      tasks:          true,
      weather:        true,
      plantLibrary:   true,
      companionPlant: true,
      frostDates:     true,
      calendar:       true,
      tracking:       true,
      journal:        true,
      photoTimeline:  true,
      careReminders:  true,
      cropRotation:   false,
      soilLog:        false,
      seedInventory:  false,
      pestLog:        false,
      yieldAnalytics: false,
      succession:     false,
    }
  },
  advanced: {
    label: '🌳 Advanced',
    features: {
      tasks:          true,
      weather:        true,
      plantLibrary:   true,
      companionPlant: true,
      frostDates:     true,
      calendar:       true,
      tracking:       true,
      journal:        true,
      photoTimeline:  true,
      careReminders:  true,
      cropRotation:   true,
      soilLog:        true,
      seedInventory:  true,
      pestLog:        true,
      yieldAnalytics: true,
      succession:     true,
    }
  }
};

const FEATURE_LABELS = {
  tasks:          { label: 'Tasks',                   emoji: '📋' },
  weather:        { label: 'Weather widget',           emoji: '🌤' },
  plantLibrary:   { label: 'Plant library & lookup',  emoji: '🌱' },
  companionPlant: { label: 'Companion planting',      emoji: '🌿' },
  frostDates:     { label: 'Frost date alerts',       emoji: '🌡️' },
  calendar:       { label: 'Calendar',                emoji: '📅' },
  tracking:       { label: 'Harvest & spending log',  emoji: '📊' },
  journal:        { label: 'Garden journal',          emoji: '📓' },
  photoTimeline:  { label: 'Plot photo timeline',     emoji: '📷' },
  careReminders:  { label: 'Plant care reminders',    emoji: '🔔' },
  cropRotation:   { label: 'Crop rotation tracker',   emoji: '🔄' },
  soilLog:        { label: 'Soil amendment log',      emoji: '🪱' },
  seedInventory:  { label: 'Seed inventory',          emoji: '🫘' },
  pestLog:        { label: 'Pest & disease log',      emoji: '🐛' },
  yieldAnalytics: { label: 'Yield analytics',         emoji: '📈' },
  succession:     { label: 'Succession planting',     emoji: '🗓' },
};

// ── Runtime state ─────────────────────────────────────────────────
let appMode     = 'standard';
let appFeatures = { ...MODES.standard.features };

// ── Load from Firestore ───────────────────────────────────────────
async function loadUserMode(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    const data = doc.data() || {};
    appMode = data.appMode || 'standard';
    // Merge saved overrides on top of mode defaults
    appFeatures = {
      ...MODES[appMode].features,
      ...(data.featureOverrides || {}),
    };
  } catch (e) {
    appMode = 'standard';
    appFeatures = { ...MODES.standard.features };
  }
  applyMode();
}

// ── Save mode ─────────────────────────────────────────────────────
async function saveUserMode(mode) {
  appMode = mode;
  appFeatures = { ...MODES[mode].features };
  applyMode();
  await db.collection('users').doc(currentUser.uid).update({
    appMode,
    featureOverrides: {}
  });
  updateModeToggleUI();
  renderFeatureToggles();
  showToast(`Switched to ${MODES[mode].label}`);
}

// ── Save individual feature override ─────────────────────────────
async function saveFeatureOverride(feature, enabled) {
  appFeatures[feature] = enabled;
  applyMode();
  // Save overrides (diff from mode default)
  const overrides = {};
  const modeDefaults = MODES[appMode].features;
  Object.keys(appFeatures).forEach(k => {
    if (appFeatures[k] !== modeDefaults[k]) overrides[k] = appFeatures[k];
  });
  await db.collection('users').doc(currentUser.uid).update({
    featureOverrides: overrides
  });
}

// ── Apply mode to DOM ─────────────────────────────────────────────
function applyMode() {
  // Show/hide calendar nav
  const calBtn = document.querySelector('[data-page="calendar"]');
  if (calBtn) calBtn.style.display = isFeatureEnabled('calendar') ? '' : 'none';
  const mobCalBtn = document.querySelector('.mob-nav-btn[data-page="calendar"]');
  if (mobCalBtn) mobCalBtn.style.display = isFeatureEnabled('calendar') ? '' : 'none';

  // Show/hide garden header buttons
  const journalBtn  = document.getElementById('gardenJournalBtn');
  const trackingBtn = document.getElementById('gardenTrackingBtn');
  if (journalBtn)  journalBtn.style.display  = isFeatureEnabled('journal')   ? '' : 'none';
  if (trackingBtn) trackingBtn.style.display = isFeatureEnabled('tracking')  ? '' : 'none';

  // Show/hide advanced feature buttons
  const advancedBtnMap = {
    gardenCropRotationBtn: 'cropRotation',
    gardenSuccessionBtn:   'succession',
    gardenSoilLogBtn:      'soilLog',
    gardenPestLogBtn:      'pestLog',
    gardenYieldBtn:        'yieldAnalytics',
  };
  Object.entries(advancedBtnMap).forEach(([id, feature]) => {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = isFeatureEnabled(feature) ? '' : 'none';
  });

  // Seed inventory sheet section
  const seedSection = document.getElementById('seedInventorySheetSection');
  if (seedSection) seedSection.style.display = isFeatureEnabled('seedInventory') ? '' : 'none';
  // Show/hide panel history tab
  const histTab  = document.getElementById('tabHistory');
  const mHistTab = document.getElementById('mTabHistory');
  if (histTab)  histTab.style.display  = isFeatureEnabled('photoTimeline') ? '' : 'none';
  if (mHistTab) mHistTab.style.display = isFeatureEnabled('photoTimeline') ? '' : 'none';
}

// ── Check if a feature is enabled ────────────────────────────────
function isFeatureEnabled(feature) {
  return appFeatures[feature] !== false;
}

// ── Profile sheet mode toggle UI ─────────────────────────────────
function updateModeToggleUI() {
  document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === appMode);
  });
}

function renderFeatureToggles() {
  const list = document.getElementById('featureTogglesList');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(FEATURE_LABELS).forEach(([key, meta]) => {
    const row = document.createElement('label');
    row.className = 'feature-toggle-row';
    row.innerHTML = `
      <span class="feature-toggle-label">${meta.emoji} ${meta.label}</span>
      <input type="checkbox" class="feature-toggle-cb" data-feature="${key}"
        ${appFeatures[key] ? 'checked' : ''}/>
    `;
    row.querySelector('input').onchange = e =>
      saveFeatureOverride(key, e.target.checked);
    list.appendChild(row);
  });
}

// ── Mode toggle buttons in profile sheet ─────────────────────────
document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
  btn.onclick = () => saveUserMode(btn.dataset.mode);
});
