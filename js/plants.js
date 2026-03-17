// ================================================================
// PLANTS.JS — plant database, OpenFarm API, companion planting
// ================================================================

// ── Hardcoded fallback plant database ────────────────────────────
// Used when OpenFarm is unavailable or returns no result
const PLANT_DB = {
  'tomato':      { name:'Tomato',      sun:'Full sun',    water:'Regular',  days:70,  spacing:'24"', season:['spring','summer'], companions:['basil','carrot','marigold','parsley'], avoid:['fennel','cabbage','corn'] },
  'tomatoes':    { name:'Tomatoes',    sun:'Full sun',    water:'Regular',  days:70,  spacing:'24"', season:['spring','summer'], companions:['basil','carrot','marigold'], avoid:['fennel','cabbage'] },
  'basil':       { name:'Basil',       sun:'Full sun',    water:'Regular',  days:30,  spacing:'6"',  season:['spring','summer'], companions:['tomato','pepper'],           avoid:['sage'] },
  'carrot':      { name:'Carrot',      sun:'Full sun',    water:'Regular',  days:75,  spacing:'3"',  season:['spring','fall'],   companions:['tomato','lettuce','onion'],  avoid:['dill'] },
  'carrots':     { name:'Carrots',     sun:'Full sun',    water:'Regular',  days:75,  spacing:'3"',  season:['spring','fall'],   companions:['tomato','lettuce','onion'],  avoid:['dill'] },
  'lettuce':     { name:'Lettuce',     sun:'Partial',     water:'Regular',  days:45,  spacing:'8"',  season:['spring','fall'],   companions:['carrot','radish','strawberry'], avoid:['celery'] },
  'spinach':     { name:'Spinach',     sun:'Partial',     water:'Regular',  days:40,  spacing:'6"',  season:['spring','fall'],   companions:['strawberry','pea'],          avoid:[] },
  'pepper':      { name:'Pepper',      sun:'Full sun',    water:'Regular',  days:80,  spacing:'18"', season:['spring','summer'], companions:['basil','carrot','tomato'],   avoid:['fennel'] },
  'peppers':     { name:'Peppers',     sun:'Full sun',    water:'Regular',  days:80,  spacing:'18"', season:['spring','summer'], companions:['basil','carrot'],            avoid:['fennel'] },
  'cucumber':    { name:'Cucumber',    sun:'Full sun',    water:'Heavy',    days:55,  spacing:'12"', season:['summer'],          companions:['bean','pea','sunflower'],    avoid:['potato','sage'] },
  'cucumbers':   { name:'Cucumbers',   sun:'Full sun',    water:'Heavy',    days:55,  spacing:'12"', season:['summer'],          companions:['bean','pea'],                avoid:['potato'] },
  'zucchini':    { name:'Zucchini',    sun:'Full sun',    water:'Regular',  days:50,  spacing:'24"', season:['summer'],          companions:['bean','nasturtium'],         avoid:['potato'] },
  'squash':      { name:'Squash',      sun:'Full sun',    water:'Regular',  days:60,  spacing:'24"', season:['summer'],          companions:['corn','bean','nasturtium'],  avoid:['potato'] },
  'bean':        { name:'Bean',        sun:'Full sun',    water:'Regular',  days:55,  spacing:'4"',  season:['spring','summer'], companions:['carrot','cucumber','squash'], avoid:['onion','garlic'] },
  'beans':       { name:'Beans',       sun:'Full sun',    water:'Regular',  days:55,  spacing:'4"',  season:['spring','summer'], companions:['carrot','cucumber'],         avoid:['onion','garlic'] },
  'pea':         { name:'Pea',         sun:'Full sun',    water:'Regular',  days:60,  spacing:'2"',  season:['spring','fall'],   companions:['carrot','radish','spinach'], avoid:['onion','garlic'] },
  'peas':        { name:'Peas',        sun:'Full sun',    water:'Regular',  days:60,  spacing:'2"',  season:['spring','fall'],   companions:['carrot','radish'],           avoid:['onion','garlic'] },
  'corn':        { name:'Corn',        sun:'Full sun',    water:'Heavy',    days:90,  spacing:'12"', season:['summer'],          companions:['bean','squash','pumpkin'],   avoid:['tomato'] },
  'potato':      { name:'Potato',      sun:'Full sun',    water:'Regular',  days:80,  spacing:'12"', season:['spring','fall'],   companions:['bean','corn','marigold'],    avoid:['tomato','cucumber','squash'] },
  'potatoes':    { name:'Potatoes',    sun:'Full sun',    water:'Regular',  days:80,  spacing:'12"', season:['spring','fall'],   companions:['bean','corn'],               avoid:['tomato','cucumber'] },
  'onion':       { name:'Onion',       sun:'Full sun',    water:'Regular',  days:100, spacing:'4"',  season:['spring','fall'],   companions:['carrot','lettuce','tomato'], avoid:['bean','pea'] },
  'onions':      { name:'Onions',      sun:'Full sun',    water:'Regular',  days:100, spacing:'4"',  season:['spring','fall'],   companions:['carrot','lettuce'],          avoid:['bean','pea'] },
  'garlic':      { name:'Garlic',      sun:'Full sun',    water:'Light',    days:240, spacing:'6"',  season:['fall','winter'],   companions:['tomato','pepper','carrot'],  avoid:['bean','pea'] },
  'radish':      { name:'Radish',      sun:'Full/partial',water:'Regular',  days:25,  spacing:'2"',  season:['spring','fall'],   companions:['carrot','lettuce','pea'],    avoid:[] },
  'radishes':    { name:'Radishes',    sun:'Full/partial',water:'Regular',  days:25,  spacing:'2"',  season:['spring','fall'],   companions:['carrot','lettuce'],          avoid:[] },
  'broccoli':    { name:'Broccoli',    sun:'Full sun',    water:'Regular',  days:80,  spacing:'18"', season:['spring','fall'],   companions:['onion','potato','celery'],   avoid:['tomato','strawberry'] },
  'cauliflower': { name:'Cauliflower', sun:'Full sun',    water:'Regular',  days:80,  spacing:'18"', season:['spring','fall'],   companions:['onion','celery'],            avoid:['tomato','strawberry'] },
  'cabbage':     { name:'Cabbage',     sun:'Full sun',    water:'Regular',  days:70,  spacing:'18"', season:['spring','fall'],   companions:['onion','potato'],            avoid:['tomato','strawberry'] },
  'kale':        { name:'Kale',        sun:'Full/partial',water:'Regular',  days:60,  spacing:'12"', season:['spring','fall','winter'], companions:['beet','celery','onion'], avoid:['tomato'] },
  'beet':        { name:'Beet',        sun:'Full/partial',water:'Regular',  days:60,  spacing:'4"',  season:['spring','fall'],   companions:['onion','lettuce','kale'],    avoid:['bean'] },
  'beets':       { name:'Beets',       sun:'Full/partial',water:'Regular',  days:60,  spacing:'4"',  season:['spring','fall'],   companions:['onion','lettuce'],           avoid:['bean'] },
  'celery':      { name:'Celery',      sun:'Full/partial',water:'Heavy',    days:120, spacing:'8"',  season:['spring','fall'],   companions:['tomato','onion','cabbage'],  avoid:['carrot'] },
  'strawberry':  { name:'Strawberry',  sun:'Full sun',    water:'Regular',  days:90,  spacing:'12"', season:['spring','summer'], companions:['lettuce','spinach','onion'], avoid:['cabbage','broccoli'] },
  'strawberries':{ name:'Strawberries',sun:'Full sun',    water:'Regular',  days:90,  spacing:'12"', season:['spring','summer'], companions:['lettuce','spinach'],         avoid:['cabbage'] },
  'mint':        { name:'Mint',        sun:'Partial',     water:'Regular',  days:90,  spacing:'18"', season:['spring','summer','fall'], companions:['tomato','cabbage','pea'], avoid:[] },
  'parsley':     { name:'Parsley',     sun:'Full/partial',water:'Regular',  days:70,  spacing:'8"',  season:['spring','summer'], companions:['tomato','carrot','asparagus'], avoid:[] },
  'dill':        { name:'Dill',        sun:'Full sun',    water:'Light',    days:40,  spacing:'12"', season:['spring','summer'], companions:['cabbage','lettuce','onion'], avoid:['carrot','tomato'] },
  'cilantro':    { name:'Cilantro',    sun:'Full/partial',water:'Regular',  days:45,  spacing:'6"',  season:['spring','fall'],   companions:['spinach','tomato'],          avoid:['fennel'] },
  'thyme':       { name:'Thyme',       sun:'Full sun',    water:'Light',    days:90,  spacing:'12"', season:['spring','summer','fall'], companions:['cabbage','tomato'],  avoid:[] },
  'rosemary':    { name:'Rosemary',    sun:'Full sun',    water:'Light',    days:365, spacing:'24"', season:['spring','summer','fall'], companions:['bean','cabbage'],    avoid:[] },
  'lavender':    { name:'Lavender',    sun:'Full sun',    water:'Light',    days:365, spacing:'24"', season:['spring','summer'], companions:['thyme','oregano'],           avoid:[] },
  'sunflower':   { name:'Sunflower',   sun:'Full sun',    water:'Regular',  days:70,  spacing:'24"', season:['spring','summer'], companions:['cucumber','squash'],         avoid:['potato'] },
  'sunflowers':  { name:'Sunflowers',  sun:'Full sun',    water:'Regular',  days:70,  spacing:'24"', season:['spring','summer'], companions:['cucumber','squash'],         avoid:['potato'] },
  'marigold':    { name:'Marigold',    sun:'Full sun',    water:'Light',    days:50,  spacing:'8"',  season:['spring','summer'], companions:['tomato','pepper','basil'],   avoid:[] },
  'marigolds':   { name:'Marigolds',   sun:'Full sun',    water:'Light',    days:50,  spacing:'8"',  season:['spring','summer'], companions:['tomato','pepper'],           avoid:[] },
  'nasturtium':  { name:'Nasturtium',  sun:'Full sun',    water:'Light',    days:50,  spacing:'12"', season:['spring','summer'], companions:['cucumber','zucchini','tomato'], avoid:[] },
  'pumpkin':     { name:'Pumpkin',     sun:'Full sun',    water:'Heavy',    days:100, spacing:'36"', season:['summer'],          companions:['corn','bean'],               avoid:['potato'] },
  'pumpkins':    { name:'Pumpkins',    sun:'Full sun',    water:'Heavy',    days:100, spacing:'36"', season:['summer'],          companions:['corn','bean'],               avoid:['potato'] },
  'watermelon':  { name:'Watermelon',  sun:'Full sun',    water:'Regular',  days:80,  spacing:'36"', season:['summer'],          companions:['nasturtium','radish'],       avoid:['potato'] },
  'asparagus':   { name:'Asparagus',   sun:'Full sun',    water:'Regular',  days:730, spacing:'18"', season:['spring'],          companions:['tomato','parsley','basil'],  avoid:['onion','garlic'] },
  'eggplant':    { name:'Eggplant',    sun:'Full sun',    water:'Regular',  days:80,  spacing:'18"', season:['summer'],          companions:['basil','pepper','tomato'],   avoid:['fennel'] },
  'fennel':      { name:'Fennel',      sun:'Full sun',    water:'Regular',  days:65,  spacing:'12"', season:['spring','fall'],   companions:[],                           avoid:['tomato','pepper','bean','coriander'] },
};

