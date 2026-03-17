// ================================================================
// PLANT-LIBRARY.JS — browsable plant library, difficulty ratings,
//                    plant care reminders, auto-task generation
// ================================================================

// ── Extended plant database with difficulty + care schedule ──────
const PLANT_LIBRARY = [
  // EASY
  { key:'radish',      name:'Radish',       emoji:'🌱', difficulty:'easy',   category:'vegetable',
    sun:'Full/partial', water:'Regular',  days:25,  spacing:'2"',
    season:['spring','fall'],
    companions:['carrot','lettuce','pea'], avoid:[],
    careSchedule:[
      { taskDaysAfterPlant:7,   title:'Thin radish seedlings',       desc:'Thin to 2" apart once seedlings are 1" tall. Crowded radishes fork and don\'t bulb properly.' },
      { taskDaysAfterPlant:20,  title:'Check radishes for readiness', desc:'Radishes are ready when shoulders poke above soil. Harvest promptly — they get pithy if left too long.' },
    ],
    guide:'Radishes are one of the fastest, most forgiving vegetables. Sow directly in the ground, keep moist, harvest in 3–4 weeks. Perfect for beginners and great for keeping kids interested.',
  },
  { key:'lettuce',     name:'Lettuce',      emoji:'🥬', difficulty:'easy',   category:'vegetable',
    sun:'Partial',      water:'Regular',  days:45,  spacing:'8"',
    season:['spring','fall'],
    companions:['carrot','radish','strawberry'], avoid:['celery'],
    careSchedule:[
      { taskDaysAfterPlant:14, title:'Thin lettuce seedlings',      desc:'Thin leaf lettuce to 6–8" apart. Use thinnings in salads.' },
      { taskDaysAfterPlant:30, title:'Harvest outer lettuce leaves', desc:'Pick outer leaves regularly to encourage new growth. Cut-and-come-again gives you weeks of salad.' },
      { taskDaysAfterPlant:60, title:'Watch for bolting',           desc:'Lettuce bolts (goes to seed) in heat. Once it bolts, flavor turns bitter — harvest before flower stalks form.' },
    ],
    guide:'Lettuce thrives in cool weather. Sow in early spring or fall. Shade it during hot summer afternoons. Water evenly — irregular watering causes tip burn.',
  },
  { key:'spinach',     name:'Spinach',      emoji:'🍃', difficulty:'easy',   category:'vegetable',
    sun:'Partial',      water:'Regular',  days:40,  spacing:'6"',
    season:['spring','fall'],
    companions:['strawberry','pea'], avoid:[],
    careSchedule:[
      { taskDaysAfterPlant:21, title:'Thin spinach', desc:'Thin to 4–6" apart. Spinach needs space to develop full leaves.' },
      { taskDaysAfterPlant:35, title:'Begin harvesting spinach', desc:'Harvest outer leaves once plants have 6+ leaves. Don\'t take more than 1/3 of the plant at once.' },
    ],
    guide:'Spinach is a cool-season crop that bolts quickly in heat. Sow in early spring or late summer for fall harvest. Very cold-hardy — can handle light frosts.',
  },
  { key:'bean',        name:'Bean',         emoji:'🫘', difficulty:'easy',   category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:55,  spacing:'4"',
    season:['spring','summer'],
    companions:['carrot','cucumber','squash'], avoid:['onion','garlic'],
    careSchedule:[
      { taskDaysAfterPlant:14, title:'Check bean germination',       desc:'Beans should have sprouted. Resow any bare patches.' },
      { taskDaysAfterPlant:45, title:'Begin checking for bean pods', desc:'Pods ready when 4–6" long and before seeds bulge through the pod. Pick regularly to keep plants producing.' },
      { taskDaysAfterPlant:55, title:'Harvest beans promptly',       desc:'Over-mature beans signal the plant to stop producing. Pick every 2–3 days at peak season.' },
    ],
    guide:'Beans are a nitrogen fixer — they improve your soil while they grow. Direct sow after last frost, don\'t transplant. Bush beans need no support; pole beans need a trellis.',
  },
  { key:'sunflower',   name:'Sunflower',    emoji:'🌻', difficulty:'easy',   category:'flower',
    sun:'Full sun',     water:'Regular',  days:70,  spacing:'24"',
    season:['spring','summer'],
    companions:['cucumber','squash'], avoid:['potato'],
    careSchedule:[
      { taskDaysAfterPlant:21, title:'Thin sunflowers', desc:'Thin to one plant per 12–24" for largest blooms, or leave 6" apart for cut flowers.' },
      { taskDaysAfterPlant:60, title:'Support tall sunflowers', desc:'Stake varieties over 4 feet tall before they get top-heavy with flower heads.' },
    ],
    guide:'Near-impossible to kill. Direct sow after last frost in the sunniest spot you have. They track the sun when young. Great companion plant — they attract pollinators and provide shade for heat-sensitive neighbors.',
  },
  { key:'marigold',    name:'Marigold',     emoji:'🌼', difficulty:'easy',   category:'flower',
    sun:'Full sun',     water:'Light',    days:50,  spacing:'8"',
    season:['spring','summer'],
    companions:['tomato','pepper','basil'], avoid:[],
    careSchedule:[
      { taskDaysAfterPlant:30, title:'Deadhead marigolds', desc:'Remove spent flowers to encourage more blooms. Without deadheading, plants slow down significantly.' },
    ],
    guide:'The ultimate companion plant. Marigolds repel aphids, whiteflies, and even nematodes in the soil. Plant them everywhere. French marigolds (Tagetes patula) are most effective for pest control.',
  },
  { key:'nasturtium',  name:'Nasturtium',   emoji:'🌸', difficulty:'easy',   category:'flower',
    sun:'Full sun',     water:'Light',    days:50,  spacing:'12"',
    season:['spring','summer'],
    companions:['cucumber','zucchini','tomato'], avoid:[],
    careSchedule:[
      { taskDaysAfterPlant:40, title:'Harvest nasturtium flowers', desc:'Both flowers and leaves are edible — peppery flavor. Harvest regularly to keep plants blooming.' },
    ],
    guide:'Nasturtiums thrive on neglect. Poor soil, minimal water — they actually do worse with fertilizer (all leaves, no flowers). Brilliant trap crop for aphids.',
  },

  // MEDIUM
  { key:'tomato',      name:'Tomato',       emoji:'🍅', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:70,  spacing:'24"',
    season:['spring','summer'],
    companions:['basil','carrot','marigold','parsley'], avoid:['fennel','cabbage','corn'],
    careSchedule:[
      { taskDaysAfterPlant:14,  title:'Stake or cage tomatoes',        desc:'Install stakes or cages before plants get too large. Indeterminate varieties need support all season.' },
      { taskDaysAfterPlant:21,  title:'Pinch tomato suckers',          desc:'For indeterminate types, pinch suckers (shoots in leaf axils) to direct energy into fruit. Leave 1–2 for extra stems if desired.' },
      { taskDaysAfterPlant:35,  title:'Fertilize tomatoes',            desc:'Side-dress with compost or a balanced fertilizer. Once flowering starts, switch to a lower-nitrogen, higher-phosphorus feed.' },
      { taskDaysAfterPlant:60,  title:'Watch for blossom drop',        desc:'Blossoms drop if temps are above 85°F or below 55°F at night. Inconsistent watering also causes this.' },
      { taskDaysAfterPlant:70,  title:'Check tomatoes for ripeness',   desc:'Harvest when fully colored and slightly soft to the touch. Slightly underripe tomatoes finish indoors at room temperature.' },
    ],
    guide:'Tomatoes reward attention. Consistent watering prevents blossom end rot. Mulch heavily to retain moisture. In hot climates, afternoon shade helps. The most common mistake is planting too early — wait until nights are reliably above 50°F.',
  },
  { key:'pepper',      name:'Pepper',       emoji:'🌶', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:80,  spacing:'18"',
    season:['spring','summer'],
    companions:['basil','carrot','tomato'], avoid:['fennel'],
    careSchedule:[
      { taskDaysAfterPlant:21,  title:'Fertilize peppers',    desc:'Peppers are heavy feeders. Apply balanced fertilizer every 3–4 weeks through the season.' },
      { taskDaysAfterPlant:50,  title:'First pepper harvest check', desc:'Green peppers are fully mature but unripe. Leave on plant for red/yellow/orange — flavor deepens significantly.' },
    ],
    guide:'Peppers need warmth — both soil and air. Cold soil stunts them for weeks. Mulch helps keep roots warm. They actually do well slightly pot-bound, so don\'t rush to transplant to large containers.',
  },
  { key:'cucumber',    name:'Cucumber',     emoji:'🥒', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Heavy',    days:55,  spacing:'12"',
    season:['summer'],
    companions:['bean','pea','sunflower'], avoid:['potato','sage'],
    careSchedule:[
      { taskDaysAfterPlant:21,  title:'Train cucumber vines',        desc:'Guide vines onto a trellis or fence. Vertical growing improves air circulation and makes harvest easier.' },
      { taskDaysAfterPlant:45,  title:'Begin daily cucumber checks', desc:'Cucumbers grow fast. Check daily once fruiting begins — one missed day can mean an overgrown, bitter fruit.' },
      { taskDaysAfterPlant:50,  title:'Harvest cucumbers regularly', desc:'Pick when firm and dark green, typically 6–8" for slicers. Leaving overripe fruit on the vine signals the plant to stop producing.' },
    ],
    guide:'Cucumbers are thirsty — inconsistent watering causes bitter fruit. Mulch heavily. They love climbing: a simple piece of wire fencing works great. Plant after soil reaches 65°F.',
  },
  { key:'zucchini',    name:'Zucchini',     emoji:'🥬', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:50,  spacing:'24"',
    season:['summer'],
    companions:['bean','nasturtium'], avoid:['potato'],
    careSchedule:[
      { taskDaysAfterPlant:35,  title:'Check zucchini for first fruits', desc:'Harvest young at 6–8". They grow shockingly fast — a missed day can turn a zucchini into a marrow.' },
      { taskDaysAfterPlant:45,  title:'Hand-pollinate zucchini if needed', desc:'If flowers form but no fruit sets, hand-pollinate: transfer pollen from male to female flowers with a small brush or your finger.' },
    ],
    guide:'Zucchini is absurdly productive once established. The joke about leaving them on neighbors\' doorsteps is real. Plant one or two plants maximum for most families. Powdery mildew is common in late season — increase airflow and avoid overhead watering.',
  },
  { key:'carrot',      name:'Carrot',       emoji:'🥕', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:75,  spacing:'3"',
    season:['spring','fall'],
    companions:['tomato','lettuce','onion'], avoid:['dill'],
    careSchedule:[
      { taskDaysAfterPlant:14, title:'Check carrot germination',    desc:'Carrots are notoriously slow and patchy germinators. Keep the soil surface moist — it should never dry out during germination.' },
      { taskDaysAfterPlant:21, title:'Thin carrots',                desc:'Thin ruthlessly to 2–3" apart. Crowded carrots won\'t develop properly. Use scissors to snip at soil level.' },
      { taskDaysAfterPlant:60, title:'Check carrots for size',      desc:'Gently brush soil from the shoulder of one carrot. Harvest when 1/2" diameter or larger.' },
    ],
    guide:'Carrots need deep, loose, rock-free soil — rocky soil causes forking. Never add fresh manure or high-nitrogen fertilizer (causes hairy roots and forking). Keep the seed bed consistently moist for the first 2 weeks.',
  },
  { key:'onion',       name:'Onion',        emoji:'🧅', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:100, spacing:'4"',
    season:['spring','fall'],
    companions:['carrot','lettuce','tomato'], avoid:['bean','pea'],
    careSchedule:[
      { taskDaysAfterPlant:30, title:'Fertilize onions',           desc:'Side-dress with nitrogen fertilizer. Onions are heavy nitrogen feeders in early growth.' },
      { taskDaysAfterPlant:80, title:'Stop watering onions',       desc:'When tops start to yellow and fall over, stop watering. Let soil dry out to help onions cure.' },
      { taskDaysAfterPlant:100, title:'Harvest and cure onions',   desc:'Harvest when most tops have fallen. Cure in a warm, airy spot for 2–3 weeks before storage.' },
    ],
    guide:'Onion bulbing is triggered by day length — choose long-day, short-day, or intermediate varieties based on your latitude. Sets (small bulbs) are easiest for beginners; seeds give more variety.',
  },
  { key:'basil',       name:'Basil',        emoji:'🌿', difficulty:'medium', category:'herb',
    sun:'Full sun',     water:'Regular',  days:30,  spacing:'6"',
    season:['spring','summer'],
    companions:['tomato','pepper'], avoid:['sage'],
    careSchedule:[
      { taskDaysAfterPlant:21, title:'Pinch basil to promote bushiness', desc:'Pinch off the central growing tip above a leaf pair. This makes the plant branch out into a bushy shape instead of bolting.' },
      { taskDaysAfterPlant:35, title:'Remove basil flower buds',         desc:'Pinch off any flower buds as soon as they appear. Once basil flowers, leaf flavor diminishes rapidly.' },
    ],
    guide:'Basil loves heat and hates cold. Never put it out before nights are consistently above 50°F — even a chilly night causes black spots. Water at the base, never overhead. Plant near tomatoes: they genuinely help each other.',
  },
  { key:'potato',      name:'Potato',       emoji:'🥔', difficulty:'medium', category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:80,  spacing:'12"',
    season:['spring','fall'],
    companions:['bean','corn','marigold'], avoid:['tomato','cucumber','squash'],
    careSchedule:[
      { taskDaysAfterPlant:14, title:'Hill potato plants',          desc:'When stems are 6–8" tall, mound soil up around the base, leaving only the top 2–3" visible. Repeat every 2–3 weeks.' },
      { taskDaysAfterPlant:60, title:'Watch for potato blight',     desc:'Yellow leaves with brown patches may indicate blight. Improve airflow and avoid overhead watering.' },
      { taskDaysAfterPlant:80, title:'Test for potato readiness',   desc:'Carefully dig around one plant. New potatoes are ready 2–3 weeks after flowering; main crop when tops die back.' },
    ],
    guide:'Never plant potatoes where tomatoes, peppers, or eggplant grew last year — same disease family (blight). Chit (pre-sprout) seed potatoes in light for 2 weeks before planting for better yield.',
  },

  // HARD
  { key:'corn',        name:'Corn',         emoji:'🌽', difficulty:'hard',   category:'vegetable',
    sun:'Full sun',     water:'Heavy',    days:90,  spacing:'12"',
    season:['summer'],
    companions:['bean','squash','pumpkin'], avoid:['tomato'],
    careSchedule:[
      { taskDaysAfterPlant:21, title:'Fertilize corn',              desc:'Side-dress with nitrogen once plants are knee-high. Corn is a very heavy nitrogen feeder.' },
      { taskDaysAfterPlant:60, title:'Check corn tassels',          desc:'When tassels appear at the top, shake the stalks gently in the morning to help pollinate the silks below.' },
      { taskDaysAfterPlant:80, title:'Check corn for readiness',    desc:'Pull back the husk on one ear. Kernels should be plump and milky when pierced. Silks should be brown and dry.' },
    ],
    guide:'Corn needs to be planted in blocks (4+ rows wide) rather than single rows for good pollination. It\'s wind-pollinated. Needs rich soil, regular deep watering, and lots of space. The Three Sisters (corn + beans + squash) is a companion planting system worth trying.',
  },
  { key:'asparagus',   name:'Asparagus',    emoji:'🌿', difficulty:'hard',   category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:730, spacing:'18"',
    season:['spring'],
    companions:['tomato','parsley','basil'], avoid:['onion','garlic'],
    careSchedule:[
      { taskDaysAfterPlant:30,  title:'Fertilize asparagus',        desc:'Apply balanced fertilizer. Resist harvesting any spears in year 1 — let all growth go to fern to build root energy.' },
      { taskDaysAfterPlant:365, title:'Second-year asparagus care', desc:'Harvest lightly in year 2 (only 2–3 weeks). Cut back ferns in fall once they turn yellow.' },
    ],
    guide:'Asparagus is a 20-year investment. Choose your bed location carefully — it\'s permanent. Don\'t harvest at all in year 1, harvest lightly in year 2, full harvest from year 3. The patience pays off with decades of spring harvests.',
  },
  { key:'broccoli',    name:'Broccoli',     emoji:'🥦', difficulty:'hard',   category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:80,  spacing:'18"',
    season:['spring','fall'],
    companions:['onion','potato','celery'], avoid:['tomato','strawberry'],
    careSchedule:[
      { taskDaysAfterPlant:21, title:'Fertilize broccoli',          desc:'Side-dress with nitrogen fertilizer. Broccoli is a heavy feeder.' },
      { taskDaysAfterPlant:60, title:'Check broccoli head formation', desc:'Harvest main head before flowers open (buds remain tight and dark green). Once yellow flowers appear, quality drops fast.' },
      { taskDaysAfterPlant:80, title:'Harvest broccoli side shoots', desc:'After cutting the main head, side shoots will form. Harvest these regularly — smaller but still delicious.' },
    ],
    guide:'Broccoli is temperature-sensitive — it buttons (forms tiny premature heads) if transplanted into cold soil or stressed. Time planting so harvest happens in cool weather. Cabbage worms are the main pest; cover with row fabric.',
  },
  { key:'garlic',      name:'Garlic',       emoji:'🧄', difficulty:'hard',   category:'vegetable',
    sun:'Full sun',     water:'Light',    days:240, spacing:'6"',
    season:['fall','winter'],
    companions:['tomato','pepper','carrot'], avoid:['bean','pea'],
    careSchedule:[
      { taskDaysAfterPlant:120, title:'Remove garlic scapes',        desc:'For hardneck varieties, remove the curling scape (flower stalk) once it makes one full curl. This redirects energy into the bulb and scapes are delicious sautéed.' },
      { taskDaysAfterPlant:180, title:'Stop watering garlic',        desc:'Stop watering 2–3 weeks before expected harvest. This is critical — wet soil during curing causes rot.' },
      { taskDaysAfterPlant:240, title:'Harvest and cure garlic',     desc:'Harvest when lower 1/3 of leaves are brown. Cure in a shaded, airy spot for 3–4 weeks. Do not wash before curing.' },
    ],
    guide:'Plant in fall, harvest the following summer. Choose hardneck for cold climates (better flavor, doesn\'t store as long) or softneck for mild climates (stores up to a year). Use the biggest cloves for planting — they produce the biggest bulbs.',
  },
  { key:'pumpkin',     name:'Pumpkin',      emoji:'🎃', difficulty:'hard',   category:'vegetable',
    sun:'Full sun',     water:'Heavy',    days:100, spacing:'36"',
    season:['summer'],
    companions:['corn','bean'], avoid:['potato'],
    careSchedule:[
      { taskDaysAfterPlant:21,  title:'Train pumpkin vines',         desc:'Guide vines in the direction you want them to grow. They can sprawl 10–15 feet.' },
      { taskDaysAfterPlant:50,  title:'Hand-pollinate pumpkins',     desc:'If fruit set is poor, hand-pollinate in the morning: transfer pollen from male (thin stem) to female (small pumpkin at base) flowers.' },
      { taskDaysAfterPlant:90,  title:'Check pumpkin ripeness',      desc:'Rind should be hard and resist a fingernail. Stem should be dry and corky. Color should be deep and even.' },
    ],
    guide:'Pumpkins need space — plan for vines to take over. Give them a large planting hole enriched with compost. Keep fruit off the soil (set on a piece of wood or tile) to prevent rot. Start indoors 2–3 weeks before last frost.',
  },
  { key:'watermelon',  name:'Watermelon',   emoji:'🍉', difficulty:'hard',   category:'vegetable',
    sun:'Full sun',     water:'Regular',  days:80,  spacing:'36"',
    season:['summer'],
    companions:['nasturtium','radish'], avoid:['potato'],
    careSchedule:[
      { taskDaysAfterPlant:40,  title:'Fertilize watermelon',        desc:'Apply a potassium-rich fertilizer once plants start flowering. Avoid high nitrogen at this stage — it delays fruit set.' },
      { taskDaysAfterPlant:70,  title:'Check watermelon ripeness',   desc:'Thump test: ripe watermelon sounds hollow. The tendril nearest the fruit should be dry and brown. The underside spot should be creamy yellow.' },
    ],
    guide:'Watermelons need a long hot season — challenging in cooler climates. Use black plastic mulch to warm soil. Start indoors 3 weeks before transplanting. In short seasons, choose smaller "icebox" varieties.',
  },
  { key:'celery',      name:'Celery',       emoji:'🌿', difficulty:'hard',   category:'vegetable',
    sun:'Full/partial', water:'Heavy',    days:120, spacing:'8"',
    season:['spring','fall'],
    companions:['tomato','onion','cabbage'], avoid:['carrot'],
    careSchedule:[
      { taskDaysAfterPlant:30,  title:'Blanch celery stalks',        desc:'Tie outer stalks together and wrap with cardboard or a brown bag for 2 weeks before harvest. Blanching reduces bitterness.' },
      { taskDaysAfterPlant:90,  title:'Begin celery harvest',        desc:'Harvest outer stalks as needed, leaving the center to continue growing. Or harvest whole plant at once.' },
    ],
    guide:'Celery is water-demanding — never let it dry out. A single day without water can make it tough and stringy. Rich soil with regular fertilization is essential. One of the more challenging vegetables but very rewarding.',
  },
];

