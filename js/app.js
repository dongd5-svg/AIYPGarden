// ================================================================
// APP.JS — auth, global state, navigation
// ================================================================

// Firebase instances (set after initializeApp in index.html)
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();
const provider = new firebase.auth.GoogleAuthProvider();

// ── Global state ─────────────────────────────────────────────────
let currentUser       = null;
let currentGardenId   = null;
let currentGardenData = null;
let isGardenOwner     = false;
let currentPage       = 'home';        // home | public | community | garden
let currentCommTab    = 'feed';        // feed | dms | post | search | profile

// ── Auth ─────────────────────────────────────────────────────────
document.getElementById('googleBtn').onclick = () =>
  auth.signInWithPopup(provider).catch(err => alert(err.message));

document.getElementById('signOutBtn').onclick = () => auth.signOut();

auth.onAuthStateChanged(async user => {
  currentUser = user;
  const loginGate = document.getElementById('loginGate');
  const appShell  = document.getElementById('app');

  if (user) {
    loginGate.style.display = 'none';
    appShell.style.display  = 'block';

    // Nav display name
    document.getElementById('userNameDisplay').textContent =
      user.displayName || user.email;

    // Profile image
    if (user.photoURL) {
      document.getElementById('profileImg').src = user.photoURL;
      document.getElementById('notifProfileImg').src = user.photoURL;
    }

    // Ensure user document exists in Firestore
    await ensureUserDoc(user);

    // Boot all modules
    initNotifications();
    navigateTo('home');
    loadMyGardens();

  } else {
    loginGate.style.display = 'flex';
    appShell.style.display  = 'none';
  }
});

// Create/update user profile doc
async function ensureUserDoc(user) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid:         user.uid,
      displayName: user.displayName || user.email,
      email:       user.email,
      photoURL:    user.photoURL || '',
      bio:         '',
      following:   [],
      followers:   [],
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // Keep displayName and photoURL in sync with Google
    await ref.update({
      displayName: user.displayName || user.email,
      photoURL:    user.photoURL || '',
      email:       user.email
    });
  }
}

// ── Navigation ───────────────────────────────────────────────────
function navigateTo(page) {
  // If leaving garden, clean up
  if (currentPage === 'garden' && page !== 'garden') exitGarden();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  currentPage = page;

  // Page-specific init
  if (page === 'public')    loadPublicGardens();
  if (page === 'community') initCommunity();
  if (page === 'calendar')  initConsolidatedCalendar();
}

// Main nav buttons
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => navigateTo(btn.dataset.page);
});

document.getElementById('navLogo').onclick = () => navigateTo('home');

// ── Garden open/exit (called by gardens.js) ───────────────────────
function openGardenPage(gardenId, gardenData, isOwn) {
  currentGardenId   = gardenId;
  currentGardenData = gardenData;
  isGardenOwner     = isOwn;

  document.getElementById('gardenTitle').textContent = gardenData.name || 'Garden';
  document.getElementById('gardenOwnerBadge').textContent =
    isOwn ? '' : `by ${gardenData.ownerName || 'unknown'}`;
  document.getElementById('gardenSettingsBtn').style.display =
    (isOwn && gardenData.ownerId === currentUser?.uid) ? 'inline-block' : 'none';

  // Season selector
  updateSeasonDisplay();

  // Navigate
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-garden').classList.add('active');
  currentPage = 'garden';

  // Init garden modules
  initTiles(gardenId, gardenData);
  initTasks(gardenId);
  initGardenCalendar(gardenId, gardenData);
  initTracking(gardenId, gardenData);
  initWeather();
}

function exitGarden() {
  cleanupTiles();
  cleanupTasks();
  currentGardenId   = null;
  currentGardenData = null;
  isGardenOwner     = false;
}

document.getElementById('backBtn').onclick = () => {
  exitGarden();
  navigateTo('home');
};