// ── OpenFarm API search ───────────────────────────────────────────
const OPENFARM_BASE = 'https://openfarm.cc/api/v1/crops';

async function searchOpenFarm(query) {
  try {
    const res = await fetch(`${OPENFARM_BASE}/?filter=${encodeURIComponent(query)}&limit=5`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.data || json.data.length === 0) return null;
    // Return top result formatted
    const c = json.data[0].attributes;
    return {
      name:       c.name || query,
      sun:        c.sun_requirements || 'Unknown',
      water:      c.water_requirements || 'Unknown',
      days:       c.growing_degree_days || null,
      spacing:    c.spread ? `${c.spread}"` : 'Unknown',
      description: c.description || '',
      companions: (c.companions || []).map(x => x.toLowerCase()),
      avoid:      [],
      source:     'OpenFarm'
    };
  } catch {
    return null;
  }
}

// ── Main plant lookup ─────────────────────────────────────────────
// Returns plant data: first tries local DB, then OpenFarm
async function lookupPlant(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  // Local DB first (instant)
  if (PLANT_DB[key]) return { ...PLANT_DB[key], source: 'local' };
  // Try partial match
  const partial = Object.keys(PLANT_DB).find(k => k.includes(key) || key.includes(k));
  if (partial) return { ...PLANT_DB[partial], source: 'local' };
  // OpenFarm fallback
  return await searchOpenFarm(name);
}

