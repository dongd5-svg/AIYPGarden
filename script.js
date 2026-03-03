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

  editInfo.style.display = 'none';
  defaultInfo.style.display = 'block';
};

// ---------------- EXIT ----------------
exitBtn.onclick = ()=>{
  editInfo.style.display = 'none';
  defaultInfo.style.display = 'block';
};