// ── Feature-gated access ─────────────────────────────────────────
function getPlantLibraryData() {
  // In simple mode only return easy plants
  if (appMode === 'simple') return PLANT_LIBRARY.filter(p => p.difficulty === 'easy');
  return PLANT_LIBRARY;
}

// ── Plant Library Modal ──────────────────────────────────────────
let plantLibraryModal = null;
let plantLibraryFilter = { search: '', difficulty: 'all', category: 'all', season: 'all' };

function openPlantLibrary(onSelect) {
  // Build modal if not exists
  if (!plantLibraryModal) buildPlantLibraryModal();
  plantLibraryModal.style.display = 'flex';
  plantLibraryModal._onSelect = onSelect;
  renderPlantLibrary();
}

function buildPlantLibraryModal() {
  const overlay = document.createElement('div');
  overlay.id = 'plant-library-overlay';
  overlay.innerHTML = `
    <div id="plant-library-modal">
      <div class="pl-header">
        <div class="pl-title-row">
          <h2>🌱 Plant Library</h2>
          <button class="modal-close-btn" id="plCloseBtn">✕</button>
        </div>
        <div class="pl-search-row">
          <input id="plSearch" type="text" placeholder="Search plants…" autocomplete="off"/>
        </div>
        <div class="pl-filters">
          <div class="pl-filter-group">
            <span class="pl-filter-label">Difficulty</span>
            <div class="pl-filter-btns" id="plDiffFilter">
              <button class="filter-btn active" data-val="all">All</button>
              <button class="filter-btn" data-val="easy">🌱 Easy</button>
              <button class="filter-btn" data-val="medium">🌿 Medium</button>
              <button class="filter-btn" data-val="hard">🌳 Hard</button>
            </div>
          </div>
          <div class="pl-filter-group">
            <span class="pl-filter-label">Category</span>
            <div class="pl-filter-btns" id="plCatFilter">
              <button class="filter-btn active" data-val="all">All</button>
              <button class="filter-btn" data-val="vegetable">🥕 Veg</button>
              <button class="filter-btn" data-val="herb">🌿 Herb</button>
              <button class="filter-btn" data-val="flower">🌸 Flower</button>
            </div>
          </div>
          <div class="pl-filter-group">
            <span class="pl-filter-label">Season</span>
            <div class="pl-filter-btns" id="plSeasonFilter">
              <button class="filter-btn active" data-val="all">All</button>
              <button class="filter-btn" data-val="spring">🌸 Spring</button>
              <button class="filter-btn" data-val="summer">☀️ Summer</button>
              <button class="filter-btn" data-val="fall">🍂 Fall</button>
              <button class="filter-btn" data-val="winter">❄️ Winter</button>
            </div>
          </div>
        </div>
      </div>
      <div id="pl-grid" class="pl-grid"></div>
      <div id="pl-detail" class="pl-detail" style="display:none"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  plantLibraryModal = overlay;

  // Close
  overlay.querySelector('#plCloseBtn').onclick = () => { overlay.style.display = 'none'; };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

  // Search
  overlay.querySelector('#plSearch').oninput = e => {
    plantLibraryFilter.search = e.target.value.toLowerCase();
    renderPlantLibrary();
  };

  // Difficulty filter
  overlay.querySelectorAll('#plDiffFilter .filter-btn').forEach(btn => {
    btn.onclick = () => {
      overlay.querySelectorAll('#plDiffFilter .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      plantLibraryFilter.difficulty = btn.dataset.val;
      renderPlantLibrary();
    };
  });

  // Category filter
  overlay.querySelectorAll('#plCatFilter .filter-btn').forEach(btn => {
    btn.onclick = () => {
      overlay.querySelectorAll('#plCatFilter .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      plantLibraryFilter.category = btn.dataset.val;
      renderPlantLibrary();
    };
  });

  // Season filter
  overlay.querySelectorAll('#plSeasonFilter .filter-btn').forEach(btn => {
    btn.onclick = () => {
      overlay.querySelectorAll('#plSeasonFilter .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      plantLibraryFilter.season = btn.dataset.val;
      renderPlantLibrary();
    };
  });
}

function renderPlantLibrary() {
  const grid   = document.getElementById('pl-grid');
  const detail = document.getElementById('pl-detail');
  if (!grid) return;

  detail.style.display = 'none';
  grid.style.display   = 'grid';
  grid.innerHTML = '';

  let plants = getPlantLibraryData();
  const { search, difficulty, category, season } = plantLibraryFilter;

  if (search)     plants = plants.filter(p => p.name.toLowerCase().includes(search) || p.guide.toLowerCase().includes(search));
  if (difficulty !== 'all') plants = plants.filter(p => p.difficulty === difficulty);
  if (category   !== 'all') plants = plants.filter(p => p.category   === category);
  if (season     !== 'all') plants = plants.filter(p => p.season.includes(season));

  if (plants.length === 0) {
    grid.innerHTML = '<div class="pl-empty"><div class="empty-icon">🌱</div><p>No plants match your filters.</p></div>';
    return;
  }

  plants.forEach(plant => {
    const card = document.createElement('div');
    card.className = 'pl-card';
    const diffColor = { easy: '#d4f5d4', medium: '#fff3a8', hard: '#ffd5a8' }[plant.difficulty];
    const diffLabel = { easy: '🌱 Easy', medium: '🌿 Medium', hard: '🌳 Hard' }[plant.difficulty];
    card.innerHTML = `
      <div class="pl-card-emoji">${plant.emoji}</div>
      <div class="pl-card-name">${plant.name}</div>
      <div class="pl-card-badge" style="background:${diffColor}">${diffLabel}</div>
      <div class="pl-card-meta">
        <span title="Days to harvest">📅 ${plant.days}d</span>
        <span title="Sun">☀️ ${plant.sun.split('/')[0]}</span>
      </div>
    `;
    card.onclick = () => showPlantDetail(plant);
    grid.appendChild(card);
  });
}

function showPlantDetail(plant) {
  const grid   = document.getElementById('pl-grid');
  const detail = document.getElementById('pl-detail');
  if (!grid || !detail) return;

  grid.style.display   = 'none';
  detail.style.display = 'block';

  const diffColor = { easy: '#d4f5d4', medium: '#fff3a8', hard: '#ffd5a8' }[plant.difficulty];
  const diffLabel = { easy: '🌱 Easy', medium: '🌿 Medium', hard: '🌳 Hard' }[plant.difficulty];
  const seasonEmojis = { spring:'🌸', summer:'☀️', fall:'🍂', winter:'❄️' };
  const seasons = plant.season.map(s => `${seasonEmojis[s] || ''} ${s}`).join(', ');

  // Check if we're in frost date context
  const frostNote = frostDates
    ? `<div class="pl-detail-frost">🌡️ Your area: last spring frost ~${frostDates.lastSpring}, first fall frost ~${frostDates.firstFall}</div>`
    : '';

  detail.innerHTML = `
    <button class="pl-back-btn" id="plBackBtn">← Back to library</button>
    <div class="pl-detail-header">
      <span class="pl-detail-emoji">${plant.emoji}</span>
      <div>
        <h3 class="pl-detail-name">${plant.name}</h3>
        <span class="pl-detail-badge" style="background:${diffColor}">${diffLabel}</span>
      </div>
    </div>
    ${frostNote}
    <div class="pl-detail-grid">
      <div class="pl-detail-stat"><span>☀️</span><strong>${plant.sun}</strong><small>Sun</small></div>
      <div class="pl-detail-stat"><span>💧</span><strong>${plant.water}</strong><small>Water</small></div>
      <div class="pl-detail-stat"><span>📅</span><strong>${plant.days}d</strong><small>To harvest</small></div>
      <div class="pl-detail-stat"><span>📏</span><strong>${plant.spacing}</strong><small>Spacing</small></div>
    </div>
    <div class="pl-detail-season">🗓 Best seasons: ${seasons}</div>
    <div class="pl-detail-guide">
      <h4>Growing guide</h4>
      <p>${plant.guide}</p>
    </div>
    ${plant.companions.length ? `<div class="pl-detail-companions">
      <span class="companion-good">✓ Companions: ${plant.companions.join(', ')}</span>
    </div>` : ''}
    ${plant.avoid.length ? `<div class="pl-detail-companions">
      <span class="companion-bad">✗ Avoid near: ${plant.avoid.join(', ')}</span>
    </div>` : ''}
    ${plant.careSchedule.length ? `
      <div class="pl-detail-care">
        <h4>Care schedule</h4>
        ${plant.careSchedule.map(c => `
          <div class="pl-care-step">
            <div class="pl-care-day">Day ~${c.taskDaysAfterPlant}</div>
            <div class="pl-care-title">${c.title}</div>
            <div class="pl-care-desc">${c.desc}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="pl-detail-actions">
      ${plantLibraryModal?._onSelect ? `
        <button class="btn-create pl-select-btn" id="plSelectBtn">
          Use ${plant.name} in my garden →
        </button>
      ` : ''}
    </div>
  `;

  detail.querySelector('#plBackBtn').onclick = () => {
    detail.style.display = 'none';
    grid.style.display   = 'grid';
  };

  const selectBtn = detail.querySelector('#plSelectBtn');
  if (selectBtn && plantLibraryModal._onSelect) {
    selectBtn.onclick = () => {
      plantLibraryModal._onSelect(plant);
      plantLibraryModal.style.display = 'none';
    };
  }
}

// ── Care reminders — auto-generate tasks ─────────────────────────
// Called when a tile is saved with a plant title + planted date
async function generateCareReminders(gardenId, tileId, plantName, plantedDate) {
  if (!isFeatureEnabled('careReminders')) return;
  if (!plantedDate) return;

  const plant = PLANT_LIBRARY.find(p =>
    p.key === plantName.toLowerCase() ||
    p.name.toLowerCase() === plantName.toLowerCase()
  );
  if (!plant || !plant.careSchedule) return;

  const planted = new Date(plantedDate);
  if (isNaN(planted.getTime())) return;

  // Check if care reminders already exist for this tile
  const existing = await db.collection('gardens').doc(gardenId)
    .collection('tasks')
    .where('linkedTiles', 'array-contains', tileId)
    .where('isCareReminder', '==', true)
    .get();

  // Don't regenerate if already exist
  if (!existing.empty) return;

  const batch = db.batch();
  const tasksRef = db.collection('gardens').doc(gardenId).collection('tasks');

  plant.careSchedule.forEach(step => {
    const dueDate = new Date(planted);
    dueDate.setDate(dueDate.getDate() + step.taskDaysAfterPlant);

    const ref = tasksRef.doc();
    batch.set(ref, {
      title:         step.title,
      description:   step.desc,
      priority:      'low',
      status:        'todo',
      dueDate:       dueDate.toISOString().split('T')[0],
      linkedTiles:   [tileId],
      isCareReminder: true,
      plantName,
      createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  showToast(`✓ ${plant.careSchedule.length} care reminders added for ${plant.name}`);
}

// ── Planted date prompt (shown in tile editor when a plant is recognized) ──
function showPlantedDatePrompt(tileId, plantName, gardenId) {
  if (!isFeatureEnabled('careReminders')) return;

  // Only show if plant is in library
  const plant = PLANT_LIBRARY.find(p =>
    p.key === plantName.toLowerCase() ||
    p.name.toLowerCase() === plantName.toLowerCase()
  );
  if (!plant) return;

  // Check if prompt already shown for this tile
  const existing = document.getElementById('plantedDatePrompt');
  if (existing) existing.remove();

  const today = new Date().toISOString().split('T')[0];
  const el    = document.createElement('div');
  el.id        = 'plantedDatePrompt';
  el.className = 'planted-date-prompt';
  el.innerHTML = `
    <div class="pdp-content">
      <span class="pdp-emoji">${plant.emoji}</span>
      <div class="pdp-text">
        <strong>When did you plant ${plant.name}?</strong>
        <small>We'll create care reminders automatically</small>
      </div>
      <input type="date" id="plantedDateInput" value="${today}" class="pdp-input"/>
      <button class="pdp-confirm-btn" id="pdpConfirmBtn">Add reminders</button>
      <button class="pdp-skip-btn" id="pdpSkipBtn">Skip</button>
    </div>
  `;
  // Insert below plantInfoCard
  const infoCard = document.getElementById('plantInfoCard');
  if (infoCard && infoCard.parentNode) {
    infoCard.parentNode.insertBefore(el, infoCard.nextSibling);
  }

  document.getElementById('pdpConfirmBtn').onclick = async () => {
    const date = document.getElementById('plantedDateInput').value;
    if (date) await generateCareReminders(gardenId, tileId, plantName, date);
    el.remove();
  };
  document.getElementById('pdpSkipBtn').onclick = () => el.remove();
}

// ── "What to plant now" section (shown on home page) ─────────────
function renderWhatToPlantNow() {
  if (!isFeatureEnabled('plantLibrary')) return;

  const existing = document.getElementById('whatToPlantSection');
  if (existing) existing.remove();

  const currentSeason = getCurrentSeason();
  const plants = getPlantLibraryData()
    .filter(p => p.season.includes(currentSeason))
    .slice(0, 6);

  if (!plants.length) return;

  const section = document.createElement('div');
  section.id        = 'whatToPlantSection';
  section.innerHTML = `
    <div class="section-divider"><span>🗓 What to plant this ${currentSeason}</span></div>
    <div class="wtp-grid">
      ${plants.map(p => {
        const diffColor = { easy: '#d4f5d4', medium: '#fff3a8', hard: '#ffd5a8' }[p.difficulty];
        return `
          <div class="wtp-card" data-key="${p.key}">
            <span class="wtp-emoji">${p.emoji}</span>
            <span class="wtp-name">${p.name}</span>
            <span class="wtp-badge" style="background:${diffColor}">${p.difficulty}</span>
          </div>
        `;
      }).join('')}
    </div>
    <button class="pl-view-all-btn" id="viewAllPlantsBtn">Browse full plant library →</button>
  `;

  section.querySelectorAll('.wtp-card').forEach(card => {
    card.onclick = () => {
      const plant = PLANT_LIBRARY.find(p => p.key === card.dataset.key);
      if (plant) { openPlantLibrary(null); setTimeout(() => showPlantDetail(plant), 100); }
    };
  });

  section.querySelector('#viewAllPlantsBtn').onclick = () => openPlantLibrary(null);

  // Append to home page
  const homeEl = document.getElementById('page-home');
  if (homeEl) homeEl.appendChild(section);
}

function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'fall';
  return 'winter';
}

// ── Wire plant library button in tile panel ───────────────────────
// Called from tiles.js to add a "Browse library" button to the panel
function addLibraryButtonToPanel() {
  if (!isFeatureEnabled('plantLibrary')) return;
  const existing = document.getElementById('browseLibraryBtn');
  if (existing) return;

  const btn = document.createElement('button');
  btn.id        = 'browseLibraryBtn';
  btn.className = 'browse-library-btn';
  btn.textContent = '📚 Browse plant library';
  btn.onclick = () => {
    openPlantLibrary(plant => {
      // Fill the title input when a plant is selected from library
      const titleInput = document.getElementById('titleInput');
      if (titleInput) {
        titleInput.value = plant.name;
        titleInput.dispatchEvent(new Event('input'));
      }
    });
  };

  const plantWrap = document.getElementById('plantSuggestBox');
  if (plantWrap?.parentNode) {
    plantWrap.parentNode.insertAdjacentElement('afterend', btn);
  }
}