// ── Plant suggestion dropdown in tile editor ──────────────────────
const titleInput     = document.getElementById('titleInput');
const suggestBox     = document.getElementById('plantSuggestBox');
const plantInfoCard  = document.getElementById('plantInfoCard');

let suggestDebounce = null;

titleInput.addEventListener('input', () => {
  clearTimeout(suggestDebounce);
  const val = titleInput.value.trim();
  if (val.length < 2) { suggestBox.style.display = 'none'; return; }

  suggestDebounce = setTimeout(async () => {
    // Local matches first
    const localMatches = Object.values(PLANT_DB)
      .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 4);

    // OpenFarm matches
    let ofResults = [];
    try {
      const res = await fetch(`${OPENFARM_BASE}/?filter=${encodeURIComponent(val)}&limit=4`);
      if (res.ok) {
        const json = await res.json();
        ofResults = (json.data || []).map(d => ({
          name: d.attributes.name,
          source: 'OpenFarm'
        }));
      }
    } catch {}

    // Merge, dedupe
    const seen = new Set(localMatches.map(p => p.name.toLowerCase()));
    const merged = [
      ...localMatches.map(p => ({ name: p.name, source: 'local' })),
      ...ofResults.filter(p => !seen.has(p.name.toLowerCase()))
    ].slice(0, 6);

    if (merged.length === 0) { suggestBox.style.display = 'none'; return; }

    suggestBox.innerHTML = '';
    merged.forEach(item => {
      const opt = document.createElement('div');
      opt.className = 'plant-suggest-item';
      opt.innerHTML = `${escHtml(item.name)} <span class="suggest-source">${item.source}</span>`;
      opt.onclick = async () => {
        titleInput.value = item.name;
        suggestBox.style.display = 'none';
        await showPlantInfo(item.name);
      };
      suggestBox.appendChild(opt);
    });
    suggestBox.style.display = 'block';
  }, 300);
});

