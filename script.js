// ================================================================
// AUTH
// ================================================================
const auth     = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db       = firebase.firestore();
const storage  = firebase.storage();

const loginGate       = document.getElementById('loginGate');
const appShell        = document.getElementById('app');
const signOutBtn      = document.getElementById('signOutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');

document.getElementById('googleBtn').onclick = () =>
  auth.signInWithPopup(provider).catch(err => alert(err.message));
signOutBtn.onclick = () => auth.signOut();

let currentUser = null;

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    loginGate.style.display = 'none';
    appShell.style.display  = 'block';
    userNameDisplay.textContent = user.displayName || user.email;
    if (user.photoURL) document.getElementById('profileImg').src = user.photoURL;
    const av = document.getElementById('composeAvatar');
    if (av) {
      if (user.photoURL) { av.style.backgroundImage=`url(${user.photoURL})`; av.style.backgroundSize='cover'; av.textContent=''; }
      else { av.textContent = (user.displayName||user.email||'?')[0].toUpperCase(); }
    }
    navigateTo('home');
    loadMyGardens();
  } else {
    loginGate.style.display = 'flex';
    appShell.style.display  = 'none';
  }
});

// ================================================================
// PRIORITY CONFIG
// ================================================================
const PRIORITY_ORDER = ['urgent','high','medium','low','none'];
const PRIORITY_COLORS = {
  urgent:  '#ffb3b3', // pastel red
  high:    '#ffd5a8', // pastel orange
  medium:  '#fff3a8', // pastel yellow
  low:     '#b3d4ff', // pastel blue
  none:    null
};
const PRIORITY_LABELS = { urgent:'🔴 Urgent', high:'🟠 High', medium:'🟡 Medium', low:'🔵 Low', none:'None' };
const STATUS_LABELS   = { todo:'To Do', inprogress:'In Progress', done:'✓ Done' };

// ================================================================
// UPLOAD HELPERS
// ================================================================
function uploadImage({ path, barEl, labelEl }) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error('cancelled'));
      const ext = file.name.split('.').pop();
      const ref  = storage.ref(`${path}/${Date.now()}.${ext}`);
      const task = ref.put(file);
      if (barEl) { barEl.parentElement.style.display='block'; barEl.style.width='0%'; }
      if (labelEl) { labelEl.style.display='inline'; labelEl.textContent='Uploading…'; }
      task.on('state_changed',
        snap => { const p=Math.round(snap.bytesTransferred/snap.totalBytes*100); if(barEl) barEl.style.width=p+'%'; if(labelEl) labelEl.textContent=`Uploading… ${p}%`; },
        err  => { if(barEl) barEl.parentElement.style.display='none'; if(labelEl) labelEl.style.display='none'; reject(err); },
        async () => { const url=await task.snapshot.ref.getDownloadURL(); if(barEl) barEl.parentElement.style.display='none'; if(labelEl){labelEl.textContent='✓ Done';setTimeout(()=>labelEl.style.display='none',1500);} resolve(url); }
      );
    };
    input.click();
  });
}
async function uploadPostImage() {
  try {
    const url = await uploadImage({ path:`posts/${currentUser.uid}`, barEl:document.getElementById('postUploadBar') });
    pendingImageUrl = url;
    document.getElementById('composeImgThumb').src = url;
    document.getElementById('composeImgPreview').style.display = 'flex';
  } catch(e) { if(e.message!=='cancelled') alert('Upload failed: '+e.message); }
}
async function uploadTileImage(isMobile) {
  const btn = document.getElementById(isMobile?'modal-tileUploadBtn':'tileUploadBtn');
  const labelEl = document.getElementById(isMobile?'modalTileUploadLabel':'tileUploadLabel');
  const barEl   = isMobile ? null : document.getElementById('tileUploadBar');
  if (btn) btn.disabled = true;
  try {
    const url = await uploadImage({ path:`tiles/${currentUser.uid}`, barEl, labelEl });
    document.getElementById('imgInput').value       = url;
    document.getElementById('modal-imgInput').value = url;
  } catch(e) { if(e.message!=='cancelled') alert('Upload failed: '+e.message); }
  finally { if(btn) btn.disabled=false; }
}
document.getElementById('tileUploadBtn').onclick       = () => uploadTileImage(false);
document.getElementById('modal-tileUploadBtn').onclick = () => uploadTileImage(true);

// ================================================================
// NAVIGATION
// ================================================================
let currentPage = 'home';
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  if (pageEl) pageEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');
  currentPage = page;
  if (page==='public')    loadPublicGardens();
  if (page==='community') loadFeed();
}
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => { if(currentGardenId) exitGarden(); navigateTo(btn.dataset.page); };
});
document.getElementById('navLogo').onclick = () => { if(currentGardenId) exitGarden(); navigateTo('home'); };

// ================================================================
// MY GARDENS
// ================================================================
const myGrid        = document.getElementById('my-gardens-grid');
const sharedGrid    = document.getElementById('shared-gardens-grid');
const sharedSection = document.getElementById('shared-section');
const emptyState    = document.getElementById('empty-state');

document.getElementById('createGardenBtn').onclick = openCreateModal;
document.getElementById('emptyCreateBtn').onclick  = openCreateModal;

let myGardensUnsubscribe     = null;
let sharedGardensUnsubscribe = null;

function loadMyGardens() {
  if (myGardensUnsubscribe)    myGardensUnsubscribe();
  if (sharedGardensUnsubscribe) clearInterval(sharedGardensUnsubscribe);

  const renderOwned = snap => {
    myGrid.innerHTML = '';
    if (snap.empty) { emptyState.style.display='block'; return; }
    emptyState.style.display = 'none';
    snap.forEach(doc => myGrid.appendChild(buildGardenCard(doc.id, doc.data(), true)));
  };

  myGardensUnsubscribe = db.collection('gardens')
    .where('ownerId','==',currentUser.uid)
    .orderBy('createdAt','desc')
    .onSnapshot(renderOwned, () => {
      db.collection('gardens').where('ownerId','==',currentUser.uid).get()
        .then(renderOwned).catch(err=>console.error('Owned gardens error:',err));
    });

  const renderShared = snap => {
    sharedGrid.innerHTML = '';
    if (snap.empty) { sharedSection.style.display='none'; return; }
    sharedSection.style.display = 'block';
    snap.forEach(doc => sharedGrid.appendChild(buildGardenCard(doc.id, doc.data(), false)));
  };

  const loadShared = () => {
    db.collection('gardens')
      .where('collaboratorEmails','array-contains',currentUser.email)
      .get().then(renderShared)
      .catch(err => { console.error('Shared gardens error:',err.message); sharedSection.style.display='none'; });
  };
  loadShared();
  sharedGardensUnsubscribe = setInterval(loadShared, 30000);
}

