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
    loadMyGardens();
    initWeather();
    if (typeof renderWhatToPlantNow === 'function') renderWhatToPlantNow();

    // Handle ?g=gardenId deep links — opens garden directly after auth
    const deepLinked = await handleDeepLink();
    if (!deepLinked) navigateTo('home');

    // Show onboarding only if not yet completed AND not a deep link visitor
    if (!userData.onboardingDone && !deepLinked) {
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
      appMode: 'grower', featureOverrides: {}, onboardingDone: false,
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

  // Push garden ID to URL so it's shareable
  const url = new URL(window.location.href);
  url.searchParams.set('g', gardenId);
  // replaceState if we're already on a ?g= URL (deep link), pushState otherwise
  if (new URL(window.location.href).searchParams.get('g')) {
    window.history.replaceState({ gardenId }, '', url);
  } else {
    window.history.pushState({ gardenId }, '', url);
  }

  applyMode();
  initTiles(gardenId, gardenData);
  initTasks(gardenId);
  initGardenCalendar(gardenId, gardenData);
  if (isFeatureEnabled('tracking')) initTracking(gardenId, gardenData);
}

function exitGarden() {
  if (typeof cleanupTiles === 'function') cleanupTiles();
  if (typeof cleanupTasks === 'function') cleanupTasks();
  currentGardenId = null; currentGardenData = null; isGardenOwner = false;
  // Clean garden ID from URL
  const url = new URL(window.location.href);
  url.searchParams.delete('g');
  window.history.replaceState({}, '', url);
}

document.getElementById('backBtn').onclick = () => { exitGarden(); navigateTo('home'); };

// Share button — uses Web Share API on mobile, clipboard on desktop
document.getElementById('gardenShareBtn').onclick = async () => {
  const url  = window.location.href;
  const name = currentGardenData?.name || 'Garden';
  // Web Share API works natively on mobile (shows share sheet)
  if (navigator.share) {
    try {
      await navigator.share({ title: name, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled — fine
    }
  }
  // Desktop fallback — clipboard
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied! 🔗');
  } catch {
    // Last resort — select-all prompt
    const inp = document.createElement('input');
    inp.value = url; document.body.appendChild(inp);
    inp.select(); document.execCommand('copy');
    document.body.removeChild(inp);
    showToast('Link copied! 🔗');
  }
};

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const gid = new URL(window.location.href).searchParams.get('g');
  if (!gid) { exitGarden(); navigateTo('home'); }
});

// ── Deep link: load garden from URL on startup ────────────────────
async function handleDeepLink() {
  const gid = new URL(window.location.href).searchParams.get('g');
  if (!gid) return false;
  try {
    const snap = await db.collection('gardens').doc(gid).get();
    if (!snap.exists) {
      console.warn('Deep link: garden not found', gid);
      return false;
    }
    const data = snap.data();
    const isOwn    = currentUser && data.ownerId === currentUser.uid;
    const isCollab = currentUser &&
      (data.collaboratorEmails || []).includes((currentUser.email || '').toLowerCase());
    const isPublic = data.visibility === 'public';
    if (!isOwn && !isCollab && !isPublic) {
      console.warn('Deep link: no permission for garden', gid);
      showToast('This garden is private', 'error');
      return false;
    }
    openGardenPage(gid, data, isOwn || false);
    return true;
  } catch (e) {
    console.error('Deep link error:', e);
    return false;
  }
}

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