// Hide suggest on outside click
document.addEventListener('click', e => {
  if (!suggestBox.contains(e.target) && e.target !== titleInput)
    suggestBox.style.display = 'none';
});

// Show plant info card in panel
async function showPlantInfo(plantName) {
  const data = await lookupPlant(plantName);
  if (!data) { plantInfoCard.style.display = 'none'; return; }

  // Build a useful description from available data
  const autoDesc = buildPlantDescription(data);

  plantInfoCard.style.display = 'block';
  plantInfoCard.innerHTML = `
    <div class="plant-info-header">
      <span class="plant-info-name">🌱 ${escHtml(data.name)}</span>
      ${data.source === 'OpenFarm' ? '<span class="plant-source-badge">OpenFarm</span>' : ''}
    </div>
    <div class="plant-info-grid">
      <div class="plant-info-item"><span>☀️</span>${escHtml(data.sun)}</div>
      <div class="plant-info-item"><span>💧</span>${escHtml(data.water)}</div>
      ${data.days ? `<div class="plant-info-item"><span>📅</span>${data.days} days to harvest</div>` : ''}
      ${data.spacing ? `<div class="plant-info-item"><span>📏</span>${escHtml(data.spacing)} spacing</div>` : ''}
    </div>
    ${data.companions && data.companions.length ? `
      <div class="plant-companions">
        <span class="companion-good">✓ Good with: ${data.companions.slice(0,4).map(escHtml).join(', ')}</span>
      </div>` : ''}
    ${data.avoid && data.avoid.length ? `
      <div class="plant-companions">
        <span class="companion-bad">✗ Avoid: ${data.avoid.slice(0,4).map(escHtml).join(', ')}</span>
      </div>` : ''}
    <button class="plant-autofill-btn" id="plantAutofillBtn">
      ✨ Autofill description
    </button>
  `;

  // Autofill button — always available, fills or replaces description
  // Trigger planted-date prompt for care reminders
  if (typeof showPlantedDatePrompt === 'function' && activeId && currentGardenId) {
    showPlantedDatePrompt(activeId, data.name, currentGardenId);
  }

  // Add library button if not already present
  if (typeof addLibraryButtonToPanel === 'function') addLibraryButtonToPanel();

  document.getElementById('plantAutofillBtn').onclick = () => {
    const descInput = document.getElementById('descInput');
    descInput.value = autoDesc;
    descInput.style.borderColor = 'var(--green-3)';
    descInput.style.borderStyle = 'solid';
    setTimeout(() => {
      descInput.style.borderColor = '';
      descInput.style.borderStyle = '';
    }, 1500);
    showToast('Description filled from plant database! 🌱');
  };

  // Auto-fill description if currently empty
  const descInput = document.getElementById('descInput');
  if (!descInput.value && autoDesc) {
    descInput.value = autoDesc;
  }
}