// ================================================================
// PUBLIC GARDENS
// ================================================================
const publicGrid       = document.getElementById('public-gardens-grid');
const publicEmptyState = document.getElementById('public-empty-state');
function loadPublicGardens() {
  db.collection('gardens').where('visibility','==','public').get().then(snap => {
    publicGrid.innerHTML = '';
    if (snap.empty) { publicEmptyState.style.display='block'; return; }
    publicEmptyState.style.display = 'none';
    snap.forEach(doc => publicGrid.appendChild(buildGardenCard(doc.id, doc.data(), currentUser&&doc.data().ownerId===currentUser.uid)));
  });
}

// ================================================================
// GARDEN CARD
// ================================================================
function buildGardenCard(gardenId, data, isOwn) {
  const card = document.createElement('div');
  card.className = 'garden-card';
  const rows=data.rows||6, cols=data.cols||6, pR=Math.min(rows,12), pC=Math.min(cols,12);
  const preview = document.createElement('div');
  preview.className = 'garden-card-preview';
  preview.style.gridTemplateColumns = `repeat(${pC},1fr)`;
  preview.style.gridTemplateRows    = `repeat(${pR},1fr)`;
  const cellMap = {};
  for (let r=0;r<pR;r++) for (let c=0;c<pC;c++) {
    const cell=document.createElement('div'); cell.className='mini-tile';
    cellMap[`r${r}c${c}`]=cell; preview.appendChild(cell);
  }
  db.collection('gardens').doc(gardenId).collection('tiles').get().then(snap=>{
    snap.forEach(doc=>{ if(cellMap[doc.id]&&doc.data().color) cellMap[doc.id].style.background=doc.data().color; });
  });
  const isCollab = !isOwn && (data.collaboratorEmails||[]).includes(currentUser?.email);
  const badge = data.visibility==='public'
    ? '<span class="garden-card-badge badge-public">🌍 Public</span>'
    : isCollab ? '<span class="garden-card-badge badge-collab">✏ Collaborator</span>'
    : '<span class="garden-card-badge badge-private">🔒 Private</span>';
  const ownerLine = (!isOwn&&!isCollab&&data.ownerName) ? `<div class="garden-card-owner">by ${escHtml(data.ownerName)}</div>` : '';
  const collabLine = (isCollab&&data.ownerName) ? `<div class="garden-card-owner">by ${escHtml(data.ownerName)}</div>` : '';
  card.innerHTML = `<div class="garden-card-meta">${badge}<span>${rows}×${cols}</span></div><h3>${escHtml(data.name||'Unnamed Garden')}</h3>${ownerLine}${collabLine}`;
  card.insertBefore(preview, card.firstChild);
  card.onclick = () => openGarden(gardenId, data, isOwn||isCollab);
  return card;
}
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ================================================================
// CREATE GARDEN MODAL
// ================================================================
const createOverlay    = document.getElementById('create-modal-overlay');
const gardenNameInput  = document.getElementById('gardenNameInput');
const gridRowsInput    = document.getElementById('gridRows');
const gridColsInput    = document.getElementById('gridCols');
const gridPreviewEl    = document.getElementById('gridPreview');
const gridPreviewLabel = document.getElementById('gridPreviewLabel');
let selectedVisibility = 'private';

