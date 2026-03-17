// ================================================================
// ONBOARDING.JS — first-login flow + profile sheet
// ================================================================

let selectedObMode    = 'standard';
let userLocation      = null; // { lat, lon, city, zip }
let onboardingDone    = false;

// ── Entry point called from app.js after login ───────────────────
async function checkOnboarding(user) {
  const doc = await db.collection('users').doc(user.uid).get();
  onboardingDone = doc.data()?.onboardingDone === true;

  if (!onboardingDone) {
    showOnboarding();
  } else {
    // Load saved location
    const data = doc.data() || {};
    if (data.location) {
      userLocation = data.location;
      updateLocationDisplay();
    }
  }
}

// ── Show onboarding ───────────────────────────────────────────────
function showOnboarding() {
  document.getElementById('onboarding').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  // Go to mode picker (step 1) — user is already authenticated at this point
  showObScreen('ob-mode');
}

function showObScreen(id) {
  document.querySelectorAll('.ob-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function finishOnboarding() {
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  // Save onboardingDone — fire and forget is fine here, app is already visible
  db.collection('users').doc(currentUser.uid).update({
    onboardingDone: true,
    appMode: selectedObMode,
  });
  appMode     = selectedObMode;
  appFeatures = { ...MODES[appMode].features };
  applyMode();
  // App is already booted — just refresh gardens and greeting
  setGreeting();
  loadMyGardens();
  if (typeof renderWhatToPlantNow === 'function') renderWhatToPlantNow();
}

// ── Login screen (handled by app.js googleBtn) ────────────────────
// After login, auth.onAuthStateChanged calls checkOnboarding
// which routes here if needed

// ── Step 1: Mode picker ───────────────────────────────────────────
document.querySelectorAll('.mode-card').forEach(card => {
  card.onclick = () => {
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedObMode = card.dataset.mode;
  };
});

document.getElementById('confirmModeBtn').onclick = () => showObScreen('ob-location');
document.getElementById('skipModeBtn').onclick    = () => showObScreen('ob-location');

// ── Step 2: Location ──────────────────────────────────────────────
document.getElementById('detectLocationBtn').onclick = () => {
  const status = document.getElementById('locationStatus');
  status.style.display = 'block';
  status.textContent = '📍 Detecting your location…';
  status.className = 'location-status';

  if (!navigator.geolocation) {
    status.textContent = '⚠ Geolocation not supported by your browser.';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      // Reverse geocode
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${userLocation.lat}&lon=${userLocation.lon}&format=json`
        );
        const geo = await res.json();
        userLocation.city = geo.address?.city || geo.address?.town || geo.address?.village || '';
        userLocation.country = geo.address?.country_code?.toUpperCase() || '';
      } catch {}
      status.textContent = `✓ ${userLocation.city || `${userLocation.lat.toFixed(2)}°, ${userLocation.lon.toFixed(2)}°`}`;
      status.className = 'location-status success';
    },
    () => {
      status.textContent = '⚠ Could not detect location. Try entering your zip code.';
      status.className = 'location-status error';
    },
    { timeout: 8000 }
  );
};

document.getElementById('zipInput').addEventListener('change', async function() {
  const zip = this.value.trim();
  if (!zip) return;
  const status = document.getElementById('locationStatus');
  status.style.display = 'block';
  status.textContent = '🔍 Looking up…';
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zip)}&format=json&limit=1`
    );
    const results = await res.json();
    if (results.length) {
      userLocation = {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
        city: results[0].display_name.split(',')[0],
        zip,
      };
      status.textContent = `✓ ${userLocation.city}`;
      status.className = 'location-status success';
    } else {
      status.textContent = '⚠ Zip not found. Try a different format.';
      status.className = 'location-status error';
    }
  } catch {
    status.textContent = '⚠ Could not look up location.';
    status.className = 'location-status error';
  }
});

document.getElementById('confirmLocationBtn').onclick = async () => {
  if (userLocation) {
    await db.collection('users').doc(currentUser.uid).update({ location: userLocation });
    await fetchFrostDates();
  }
  showObScreen('ob-garden');
};
document.getElementById('skipLocationBtn').onclick = () => showObScreen('ob-garden');

