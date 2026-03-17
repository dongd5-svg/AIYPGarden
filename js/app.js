// ================================================================
// APP.JS — auth, navigation, global state
// ================================================================

const auth     = firebase.auth();
const db       = firebase.firestore();
const storage  = firebase.storage();
const provider = new firebase.auth.GoogleAuthProvider();

// ── Global state ──────────────────────────────────────────────────
let currentUser       = null;
let currentGardenId   = null;
let currentGardenData = null;
let isGardenOwner     = false;
let currentPage       = 'home';

// ── Auth ──────────────────────────────────────────────────────────
document.getElementById('googleBtn').onclick = () =>
  auth.signInWithPopup(provider).catch(err => showToast(err.message, 'error'));

document.getElementById('signOutBtn').onclick = () => {
  closeProfileSheet();
  auth.signOut();
};

auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    // Always hide the login screen immediately
    document.getElementById('onboarding').style.display = 'none';

    // Ensure user doc exists (creates it for new users)
    await ensureUserDoc(user);

    // Load mode preferences
    await loadUserMode(user.uid);

    // Profile image
    if (user.photoURL) document.getElementById('profileImg').src = user.photoURL;
    else document.getElementById('profileImg').style.display = 'none';

    // Load saved location and frost dates
    const userDoc  = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data() || {};
    if (userData.location)   userLocation = userData.location;
    if (userData.frostDates) { frostDates = userData.frostDates; showFrostBanner(); }

    // Always boot the app — onboarding shows as an overlay on top if needed
    document.getElementById('app').style.display = 'block';
    setGreeting();
    navigateTo('home');
    loadMyGardens();
    initWeather();
    if (typeof renderWhatToPlantNow === 'function') renderWhatToPlantNow();
    if (typeof initMessaging === 'function') initMessaging();

    // Show onboarding overlay if not yet completed (non-blocking — app loads behind it)
    if (!userData.onboardingDone) {
      await checkOnboarding(user);
    } else {
      if (userData.location) updateLocationDisplay();
    }

  } else {
    // Not signed in — show login screen
    document.getElementById('onboarding').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    showObScreen('ob-login');
  }
});

async function ensureUserDoc(user) {
  const ref  = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid: user.uid, displayName: user.displayName || user.email,
      email: user.email, photoURL: user.photoURL || '',
      appMode: 'standard', featureOverrides: {}, onboardingDone: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({
      displayName: user.displayName || user.email,
      photoURL: user.photoURL || '', email: user.email,
    });
  }
}

function setGreeting() {
  const h    = new Date().getHours();
  const name = currentUser?.displayName?.split(' ')[0] || '';
  const g    = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const e    = h < 12 ? '🌤' : h < 17 ? '☀️' : '🌙';
  const el   = document.getElementById('homeGreeting');
  if (el) el.textContent = `${g}${name ? `, ${name}` : ''} ${e}`;
}

// ── Navigation ────────────────────────────────────────────────────
function navigateTo(page) {
  if (currentPage === 'garden' && page !== 'garden') exitGarden();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .mob-nav-btn').forEach(b => b.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));
  currentPage = page;
  if (page === 'public')   loadPublicGardens();
  if (page === 'calendar') initConsolidatedCalendar();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => navigateTo(btn.dataset.page);
});
document.getElementById('navLogo').onclick = () => navigateTo('home');
document.querySelectorAll('.mob-nav-btn[data-page]').forEach(btn => {
  btn.onclick = () => navigateTo(btn.dataset.page);
});

// ── Garden open/exit ──────────────────────────────────────────────
function openGardenPage(gardenId, gardenData, isOwn) {
  // Always clean up previous garden first
  exitGarden();

  currentGardenId = gardenId; currentGardenData = gardenData; isGardenOwner = isOwn;
  document.getElementById('gardenTitle').textContent = gardenData.name || 'Garden';
  document.getElementById('gardenOwnerBadge').textContent =
    isOwn ? '' : `by ${gardenData.ownerName || 'unknown'}`;
  document.getElementById('gardenSettingsBtn').style.display =
    (isOwn && gardenData.ownerId === currentUser?.uid) ? '' : 'none';
  updateSeasonDisplay();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-garden').classList.add('active');
  const pw = document.getElementById('pages-wrapper');
  if (pw) pw.scrollTop = 0;
  currentPage = 'garden';
  applyMode();
  initTiles(gardenId, gardenData);
  initTasks(gardenId);
  initGardenCalendar(gardenId, gardenData);
  if (isFeatureEnabled('tracking')) initTracking(gardenId, gardenData);
}

function exitGarden() {
  cleanupTiles(); cleanupTasks();
  currentGardenId = null; currentGardenData = null; isGardenOwner = false;
}

document.getElementById('backBtn').onclick = () => { exitGarden(); navigateTo('home'); };

// ── Color swatches ────────────────────────────────────────────────
const TILE_COLORS = [
  '#eaffd8','#ffd5a8','#fff3a8','#b3d4ff','#ffb3b3',
  '#d4f5d4','#f5d4f5','#d4e8ff','#ffe8b3','#e8e8ff',
  '#c8f0c8','#f0c8c8','#c8d8f0','#f0e8c8','#ffffff',
];

function renderColorSwatches(containerId, inputId, currentColor) {
  const container = document.getElementById(containerId);
  const input     = document.getElementById(inputId);
  if (!container || !input) return;
  container.innerHTML = '';
  TILE_COLORS.forEach(hex => {
    const s = document.createElement('button');
    s.className = 'color-swatch' + (hex === currentColor ? ' selected' : '');
    s.style.background = hex; s.title = hex;
    s.onclick = e => {
      e.preventDefault(); input.value = hex;
      container.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    };
    container.appendChild(s);
  });
  const custom = document.createElement('button');
  custom.className = 'color-swatch color-swatch-custom';
  custom.title = 'Custom'; custom.textContent = '+';
  custom.onclick = e => { e.preventDefault(); input.style.display = 'inline-block'; input.click(); };
  input.oninput = () => container.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
  container.appendChild(custom);
}