// Build a structured description from plant data
function buildPlantDescription(data) {
  const parts = [];
  if (data.description) parts.push(data.description.slice(0, 200));
  const details = [];
  if (data.sun)     details.push(`☀️ ${data.sun}`);
  if (data.water)   details.push(`💧 ${data.water} watering`);
  if (data.days)    details.push(`📅 ~${data.days} days to harvest`);
  if (data.spacing) details.push(`📏 Space ${data.spacing} apart`);
  if (details.length) parts.push(details.join(' · '));
  if (data.season && data.season.length)
    parts.push(`🗓 Best season: ${data.season.join(', ')}`);
  if (data.companions && data.companions.length)
    parts.push(`✓ Companion plants: ${data.companions.slice(0,4).join(', ')}`);
  if (data.avoid && data.avoid.length)
    parts.push(`✗ Keep away from: ${data.avoid.slice(0,4).join(', ')}`);
  return parts.join('\n');
}

// ── Companion planting check ──────────────────────────────────────
// Returns { status: 'good'|'bad'|'neutral', reason: string } for two adjacent tiles
async function checkCompanion(plantA, plantB) {
  if (!plantA || !plantB) return { status: 'neutral' };
  const a = await lookupPlant(plantA);
  if (!a) return { status: 'neutral' };
  const nameB = plantB.trim().toLowerCase();
  if (a.companions && a.companions.some(c => nameB.includes(c) || c.includes(nameB)))
    return { status: 'good', reason: `${a.name} loves growing near ${plantB}` };
  if (a.avoid && a.avoid.some(c => nameB.includes(c) || c.includes(nameB)))
    return { status: 'bad', reason: `${a.name} grows poorly near ${plantB}` };
  return { status: 'neutral' };
}

// Build companion status map for all tiles (called by tiles.js renderGrid)
// Returns map: tileId -> 'good'|'bad'|'neutral'
async function buildCompanionMap(tilesData, rows, cols) {
  const map = {};
  const checks = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id  = `r${r}c${c}`;
      const d   = tilesData[id] || {};
      if (!d.title) continue;

      const neighbors = [];
      if (r > 0)       neighbors.push(tilesData[`r${r-1}c${c}`]?.title);
      if (r < rows-1)  neighbors.push(tilesData[`r${r+1}c${c}`]?.title);
      if (c > 0)       neighbors.push(tilesData[`r${r}c${c-1}`]?.title);
      if (c < cols-1)  neighbors.push(tilesData[`r${r}c${c+1}`]?.title);

      const validNeighbors = neighbors.filter(Boolean);
      if (validNeighbors.length === 0) continue;

      checks.push(
        Promise.all(validNeighbors.map(n => checkCompanion(d.title, n)))
          .then(results => {
            if (results.some(r => r.status === 'bad'))  map[id] = 'bad';
            else if (results.some(r => r.status === 'good')) map[id] = 'good';
            else map[id] = 'neutral';
          })
      );
    }
  }

  await Promise.all(checks);
  return map;
}

// Get companion details for a specific tile (used in panel)
async function getTileCompanionDetails(tileId, tilesData, rows, cols) {
  const { r, c } = { r: +tileId.match(/r(\d+)/)[1], c: +tileId.match(/c(\d+)/)[1] };
  const d = tilesData[tileId] || {};
  if (!d.title) return [];

  const neighbors = [
    r > 0       ? { id:`r${r-1}c${c}`, dir:'above' }   : null,
    r < rows-1  ? { id:`r${r+1}c${c}`, dir:'below' }   : null,
    c > 0       ? { id:`r${r}c${c-1}`, dir:'to left' } : null,
    c < cols-1  ? { id:`r${r}c${c+1}`, dir:'to right'} : null,
  ].filter(Boolean);

  const results = [];
  for (const n of neighbors) {
    const nd = tilesData[n.id];
    if (!nd?.title) continue;
    const check = await checkCompanion(d.title, nd.title);
    if (check.status !== 'neutral') {
      results.push({ ...check, neighbor: nd.title, dir: n.dir });
    }
  }
  return results;
}