// ── Step 3: First garden ──────────────────────────────────────────
// Fix stepper buttons in onboarding
document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.onclick = () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const dir = parseInt(btn.dataset.dir);
    const newVal = Math.min(+input.max || 20, Math.max(+input.min || 2, +input.value + dir));
    input.value = newVal;
  };
});

document.getElementById('createFirstGardenBtn').onclick = async () => {
  const name = document.getElementById('ob-gardenName').value.trim();
  if (!name) { document.getElementById('ob-gardenName').focus(); return; }
  const rows = Math.min(20, Math.max(2, +document.getElementById('ob-rows').value || 6));
  const cols = Math.min(20, Math.max(2, +document.getElementById('ob-cols').value || 6));
  await createGardenInFirestore(name, rows, cols, 'private');
  finishOnboarding();
};

document.getElementById('skipGardenBtn').onclick = finishOnboarding;

// ── Profile sheet ─────────────────────────────────────────────────
const profileSheetOverlay = document.getElementById('profile-sheet-overlay');

document.getElementById('profileAvatarBtn').onclick = openProfileSheet;

// Mobile profile nav button — if there are unread notifications, open notifications
// otherwise open profile sheet
document.getElementById('profileNavBtn').onclick = () => {
  if (typeof unreadNotifCount !== 'undefined' && unreadNotifCount > 0) {
    if (typeof openNotifModal === 'function') openNotifModal();
  } else {
    openProfileSheet();
  }
};

profileSheetOverlay.addEventListener('click', e => {
  if (e.target === profileSheetOverlay) closeProfileSheet();
});

function openProfileSheet() {
  if (!currentUser) return;
  // Fill avatar
  const img = document.getElementById('sheetProfileImg');
  const ini = document.getElementById('sheetProfileInitial');
  if (currentUser.photoURL) {
    img.src = currentUser.photoURL;
    img.style.display = 'block';
    ini.style.display = 'none';
  } else {
    img.style.display = 'none';
    ini.style.display = 'flex';
    ini.textContent = (currentUser.displayName || currentUser.email || '?')[0].toUpperCase();
  }
  document.getElementById('sheetProfileName').textContent  = currentUser.displayName || '';
  document.getElementById('sheetProfileEmail').textContent = currentUser.email || '';

  updateModeToggleUI();
  renderFeatureToggles();
  updateLocationDisplay();
  profileSheetOverlay.classList.add('open');
}

function closeProfileSheet() {
  profileSheetOverlay.classList.remove('open');
}

document.getElementById('changeLocationBtn').onclick = async () => {
  const zip = prompt('Enter your zip / postal code:');
  if (!zip) return;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zip)}&format=json&limit=1`
    );
    const results = await res.json();
    if (results.length) {
      userLocation = {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
        city: results[0].display_name.split(',')[0],
        zip,
      };
      await db.collection('users').doc(currentUser.uid).update({ location: userLocation });
      await fetchFrostDates();
      updateLocationDisplay();
      showToast(`Location updated to ${userLocation.city}`);
    } else {
      showToast('Location not found', 'error');
    }
  } catch {
    showToast('Could not update location', 'error');
  }
};

function updateLocationDisplay() {
  const el = document.getElementById('locationDisplay');
  if (!el) return;
  el.textContent = userLocation?.city
    ? `📍 ${userLocation.city}`
    : 'Not set — tap to add';
}

// ── Frost date fetching ───────────────────────────────────────────
// Uses Open-Meteo historical climate data to estimate frost dates
let frostDates = null; // { lastSpring: 'Apr 15', firstFall: 'Oct 20' }

async function fetchFrostDates() {
  if (!userLocation?.lat) return;
  try {
    const { lat, lon } = userLocation;
    // Get daily min temps for last 2 years to calculate frost dates
    const end   = new Date().toISOString().split('T')[0];
    const start = new Date(new Date().setFullYear(new Date().getFullYear() - 2))
                    .toISOString().split('T')[0];
    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${start}&end_date=${end}` +
      `&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`
    );
    const data = await res.json();
    if (!data.daily) return;

    const dates = data.daily.time;
    const mins  = data.daily.temperature_2m_min;
    const FROST = 32; // °F

    // Find average last spring frost (latest frost in spring = Mar-May)
    const springFrosts = [];
    const fallFrosts   = [];

    // Group by year
    const byYear = {};
    dates.forEach((d, i) => {
      const year = d.slice(0, 4);
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push({ date: d, min: mins[i] });
    });

    Object.values(byYear).forEach(yearDays => {
      // Last spring frost: last day below 32°F in Mar-May
      const springFrost = yearDays
        .filter(d => {
          const m = parseInt(d.date.slice(5, 7));
          return m >= 3 && m <= 5 && d.min <= FROST;
        })
        .pop();
      if (springFrost) springFrosts.push(springFrost.date.slice(5)); // MM-DD

      // First fall frost: first day below 32°F in Sep-Nov
      const fallFrost = yearDays
        .filter(d => {
          const m = parseInt(d.date.slice(5, 7));
          return m >= 9 && m <= 11 && d.min <= FROST;
        })
        .shift();
      if (fallFrost) fallFrosts.push(fallFrost.date.slice(5));
    });

    const avgFrostDate = arr => {
      if (!arr.length) return null;
      const avgDay = Math.round(
        arr.map(d => {
          const [m, day] = d.split('-').map(Number);
          return m * 30 + day;
        }).reduce((a, b) => a + b, 0) / arr.length
      );
      const m = Math.floor(avgDay / 30);
      const d = avgDay % 30 || 1;
      return new Date(2000, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    frostDates = {
      lastSpring: avgFrostDate(springFrosts) || 'Unknown',
      firstFall:  avgFrostDate(fallFrosts)   || 'Unknown',
    };

    // Save to Firestore
    await db.collection('users').doc(currentUser.uid).update({ frostDates });
    showFrostBanner();
  } catch (e) {
    console.warn('Frost dates error:', e.message);
  }
}

