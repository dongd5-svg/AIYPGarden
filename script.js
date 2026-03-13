// ---------------- AUTH ----------------
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const loginGate = document.getElementById('loginGate');
const signOutBtn = document.getElementById('signOutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');

document.getElementById('googleBtn').onclick = () => {
  auth.signInWithPopup(provider).catch(err => alert(err.message));
};

signOutBtn.onclick = () => {
  auth.signOut();
};

auth.onAuthStateChanged(user => {
  if (user) {
    loginGate.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    userNameDisplay.textContent = user.displayName || user.email;

    if (user.photoURL) {
      document.getElementById('profileImg').src = user.photoURL;
    }
  } else {
    loginGate.style.display = 'flex';
    signOutBtn.style.display = 'none';
    userNameDisplay.textContent = '';
    document.getElementById('profileImg').src = '';
  }
});

// ---------------- FIREBASE ----------------
const db = firebase.firestore();
const gardenRef = db.collection("gardenTiles");

// ---------------- ELEMENTS ----------------
const garden = document.getElementById('garden-container');
const editInfo = document.getElementById('editInfo');
const defaultInfo = document.getElementById('defaultInfo');

const titleInput = document.getElementById('titleInput');
const descInput = document.getElementById('descInput');
const imgInput = document.getElementById('imgInput');
const colorInput = document.getElementById('colorInput');

const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const exitBtn = document.getElementById('exitBtn');

let tilesData = {};
let activeId = null;

function tileId(r,c){ return `r${r}c${c}`; }

// ---------------- REALTIME SYNC ----------------
gardenRef.onSnapshot(snapshot => {
  tilesData = {};

  snapshot.forEach(doc => {
    tilesData[doc.id] = doc.data();
  });

  renderGrid();
});

// ---------------- RENDER GRID ----------------
function renderGrid(){
  garden.innerHTML = '';

  for(let r=0;r<12;r++){
    for(let c=0;c<12;c++){
      const id = tileId(r,c);
      const d = tilesData[id] || {};
      const div = document.createElement('div');

      div.className = 'tile';
      div.textContent = d.title || '';
      div.style.background = d.color || '#e8ffd6';

      if(!d.title) div.classList.add('empty');

      div.onclick = ()=>openPanel(id);
      garden.appendChild(div);
    }
  }
}

// ---------------- OPEN PANEL ----------------
function openPanel(id){
  activeId = id;
  defaultInfo.style.display = 'none';
  editInfo.style.display = 'block';

  // Highlight the active tile
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  const r = parseInt(id.match(/r(\d+)/)[1]);
  const c = parseInt(id.match(/c(\d+)/)[1]);
  const tiles = document.querySelectorAll('.tile');
  if(tiles[r * 12 + c]) tiles[r * 12 + c].classList.add('active');

  const d = tilesData[id] || {};
  titleInput.value = d.title || '';
  descInput.value = d.description || '';
  imgInput.value = d.imageUrl || '';
  colorInput.value = d.color || '#e8ffd6';
}

// ---------------- SAVE ----------------
saveBtn.onclick = async ()=>{
  if(!activeId) return;

  await gardenRef.doc(activeId).set({
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    imageUrl: imgInput.value.trim(),
    color: colorInput.value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
};

// ---------------- CLEAR ----------------
clearBtn.onclick = async ()=>{
  if(!activeId) return;
  await gardenRef.doc(activeId).delete();
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  editInfo.style.display = 'none';
  defaultInfo.style.display = 'block';
};

// ---------------- EXIT ----------------
exitBtn.onclick = ()=>{
  document.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
  editInfo.style.display = 'none';
  defaultInfo.style.display = 'block';
};

// ---------------- MOBILE MODAL BRIDGE ----------------
// Only activates on screens <=900px. Does not affect desktop behaviour.
(function(){
  const overlay     = document.getElementById('modal-overlay');
  const mTitle      = document.getElementById('modal-plotTitle');
  const mTitleInput = document.getElementById('modal-titleInput');
  const mDesc       = document.getElementById('modal-descInput');
  const mImg        = document.getElementById('modal-imgInput');
  const mColor      = document.getElementById('modal-colorInput');

  function isMobile(){ return window.innerWidth <= 900; }

  function closeModal(){
    overlay.classList.add('closing');
    setTimeout(()=>{
      overlay.classList.remove('open','closing');
      document.body.classList.remove('modal-open');
    }, 280);
  }

  // Wrap openPanel so it also opens the modal on mobile
  const _origOpen = openPanel;
  window.openPanel = function(id){
    _origOpen(id); // run original — sets activeId & populates desktop inputs
    if(!isMobile()) return;

    const d = tilesData[id] || {};
    mTitle.textContent = d.title || 'Empty Plot';
    mTitleInput.value  = d.title       || '';
    mDesc.value        = d.description || '';
    mImg.value         = d.imageUrl    || '';
    mColor.value       = d.color       || '#e8ffd6';
    overlay.classList.add('open');
    document.body.classList.add('modal-open');
  };

  // Tap the dark backdrop to dismiss
  overlay.addEventListener('click', function(e){
    if(e.target === overlay) closeModal();
  });

  // Modal Save — syncs values back to desktop inputs then fires original save
  document.getElementById('modal-saveBtn').onclick = async function(){
    if(!activeId) return;
    titleInput.value = mTitleInput.value;
    descInput.value  = mDesc.value;
    imgInput.value   = mImg.value;
    colorInput.value = mColor.value;
    saveBtn.click();
    closeModal();
  };

  // Modal Clear
  document.getElementById('modal-clearBtn').onclick = function(){
    clearBtn.click();
    closeModal();
  };

  // Modal Exit
  document.getElementById('modal-exitBtn').onclick = function(){
    exitBtn.click();
    closeModal();
  };
})();