function openCreateModal() {
  gardenNameInput.value=''; gridRowsInput.value='6'; gridColsInput.value='6';
  selectedVisibility='private';
  document.getElementById('visPrivate').classList.add('active');
  document.getElementById('visPublic').classList.remove('active');
  updateGridPreview(); createOverlay.classList.add('open');
  setTimeout(()=>gardenNameInput.focus(),200);
}
document.getElementById('createModalCloseBtn').onclick = ()=>createOverlay.classList.remove('open');
createOverlay.addEventListener('click',e=>{if(e.target===createOverlay)createOverlay.classList.remove('open');});
document.querySelectorAll('.stepper-btn').forEach(btn=>{
  btn.onclick=()=>{const t=document.getElementById(btn.dataset.target);t.value=Math.min(+t.max||20,Math.max(+t.min||2,+t.value+(+btn.dataset.dir)));updateGridPreview();};
});
gridRowsInput.addEventListener('input',updateGridPreview);
gridColsInput.addEventListener('input',updateGridPreview);
function updateGridPreview() {
  const r=Math.min(20,Math.max(2,+gridRowsInput.value||6)), c=Math.min(20,Math.max(2,+gridColsInput.value||6));
  gridPreviewEl.style.gridTemplateColumns=`repeat(${Math.min(c,16)},1fr)`;
  gridPreviewEl.style.gridTemplateRows=`repeat(${Math.min(r,16)},1fr)`;
  gridPreviewEl.innerHTML='';
  for(let i=0;i<Math.min(r,16)*Math.min(c,16);i++){const cell=document.createElement('div');cell.className='preview-cell';gridPreviewEl.appendChild(cell);}
  gridPreviewLabel.textContent=`${r*c} plot${r*c!==1?'s':''}`;
}
document.getElementById('visPrivate').onclick=()=>setVis('private');
document.getElementById('visPublic').onclick=()=>setVis('public');
function setVis(v){selectedVisibility=v;document.getElementById('visPrivate').classList.toggle('active',v==='private');document.getElementById('visPublic').classList.toggle('active',v==='public');}
document.getElementById('confirmCreateGardenBtn').onclick = async ()=>{
  const name=gardenNameInput.value.trim(); if(!name){gardenNameInput.focus();return;}
  const rows=Math.min(20,Math.max(2,+gridRowsInput.value||6)), cols=Math.min(20,Math.max(2,+gridColsInput.value||6));
  const docRef=await db.collection('gardens').add({name,rows,cols,ownerId:currentUser.uid,ownerName:currentUser.displayName||currentUser.email,ownerEmail:currentUser.email,visibility:selectedVisibility,collaboratorEmails:[],taskDisplayMode:'color',createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  createOverlay.classList.remove('open');
  openGarden(docRef.id,{name,rows,cols,ownerId:currentUser.uid,visibility:selectedVisibility,collaboratorEmails:[],taskDisplayMode:'color'},true);
};

// ================================================================
// GARDEN SETTINGS MODAL
// ================================================================
const settingsOverlay = document.getElementById('settings-modal-overlay');
document.getElementById('settingsModalCloseBtn').onclick=()=>settingsOverlay.classList.remove('open');
settingsOverlay.addEventListener('click',e=>{if(e.target===settingsOverlay)settingsOverlay.classList.remove('open');});

function openSettingsModal() {
  if(!currentGardenData) return;
  document.getElementById('settingsGardenName').textContent=currentGardenData.name||'';
  const isPublic=currentGardenData.visibility==='public';
  document.getElementById('settingsVisPrivate').classList.toggle('active',!isPublic);
  document.getElementById('settingsVisPublic').classList.toggle('active',isPublic);
  // task display mode
  const mode = currentGardenData.taskDisplayMode||'color';
  document.querySelectorAll('.task-display-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===mode));
  renderCollabList();
  settingsOverlay.classList.add('open');
}
document.getElementById('gardenSettingsBtn').onclick=openSettingsModal;

document.getElementById('settingsVisPrivate').onclick=async()=>{await updateGardenVisibility('private');document.getElementById('settingsVisPrivate').classList.add('active');document.getElementById('settingsVisPublic').classList.remove('active');};
document.getElementById('settingsVisPublic').onclick=async()=>{await updateGardenVisibility('public');document.getElementById('settingsVisPublic').classList.add('active');document.getElementById('settingsVisPrivate').classList.remove('active');};
async function updateGardenVisibility(val){await db.collection('gardens').doc(currentGardenId).update({visibility:val});currentGardenData.visibility=val;}

// Task display mode buttons
document.querySelectorAll('.task-display-btn').forEach(btn=>{
  btn.onclick=async()=>{
    const val=btn.dataset.val;
    document.querySelectorAll('.task-display-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===val));
    await db.collection('gardens').doc(currentGardenId).update({taskDisplayMode:val});
    currentGardenData.taskDisplayMode=val;
    renderGrid();
  };
});

function renderCollabList(){
  const list=document.getElementById('collabList'), emails=currentGardenData.collaboratorEmails||[];
  list.innerHTML='';
  if(emails.length===0){list.innerHTML='<p class="collab-empty">No collaborators yet.</p>';return;}
  emails.forEach(email=>{
    const row=document.createElement('div');row.className='collab-row';
    row.innerHTML=`<span class="collab-email">${escHtml(email)}</span><button class="collab-remove-btn" data-email="${escHtml(email)}">✕</button>`;
    row.querySelector('.collab-remove-btn').onclick=()=>removeCollaborator(email);
    list.appendChild(row);
  });
}
document.getElementById('addCollabBtn').onclick=addCollaborator;
document.getElementById('collabEmailInput').addEventListener('keydown',e=>{if(e.key==='Enter')addCollaborator();});
async function addCollaborator(){
  const input=document.getElementById('collabEmailInput'), email=input.value.trim().toLowerCase();
  if(!email||!email.includes('@'))return;
  const emails=currentGardenData.collaboratorEmails||[];
  if(emails.includes(email)){input.value='';return;}
  emails.push(email);
  await db.collection('gardens').doc(currentGardenId).update({collaboratorEmails:emails});
  currentGardenData.collaboratorEmails=emails; input.value=''; renderCollabList();
}
async function removeCollaborator(email){
  const emails=(currentGardenData.collaboratorEmails||[]).filter(e=>e!==email);
  await db.collection('gardens').doc(currentGardenId).update({collaboratorEmails:emails});
  currentGardenData.collaboratorEmails=emails; renderCollabList();
}
document.getElementById('deleteGardenBtn').onclick=async()=>{
  if(!currentGardenId)return;
  const name=currentGardenData?.name||'this garden';
  if(!confirm(`Permanently delete "${name}"? This cannot be undone.`))return;
  const tilesSnap=await db.collection('gardens').doc(currentGardenId).collection('tiles').get();
  const batch=db.batch(); tilesSnap.forEach(doc=>batch.delete(doc.ref)); await batch.commit();
  // delete tasks too
  const tasksSnap=await db.collection('gardens').doc(currentGardenId).collection('tasks').get();
  const batch2=db.batch(); tasksSnap.forEach(doc=>batch2.delete(doc.ref)); await batch2.commit();
  await db.collection('gardens').doc(currentGardenId).delete();
  settingsOverlay.classList.remove('open'); exitGarden(); navigateTo('home');
};

// ================================================================
// GARDEN VIEW
// ================================================================
let currentGardenId   = null;
let currentGardenData = null;
let isGardenOwner     = false;
let tilesData         = {};
let tasksData         = {};  // taskId -> taskObj
let activeId          = null;
let tilesUnsubscribe  = null;
let tasksUnsubscribe  = null;

function tileId(r,c){return `r${r}c${c}`;}
function tileRC(id){return{r:+id.match(/r(\d+)/)[1],c:+id.match(/c(\d+)/)[1]};}

function openGarden(gardenId, gardenData, isOwn) {
  currentGardenId=gardenId; currentGardenData=gardenData; isGardenOwner=isOwn;
  document.getElementById('gardenTitle').textContent=gardenData.name||'Garden';
  document.getElementById('gardenOwnerBadge').textContent=isOwn?'':`by ${gardenData.ownerName||'unknown'}`;
  document.getElementById('gardenSettingsBtn').style.display=(isOwn&&gardenData.ownerId===currentUser?.uid)?'inline-block':'none';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-garden').classList.add('active');
  currentPage='garden';
  const rows=gardenData.rows||6, cols=gardenData.cols||6;
  const container=document.getElementById('garden-container');
  const maxSize=Math.min(window.innerWidth>900?window.innerHeight*0.75:window.innerWidth*0.96,700);
  container.style.width=maxSize+'px'; container.style.height=maxSize+'px';
  container.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  container.style.gridTemplateRows=`repeat(${rows},1fr)`;
  container.style.fontSize=Math.max(8,Math.min(14,(maxSize/Math.max(rows,cols))*0.35))+'px';
  activeId=null;
  document.getElementById('editInfo').style.display='none';
  document.getElementById('defaultInfo').style.display='block';
  if(tilesUnsubscribe) tilesUnsubscribe();
  if(tasksUnsubscribe) tasksUnsubscribe();
  tilesData={}; tasksData={};
  tilesUnsubscribe=db.collection('gardens').doc(gardenId).collection('tiles').onSnapshot(snap=>{
    tilesData={}; snap.forEach(doc=>{tilesData[doc.id]=doc.data();}); renderGrid();
  });
  tasksUnsubscribe=db.collection('gardens').doc(gardenId).collection('tasks').onSnapshot(snap=>{
    tasksData={}; snap.forEach(doc=>{tasksData[doc.id]=doc.data();}); renderGrid();
    if(activeId) refreshTileTasksList(activeId);
    if(document.getElementById('tasks-view-overlay').classList.contains('open')) renderTasksView();
  });
}
function exitGarden(){
  if(tilesUnsubscribe){tilesUnsubscribe();tilesUnsubscribe=null;}
  if(tasksUnsubscribe){tasksUnsubscribe();tasksUnsubscribe=null;}
  if(mergeMode)toggleMergeMode(false);
  currentGardenId=null;activeId=null;tilesData={};tasksData={};
}
document.getElementById('backBtn').onclick=()=>{exitGarden();navigateTo(currentUser?'home':'public');};

// ================================================================
// TASKS — FULL GARDEN VIEW
// ================================================================
const tasksViewOverlay = document.getElementById('tasks-view-overlay');
let tasksFilter = 'all';

document.getElementById('gardenTasksBtn').onclick=()=>{tasksFilter='all';openTasksView();};
document.getElementById('tasksViewBackBtn').onclick=()=>tasksViewOverlay.classList.remove('open');
document.getElementById('tasksViewAddBtn').onclick=()=>openTaskModal(null,null);

document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    tasksFilter=btn.dataset.filter;
    renderTasksView();
  };
});

function openTasksView(){
  document.getElementById('tasksViewTitle').textContent=(currentGardenData?.name||'Garden')+' — Tasks';
  tasksViewOverlay.classList.add('open');
  renderTasksView();
}

function renderTasksView(){
  const list=document.getElementById('tasks-list');
  const empty=document.getElementById('tasks-empty');
  list.innerHTML='';
  let tasks=Object.entries(tasksData).map(([id,d])=>({id,...d}));
  // filter
  if(tasksFilter==='todo')       tasks=tasks.filter(t=>t.status==='todo');
  else if(tasksFilter==='inprogress') tasks=tasks.filter(t=>t.status==='inprogress');
  else if(tasksFilter==='done')  tasks=tasks.filter(t=>t.status==='done');
  else if(['urgent','high','medium','low'].includes(tasksFilter)) tasks=tasks.filter(t=>t.priority===tasksFilter);
  // sort: by priority then createdAt
  tasks.sort((a,b)=>{
    const pi=PRIORITY_ORDER.indexOf(a.priority||'none'), qi=PRIORITY_ORDER.indexOf(b.priority||'none');
    return pi!==qi?pi-qi:0;
  });
  if(tasks.length===0){empty.style.display='block';return;}
  empty.style.display='none';
  tasks.forEach(task=>list.appendChild(buildTaskCard(task,false)));
}

// ================================================================
// TASKS — TILE-LEVEL LIST
// ================================================================
function refreshTileTasksList(tileId){
  // Desktop panel
  const list=document.getElementById('tileTasksList');
  const mList=document.getElementById('mTileTasksList');
  if(!list&&!mList)return;
  const tasks=Object.entries(tasksData)
    .map(([id,d])=>({id,...d}))
    .filter(t=>(t.linkedTiles||[]).includes(tileId))
    .sort((a,b)=>PRIORITY_ORDER.indexOf(a.priority||'none')-PRIORITY_ORDER.indexOf(b.priority||'none'));
  if(list){list.innerHTML='';tasks.forEach(t=>list.appendChild(buildTaskCard(t,true)));}
  if(mList){mList.innerHTML='';tasks.forEach(t=>mList.appendChild(buildTaskCard(t,true)));}
}

function buildTaskCard(task, compact){
  const card=document.createElement('div');
  card.className='task-card'+(task.status==='done'?' task-done':'');
  const pColor=PRIORITY_COLORS[task.priority||'none'];
  if(pColor) card.style.borderLeft=`4px solid ${pColor}`;
  const linkedTilesHtml=(task.linkedTiles||[]).length
    ?`<div class="task-linked-tiles">${task.linkedTiles.map(tid=>{const d=tilesData[tid];return`<span class="task-tile-chip">${d?.title||tid}</span>`;}).join('')}</div>`:'';
  card.innerHTML=`
    <div class="task-card-header">
      <label class="task-check-wrap">
        <input type="checkbox" class="task-check" ${task.status==='done'?'checked':''} />
        <span class="task-title">${escHtml(task.title||'Untitled')}</span>
      </label>
      <div class="task-card-right">
        ${task.priority&&task.priority!=='none'?`<span class="task-priority-badge" style="background:${pColor}">${PRIORITY_LABELS[task.priority]}</span>`:''}
        ${!compact?`<span class="task-status-badge">${STATUS_LABELS[task.status||'todo']}</span>`:''}
        <button class="task-edit-btn">✏</button>
      </div>
    </div>
    ${task.description&&!compact?`<p class="task-desc">${escHtml(task.description)}</p>`:''}
    ${!compact?linkedTilesHtml:''}
  `;
  card.querySelector('.task-check').onchange=async(e)=>{
    const newStatus=e.target.checked?'done':'todo';
    await db.collection('gardens').doc(currentGardenId).collection('tasks').doc(task.id).update({status:newStatus});
  };
  card.querySelector('.task-edit-btn').onclick=()=>openTaskModal(task.id, compact?activeId:null);
  return card;
}

// ================================================================
// TASK MODAL (create / edit)
// ================================================================
const taskModalOverlay = document.getElementById('task-modal-overlay');
let editingTaskId  = null;
let taskPriority   = 'none';
let taskStatus     = 'todo';
let taskLinkedTiles= [];

document.getElementById('taskModalCloseBtn').onclick=()=>taskModalOverlay.classList.remove('open');
taskModalOverlay.addEventListener('click',e=>{if(e.target===taskModalOverlay)taskModalOverlay.classList.remove('open');});

function openTaskModal(taskId, defaultTileId){
  editingTaskId=taskId;
  const task=taskId?tasksData[taskId]:null;
  document.getElementById('taskModalTitle').textContent=task?'Edit Task':'New Task';
  document.getElementById('taskTitleInput').value=task?.title||'';
  document.getElementById('taskDescInput').value=task?.description||'';
  taskPriority=task?.priority||'none';
  taskStatus=task?.status||'todo';
  taskLinkedTiles=[...(task?.linkedTiles||[])];
  if(!taskId&&defaultTileId&&!taskLinkedTiles.includes(defaultTileId)) taskLinkedTiles.push(defaultTileId);
  // priority picker
  document.querySelectorAll('.priority-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===taskPriority));
  // status picker
  document.querySelectorAll('.status-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===taskStatus));
  // tile picker
  buildTilePicker();
  document.getElementById('deleteTaskBtn').style.display=taskId?'inline-block':'none';
  taskModalOverlay.classList.add('open');
  setTimeout(()=>document.getElementById('taskTitleInput').focus(),200);
}

document.querySelectorAll('.priority-btn').forEach(btn=>{
  btn.onclick=()=>{taskPriority=btn.dataset.val;document.querySelectorAll('.priority-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===taskPriority));};
});
document.querySelectorAll('.status-btn').forEach(btn=>{
  btn.onclick=()=>{taskStatus=btn.dataset.val;document.querySelectorAll('.status-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===taskStatus));};
});

function buildTilePicker(){
  const picker=document.getElementById('taskTilePicker');
  picker.innerHTML='';
  if(!currentGardenData)return;
  const rows=currentGardenData.rows||6, cols=currentGardenData.cols||6;
  // Only show tiles that have a title
  const namedTiles=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const id=tileId(r,c), d=tilesData[id]||{};
    if(d.title) namedTiles.push({id,title:d.title});
  }
  if(namedTiles.length===0){picker.innerHTML='<p style="color:#888;font-size:0.85rem">No named plots yet — add a title to a plot first.</p>';return;}
  namedTiles.forEach(({id,title})=>{
    const chip=document.createElement('button');
    chip.className='tile-pick-chip'+(taskLinkedTiles.includes(id)?' selected':'');
    chip.textContent=title;
    chip.onclick=()=>{
      if(taskLinkedTiles.includes(id)) taskLinkedTiles=taskLinkedTiles.filter(t=>t!==id);
      else taskLinkedTiles.push(id);
      chip.classList.toggle('selected',taskLinkedTiles.includes(id));
    };
    picker.appendChild(chip);
  });
}

document.getElementById('saveTaskBtn').onclick=async()=>{
  const title=document.getElementById('taskTitleInput').value.trim();
  if(!title)return;
  const payload={title,description:document.getElementById('taskDescInput').value.trim(),priority:taskPriority,status:taskStatus,linkedTiles:taskLinkedTiles,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(editingTaskId){
    await db.collection('gardens').doc(currentGardenId).collection('tasks').doc(editingTaskId).update(payload);
  } else {
    await db.collection('gardens').doc(currentGardenId).collection('tasks').add({...payload,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  }
  taskModalOverlay.classList.remove('open');
};

document.getElementById('deleteTaskBtn').onclick=async()=>{
  if(!editingTaskId||!confirm('Delete this task?'))return;
  await db.collection('gardens').doc(currentGardenId).collection('tasks').doc(editingTaskId).delete();
  taskModalOverlay.classList.remove('open');
};

// ================================================================
// RENDER GRID  (with task priority overlay)
// ================================================================
function getTilePriorityColor(tileId){
  const mode=currentGardenData?.taskDisplayMode||'color';
  if(mode==='off') return null;
  // find highest priority active (non-done) task linked to this tile
  const activeTasks=Object.values(tasksData).filter(t=>(t.linkedTiles||[]).includes(tileId)&&t.status!=='done');
  if(activeTasks.length===0) return null;
  activeTasks.sort((a,b)=>PRIORITY_ORDER.indexOf(a.priority||'none')-PRIORITY_ORDER.indexOf(b.priority||'none'));
  const top=activeTasks[0];
  if(!top.priority||top.priority==='none') return null;
  return {color:PRIORITY_COLORS[top.priority], badge:mode==='badge'};
}

function renderGrid(){
  if(!currentGardenData)return;
  const garden=document.getElementById('garden-container');
  const rows=currentGardenData.rows||6, cols=currentGardenData.cols||6;
  garden.innerHTML='';
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const id=tileId(r,c), d=tilesData[id]||{};
    const div=document.createElement('div');
    div.className='tile'; div.dataset.id=id;
    const baseColor=d.color||'#e8ffd6';
    const taskInfo=getTilePriorityColor(id);
    if(taskInfo&&!taskInfo.badge){
      // blend priority color as a tint over the base
      div.style.background=taskInfo.color;
      div.style.outline=`2px solid ${taskInfo.color}`;
    } else {
      div.style.background=baseColor;
    }
    const group=d.mergeGroup;
    const label=group?(isMergeLeader(id,group)?(d.title||''):''):(d.title||'');
    if(taskInfo&&taskInfo.badge){
      div.innerHTML=`<span>${escHtml(label)}</span><span class="priority-exclaim">❗</span>`;
    } else {
      div.textContent=label;
    }
    if(!d.title&&!(taskInfo&&taskInfo.badge)) div.classList.add('empty');
    applyMergeBorderClasses(div,id,r,c,rows,cols);
    if(id===activeId) div.classList.add('active');
    if(isGardenOwner){ div.onclick=()=>handleTileClick(id); }
    else { div.style.cursor='default'; div.onclick=()=>showReadOnlyInfo(id); }
    garden.appendChild(div);
  }
  if(mergeMode)applyMergeModeUI();
}

function isMergeLeader(id,group){const members=Object.keys(tilesData).filter(k=>tilesData[k].mergeGroup===group);members.sort((a,b)=>{const ra=tileRC(a),rb=tileRC(b);return ra.r!==rb.r?ra.r-rb.r:ra.c-rb.c;});return members[0]===id;}
function applyMergeBorderClasses(div,id,r,c,rows,cols){const g=(tilesData[id]||{}).mergeGroup;if(!g)return;if(r>0&&(tilesData[tileId(r-1,c)]||{}).mergeGroup===g)div.classList.add('merge-top');if(r<rows-1&&(tilesData[tileId(r+1,c)]||{}).mergeGroup===g)div.classList.add('merge-bottom');if(c>0&&(tilesData[tileId(r,c-1)]||{}).mergeGroup===g)div.classList.add('merge-left');if(c<cols-1&&(tilesData[tileId(r,c+1)]||{}).mergeGroup===g)div.classList.add('merge-right');}
function showReadOnlyInfo(id){const d=tilesData[id]||{};if(!d.title)return;document.getElementById('defaultInfo').innerHTML=`<h2>${escHtml(d.title)}</h2>${d.description?`<p>${escHtml(d.description)}</p>`:''}${d.imageUrl?`<img src="${escHtml(d.imageUrl)}" style="width:100%;border-radius:0.5rem;margin-top:0.5rem"/>`:''}`; document.getElementById('editInfo').style.display='none';document.getElementById('defaultInfo').style.display='block';}

// ================================================================
// TILE PANEL — tabs
// ================================================================
const editInfo    = document.getElementById('editInfo');
const defaultInfo = document.getElementById('defaultInfo');
const titleInput  = document.getElementById('titleInput');
const descInput   = document.getElementById('descInput');
const imgInput    = document.getElementById('imgInput');
const colorInput  = document.getElementById('colorInput');
const splitBtn    = document.getElementById('splitBtn');

document.getElementById('tabPlot').onclick=()=>switchPanelTab('plot');
document.getElementById('tabTasks').onclick=()=>switchPanelTab('tasks');
function switchPanelTab(tab){
  document.getElementById('panelPlot').style.display=tab==='plot'?'block':'none';
  document.getElementById('panelTasks').style.display=tab==='tasks'?'block':'none';
  document.getElementById('tabPlot').classList.toggle('active',tab==='plot');
  document.getElementById('tabTasks').classList.toggle('active',tab==='tasks');
  if(tab==='tasks'&&activeId) refreshTileTasksList(activeId);
}

document.getElementById('addTaskBtn').onclick=()=>openTaskModal(null,activeId);

function openPanel(id){
  activeId=id;
  defaultInfo.style.display='none'; editInfo.style.display='block';
  document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));
  const{r,c}=tileRC(id), cols=currentGardenData.cols||6, tiles=document.querySelectorAll('.tile');
  if(tiles[r*cols+c]) tiles[r*cols+c].classList.add('active');
  const d=tilesData[id]||{};
  titleInput.value=d.title||''; descInput.value=d.description||''; imgInput.value=d.imageUrl||''; colorInput.value=d.color||'#e8ffd6';
  splitBtn.style.display=d.mergeGroup?'inline-block':'none';
  document.getElementById('tasksTileLabel').textContent=d.title||'This plot';
  switchPanelTab('plot');
}
function handleTileClick(id){if(mergeMode)toggleMergeSelection(id);else openPanel(id);}
function tilesRef(){return db.collection('gardens').doc(currentGardenId).collection('tiles');}

document.getElementById('saveBtn').onclick=async()=>{
  if(!activeId)return;
  const d=tilesData[activeId]||{};
  const payload={title:titleInput.value.trim(),description:descInput.value.trim(),imageUrl:imgInput.value.trim(),color:colorInput.value,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(d.mergeGroup){const batch=db.batch();Object.keys(tilesData).forEach(k=>{if(tilesData[k].mergeGroup===d.mergeGroup)batch.set(tilesRef().doc(k),{...payload,mergeGroup:d.mergeGroup});});await batch.commit();}
  else{await tilesRef().doc(activeId).set(payload);}
  db.collection('gardens').doc(currentGardenId).update({updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
};
document.getElementById('clearBtn').onclick=async()=>{
  if(!activeId)return;
  const d=tilesData[activeId]||{};
  if(d.mergeGroup){const batch=db.batch();Object.keys(tilesData).forEach(k=>{if(tilesData[k].mergeGroup===d.mergeGroup)batch.delete(tilesRef().doc(k));});await batch.commit();}
  else{await tilesRef().doc(activeId).delete();}
  document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));
  activeId=null; editInfo.style.display='none'; defaultInfo.style.display='block';
};
document.getElementById('exitBtn').onclick=()=>{document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));activeId=null;editInfo.style.display='none';defaultInfo.style.display='block';};
document.getElementById('splitBtn').onclick=async()=>{
  if(!activeId)return;const d=tilesData[activeId]||{};if(!d.mergeGroup)return;
  const batch=db.batch();Object.keys(tilesData).forEach(k=>{if(tilesData[k].mergeGroup===d.mergeGroup){const{mergeGroup,...rest}=tilesData[k];batch.set(tilesRef().doc(k),{...rest,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}});await batch.commit();splitBtn.style.display='none';
};

// ================================================================
// MERGE MODE
// ================================================================
let mergeMode=false, mergeSelected=new Set();
const mergeModeBtn=document.getElementById('mergeModeBtn'), mergeToolbar=document.getElementById('merge-toolbar'), mergeConfirmBtn=document.getElementById('mergeConfirmBtn'), mergeCancelBtn=document.getElementById('mergeCancelBtn'), mergeCountSpan=document.getElementById('mergeCount');
mergeModeBtn.onclick=()=>toggleMergeMode();
function toggleMergeMode(on){
  mergeMode=on!==undefined?on:!mergeMode; mergeSelected.clear();
  document.body.classList.toggle('merge-mode',mergeMode); mergeModeBtn.classList.toggle('active',mergeMode); mergeModeBtn.textContent=mergeMode?'✕ Cancel':'⊞ Merge';
  if(mergeMode){editInfo.style.display='none';defaultInfo.style.display='block';document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));activeId=null;mergeToolbar.classList.add('visible');updateMergeToolbar();applyMergeModeUI();}
  else{mergeToolbar.classList.remove('visible');document.querySelectorAll('.tile').forEach(t=>t.classList.remove('merge-selected','merge-eligible','merge-ineligible'));}
}
function getEligibleIds(){const rows=currentGardenData.rows||6,cols=currentGardenData.cols||6;let lg=null;mergeSelected.forEach(id=>{const g=(tilesData[id]||{}).mergeGroup;if(g)lg=g;});const el=new Set();if(mergeSelected.size===0){for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)el.add(tileId(r,c));}else{mergeSelected.forEach(id=>{const{r,c}=tileRC(id);[r>0&&tileId(r-1,c),r<rows-1&&tileId(r+1,c),c>0&&tileId(r,c-1),c<cols-1&&tileId(r,c+1)].filter(Boolean).forEach(n=>{if(!mergeSelected.has(n))el.add(n);});});el.forEach(id=>{const g=(tilesData[id]||{}).mergeGroup;if(g&&lg&&g!==lg)el.delete(id);});}return el;}
function applyMergeModeUI(){const el=getEligibleIds();document.querySelectorAll('.tile').forEach(div=>{const id=div.dataset.id;div.classList.remove('merge-selected','merge-eligible','merge-ineligible');if(mergeSelected.has(id))div.classList.add('merge-selected');else if(el.has(id))div.classList.add('merge-eligible');else div.classList.add('merge-ineligible');});}
function toggleMergeSelection(id){if(mergeSelected.has(id)){mergeSelected.delete(id);if(mergeSelected.size>0&&!isConnected(mergeSelected))mergeSelected.add(id);}else{if(!getEligibleIds().has(id))return;mergeSelected.add(id);}applyMergeModeUI();updateMergeToolbar();}
function isConnected(ids){if(ids.size<=1)return true;const rows=currentGardenData.rows||6,cols=currentGardenData.cols||6,arr=[...ids],visited=new Set(),queue=[arr[0]];visited.add(arr[0]);while(queue.length){const cur=queue.shift(),{r,c}=tileRC(cur);[r>0&&tileId(r-1,c),r<rows-1&&tileId(r+1,c),c>0&&tileId(r,c-1),c<cols-1&&tileId(r,c+1)].filter(Boolean).forEach(n=>{if(ids.has(n)&&!visited.has(n)){visited.add(n);queue.push(n);}});}return visited.size===ids.size;}
function updateMergeToolbar(){const n=mergeSelected.size;mergeCountSpan.textContent=n===0?'Tap tiles to select':`${n} tile${n>1?'s':''} selected`;mergeConfirmBtn.disabled=n<2;}
mergeConfirmBtn.onclick=async()=>{if(mergeSelected.size<2)return;let group=null;mergeSelected.forEach(id=>{const g=(tilesData[id]||{}).mergeGroup;if(g)group=g;});if(!group)group=crypto.randomUUID();const sorted=[...mergeSelected].sort((a,b)=>{const ra=tileRC(a),rb=tileRC(b);return ra.r!==rb.r?ra.r-rb.r:ra.c-rb.c;});const ld=tilesData[sorted[0]]||{};const batch=db.batch();mergeSelected.forEach(id=>{const ex=tilesData[id]||{};batch.set(tilesRef().doc(id),{title:ld.title||ex.title||'',description:ld.description||ex.description||'',imageUrl:ld.imageUrl||ex.imageUrl||'',color:ld.color||ex.color||'#e8ffd6',mergeGroup:group,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});});await batch.commit();toggleMergeMode(false);};
mergeCancelBtn.onclick=()=>toggleMergeMode(false);

// ================================================================
// COMMUNITY FEED
// ================================================================
let pendingImageUrl='', pendingTaggedGardens=[];
const submitPostBtn=document.getElementById('submitPostBtn'), postTextInput=document.getElementById('postTextInput'), addImgBtn=document.getElementById('addImgBtn'), composeImgPreview=document.getElementById('composeImgPreview'), composeImgThumb=document.getElementById('composeImgThumb'), removeImgBtn=document.getElementById('removeImgBtn'), tagGardenBtn=document.getElementById('tagGardenBtn'), composeTagsEl=document.getElementById('composeTags'), feedEl=document.getElementById('community-feed'), feedEmpty=document.getElementById('feed-empty');
addImgBtn.onclick=()=>uploadPostImage();
removeImgBtn.onclick=()=>{pendingImageUrl='';composeImgThumb.src='';composeImgPreview.style.display='none';};
tagGardenBtn.onclick=()=>{const list=document.getElementById('tag-picker-list');list.innerHTML='<p style="color:#888;font-size:0.9rem">Loading…</p>';document.getElementById('tag-picker-overlay').classList.add('open');db.collection('gardens').where('ownerId','==',currentUser.uid).get().then(snap=>{list.innerHTML='';if(snap.empty){list.innerHTML='<p style="color:#888;font-size:0.9rem">No gardens to tag yet.</p>';return;}snap.forEach(doc=>{const d=doc.data(),already=pendingTaggedGardens.find(g=>g.id===doc.id),btn=document.createElement('button');btn.className='tag-picker-item'+(already?' selected':'');btn.textContent=d.name||'Unnamed';btn.onclick=()=>{if(already)pendingTaggedGardens=pendingTaggedGardens.filter(g=>g.id!==doc.id);else pendingTaggedGardens.push({id:doc.id,name:d.name||'Unnamed'});renderComposeTags();document.getElementById('tag-picker-overlay').classList.remove('open');};list.appendChild(btn);});});};
document.getElementById('tagPickerCloseBtn').onclick=()=>document.getElementById('tag-picker-overlay').classList.remove('open');
document.getElementById('tag-picker-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('tag-picker-overlay'))document.getElementById('tag-picker-overlay').classList.remove('open');});
function renderComposeTags(){composeTagsEl.innerHTML='';pendingTaggedGardens.forEach(g=>{const chip=document.createElement('span');chip.className='tag-chip';chip.innerHTML=`🌿 ${escHtml(g.name)} <button class="chip-remove" data-id="${g.id}">✕</button>`;chip.querySelector('.chip-remove').onclick=e=>{e.stopPropagation();pendingTaggedGardens=pendingTaggedGardens.filter(x=>x.id!==g.id);renderComposeTags();};composeTagsEl.appendChild(chip);});}
submitPostBtn.onclick=async()=>{const text=postTextInput.value.trim();if(!text&&!pendingImageUrl)return;submitPostBtn.disabled=true;try{await db.collection('posts').add({authorId:currentUser.uid,authorName:currentUser.displayName||currentUser.email,authorPhoto:currentUser.photoURL||'',text,imageUrl:pendingImageUrl,taggedGardens:pendingTaggedGardens,createdAt:firebase.firestore.FieldValue.serverTimestamp(),likes:[]});postTextInput.value='';pendingImageUrl='';pendingTaggedGardens=[];composeImgPreview.style.display='none';composeImgThumb.src='';renderComposeTags();}finally{submitPostBtn.disabled=false;}};
function loadFeed(){feedEl.innerHTML='';db.collection('posts').orderBy('createdAt','desc').limit(50).onSnapshot(snap=>{feedEl.innerHTML='';if(snap.empty){feedEmpty.style.display='block';return;}feedEmpty.style.display='none';snap.forEach(doc=>feedEl.appendChild(buildPostCard(doc.id,doc.data())))});}
function buildPostCard(postId,data){const card=document.createElement('div');card.className='post-card';const isOwn=currentUser&&data.authorId===currentUser.uid,liked=(data.likes||[]).includes(currentUser?.uid),likeCount=(data.likes||[]).length,initials=(data.authorName||'?')[0].toUpperCase(),avatarHtml=data.authorPhoto?`<img src="${escHtml(data.authorPhoto)}" class="post-avatar-img" alt="" />`:`<div class="post-avatar-initials">${initials}</div>`,imgHtml=data.imageUrl?`<img src="${escHtml(data.imageUrl)}" class="post-image" alt="" onerror="this.style.display='none'" />`:'',tagsHtml=(data.taggedGardens||[]).length?`<div class="post-tags">${data.taggedGardens.map(g=>`<span class="post-tag-chip" data-garden-id="${escHtml(g.id)}">🌿 ${escHtml(g.name)}</span>`).join('')}</div>`:'',timeStr=data.createdAt?.toDate?timeAgo(data.createdAt.toDate()):'just now',deleteBtn=isOwn?`<button class="post-delete-btn" data-id="${postId}">🗑</button>`:'';card.innerHTML=`<div class="post-header"><div class="post-avatar">${avatarHtml}</div><div class="post-meta"><span class="post-author">${escHtml(data.authorName||'Unknown')}</span><span class="post-time">${timeStr}</span></div>${deleteBtn}</div>${data.text?`<p class="post-text">${escHtml(data.text)}</p>`:''}${imgHtml}${tagsHtml}<div class="post-actions"><button class="like-btn ${liked?'liked':''}" data-id="${postId}">${liked?'❤':'🤍'} <span>${likeCount}</span></button></div>`;card.querySelector('.like-btn').onclick=async()=>{const ref=db.collection('posts').doc(postId);if(liked)await ref.update({likes:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)});else await ref.update({likes:firebase.firestore.FieldValue.arrayUnion(currentUser.uid)});};const delBtn=card.querySelector('.post-delete-btn');if(delBtn)delBtn.onclick=async()=>{if(!confirm('Delete this post?'))return;await db.collection('posts').doc(postId).delete();};card.querySelectorAll('.post-tag-chip').forEach(chip=>{chip.onclick=async()=>{const doc=await db.collection('gardens').doc(chip.dataset.gardenId).get();if(doc.exists){const own=currentUser&&doc.data().ownerId===currentUser.uid,collab=(doc.data().collaboratorEmails||[]).includes(currentUser?.email);openGarden(doc.id,doc.data(),own||collab);}};});return card;}
function timeAgo(date){const d=Math.floor((Date.now()-date)/1000);if(d<60)return'just now';if(d<3600)return`${Math.floor(d/60)}m ago`;if(d<86400)return`${Math.floor(d/3600)}h ago`;return`${Math.floor(d/86400)}d ago`;}

// ================================================================
// MOBILE MODAL BRIDGE
// ================================================================
(function(){
  const overlay=document.getElementById('modal-overlay'), mTitle=document.getElementById('modal-plotTitle'), mTitleInput=document.getElementById('modal-titleInput'), mDesc=document.getElementById('modal-descInput'), mImg=document.getElementById('modal-imgInput'), mColor=document.getElementById('modal-colorInput'), mSplitBtn=document.getElementById('modal-splitBtn');
  function isMobile(){return window.innerWidth<=900;}
  function closeModal(){overlay.classList.add('closing');setTimeout(()=>overlay.classList.remove('open','closing'),180);}
  // Mobile panel tabs
  document.getElementById('mTabPlot').onclick=()=>switchMobileTab('plot');
  document.getElementById('mTabTasks').onclick=()=>switchMobileTab('tasks');
  function switchMobileTab(tab){
    document.getElementById('mPanelPlot').style.display=tab==='plot'?'block':'none';
    document.getElementById('mPanelTasks').style.display=tab==='tasks'?'block':'none';
    document.getElementById('mTabPlot').classList.toggle('active',tab==='plot');
    document.getElementById('mTabTasks').classList.toggle('active',tab==='tasks');
    if(tab==='tasks'&&activeId){document.getElementById('mTasksTileLabel').textContent=(tilesData[activeId]||{}).title||'This plot';refreshTileTasksList(activeId);}
  }
  document.getElementById('mAddTaskBtn').onclick=()=>openTaskModal(null,activeId);
  const _orig=openPanel;
  window.openPanel=function(id){
    _orig(id);
    if(!isMobile())return;
    const d=tilesData[id]||{};
    mTitle.textContent=d.title||'Empty Plot';
    mTitleInput.value=d.title||''; mDesc.value=d.description||''; mImg.value=d.imageUrl||''; mColor.value=d.color||'#e8ffd6';
    if(mSplitBtn)mSplitBtn.style.display=d.mergeGroup?'inline-block':'none';
    switchMobileTab('plot');
    overlay.classList.add('open');
  };
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
  document.getElementById('modal-saveBtn').onclick=async()=>{if(!activeId)return;titleInput.value=mTitleInput.value;descInput.value=mDesc.value;imgInput.value=mImg.value;colorInput.value=mColor.value;document.getElementById('saveBtn').click();closeModal();};
  document.getElementById('modal-clearBtn').onclick=()=>{document.getElementById('clearBtn').click();closeModal();};
  document.getElementById('modal-exitBtn').onclick=()=>{document.getElementById('exitBtn').click();closeModal();};
  if(mSplitBtn)mSplitBtn.onclick=()=>{document.getElementById('splitBtn').click();closeModal();};
})();