// ── Frost banner ──────────────────────────────────────────────────
function showFrostBanner() {
  if (!frostDates || !isFeatureEnabled('frostDates')) return;
  const banner = document.getElementById('frostBanner');
  if (!banner) return;

  // Check if we're within 2 weeks of a frost date
  const today   = new Date();
  const year    = today.getFullYear();
  const warning = checkFrostWarning(today, year);

  if (warning) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <span class="frost-icon">🧊</span>
      <div>
        <strong>${warning.title}</strong>
        <span>${warning.body}</span>
      </div>
      <button class="frost-dismiss" onclick="this.parentElement.style.display='none'">✕</button>
    `;
  } else {
    banner.style.display = 'none';
  }
}

function checkFrostWarning(today, year) {
  if (!frostDates) return null;
  const parseDate = (str, yr) => {
    try { return new Date(`${str} ${yr}`); } catch { return null; }
  };

  const springFrost = parseDate(frostDates.lastSpring, year);
  const fallFrost   = parseDate(frostDates.firstFall, year);
  const TWO_WEEKS   = 14 * 24 * 60 * 60 * 1000;

  if (springFrost) {
    const diff = springFrost - today;
    if (diff > 0 && diff < TWO_WEEKS)
      return {
        title: `Last frost in ~${Math.ceil(diff/86400000)} days`,
        body:  `Average last spring frost: ${frostDates.lastSpring}. Hold off on tender seedlings.`
      };
    if (diff < 0 && diff > -TWO_WEEKS)
      return {
        title: 'Past average last frost date',
        body:  `Average: ${frostDates.lastSpring}. Generally safe to plant outdoors now.`
      };
  }
  if (fallFrost) {
    const diff = fallFrost - today;
    if (diff > 0 && diff < TWO_WEEKS)
      return {
        title: `First fall frost in ~${Math.ceil(diff/86400000)} days`,
        body:  `Average first fall frost: ${frostDates.firstFall}. Start bringing in tender plants.`
      };
  }
  return null;
}

// ── Helper: create garden from onboarding ────────────────────────
async function createGardenInFirestore(name, rows, cols, visibility) {
  return db.collection('gardens').add({
    name, rows, cols,
    ownerId:            currentUser.uid,
    ownerName:          currentUser.displayName || currentUser.email,
    ownerEmail:         currentUser.email,
    visibility,
    publicPermission:   'viewonly',
    collaboratorEmails: [],
    taskDisplayMode:    'color',
    companionPlanting:  true,
    showWeather:        true,
    currentSeason:      'spring',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
