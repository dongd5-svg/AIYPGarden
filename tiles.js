// ================================================================
// SETTINGS.JS — garden settings modal
// Handles: visibility, permissions, collaborators,
//          task display mode, companion planting toggle,
//          weather widget toggle, delete garden
// ================================================================

const settingsOverlay = document.getElementById('settings-modal-overlay');

document.getElementById('gardenSettingsBtn').onclick  = openSettingsModal;
document.getElementById('settingsModalCloseBtn').onclick = () => settingsOverlay.classList.remove('open');
settingsOverlay.addEventListener('click', e => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});

// ── Open ─────────────────────────────────────────────────────────
function openSettingsModal() {
  if (!currentGardenData) return;
  const d = currentGardenData;

  document.getElementById('settingsGardenName').textContent = d.name || '';

  // Visibility
  syncVisBtns(d.visibility || 'private');

  // Public permission level
  const permRow = document.getElementById('publicPermRow');
  permRow.style.display = d.visibility === 'public' ? 'block' : 'none';
  syncPermBtns(d.publicPermission || 'viewonly');

  // Task display mode
  syncTaskDisplayBtns(d.taskDisplayMode || 'color');

  // Companion planting toggle
  document.getElementById('companionToggle').checked =
    d.companionPlanting !== false;

  // Weather toggle
  document.getElementById('weatherToggle').checked =
    d.showWeather !== false;

  renderCollabList();
  settingsOverlay.classList.add('open');
}

// ── Visibility ───────────────────────────────────────────────────
function syncVisBtns(val) {
  document.getElementById('settingsVisPrivate').classList.toggle('active', val === 'private');
  document.getElementById('settingsVisPublic').classList.toggle('active',  val === 'public');
  document.getElementById('publicPermRow').style.display = val === 'public' ? 'block' : 'none';
}

document.getElementById('settingsVisPrivate').onclick = async () => {
  await updateGardenField({ visibility: 'private' });
  syncVisBtns('private');
};
document.getElementById('settingsVisPublic').onclick = async () => {
  await updateGardenField({ visibility: 'public' });
  syncVisBtns('public');
};

// ── Public permission level ───────────────────────────────────────
// viewonly | taskonly | openEdit
function syncPermBtns(val) {
  document.querySelectorAll('.perm-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.val === val));
}
document.querySelectorAll('.perm-btn').forEach(btn => {
  btn.onclick = async () => {
    await updateGardenField({ publicPermission: btn.dataset.val });
    syncPermBtns(btn.dataset.val);
  };
});

// ── Task display mode ─────────────────────────────────────────────
function syncTaskDisplayBtns(val) {
  document.querySelectorAll('.task-display-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.val === val));
}
document.querySelectorAll('.task-display-btn').forEach(btn => {
  btn.onclick = async () => {
    await updateGardenField({ taskDisplayMode: btn.dataset.val });
    syncTaskDisplayBtns(btn.dataset.val);
    renderGrid(); // re-render tiles with new display mode
  };
});

// ── Toggles ───────────────────────────────────────────────────────
document.getElementById('companionToggle').onchange = async function() {
  await updateGardenField({ companionPlanting: this.checked });
  renderGrid();
};
document.getElementById('weatherToggle').onchange = async function() {
  await updateGardenField({ showWeather: this.checked });
  const widget = document.getElementById('weatherWidget');
  if (widget) widget.style.display = this.checked ? 'block' : 'none';
};

// ── Collaborators ─────────────────────────────────────────────────
function renderCollabList() {
  const list   = document.getElementById('collabList');
  const emails = currentGardenData.collaboratorEmails || [];
  list.innerHTML = '';
  if (emails.length === 0) {
    list.innerHTML = '<p class="collab-empty">No collaborators yet.</p>';
    return;
  }
  emails.forEach(email => {
    const row = document.createElement('div');
    row.className = 'collab-row';
    row.innerHTML = `
      <span class="collab-email">${escHtml(email)}</span>
      <button class="collab-remove-btn" data-email="${escHtml(email)}">✕</button>
    `;
    row.querySelector('.collab-remove-btn').onclick = () => removeCollaborator(email);
    list.appendChild(row);
  });
}

document.getElementById('addCollabBtn').onclick = addCollaborator;
document.getElementById('collabEmailInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCollaborator();
});

async function addCollaborator() {
  const input = document.getElementById('collabEmailInput');
  const email = input.value.trim().toLowerCase(); // always lowercase
  if (!email || !email.includes('@')) return;
  const emails = [...(currentGardenData.collaboratorEmails || [])];
  if (emails.includes(email)) { input.value = ''; return; }
  emails.push(email);
  await updateGardenField({ collaboratorEmails: emails });
  input.value = '';
  renderCollabList();
  showToast(`${email} added as collaborator`);
  // Notify the collaborator if they have an account
  if (typeof notifyCollabAdded === 'function') {
    notifyCollabAdded(email, currentGardenId, currentGardenData?.name || '');
  }
  // Show message collaborators button
  const msgBtn = document.getElementById('messageCollabsBtn');
  if (msgBtn) msgBtn.style.display = 'block';
}

async function removeCollaborator(email) {
  const emails = (currentGardenData.collaboratorEmails || []).filter(e => e !== email);
  await updateGardenField({ collaboratorEmails: emails });
  renderCollabList();
}

// ── Delete garden ─────────────────────────────────────────────────
document.getElementById('deleteGardenBtn').onclick = async () => {
  if (!currentGardenId) return;
  const name = currentGardenData?.name || 'this garden';
  if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;

  // Delete subcollections
  for (const sub of ['tiles', 'tasks', 'journal', 'harvests', 'expenses']) {
    const snap = await db.collection('gardens').doc(currentGardenId).collection(sub).get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  await db.collection('gardens').doc(currentGardenId).delete();

  settingsOverlay.classList.remove('open');
  exitGarden();
  navigateTo('home');
  showToast('Garden deleted');
};

// ── Helper ────────────────────────────────────────────────────────
async function updateGardenField(fields) {
  await db.collection('gardens').doc(currentGardenId).update(fields);
  Object.assign(currentGardenData, fields);
}

// ── Check if current user can edit tiles ─────────────────────────
function canEditTiles() {
  if (!currentGardenData || !currentUser) return false;
  // Owner
  if (isGardenOwner) return true;
  if (currentGardenData.ownerId === currentUser.uid) return true;
  // Collaborator — compare lowercase emails to avoid case mismatch
  const userEmail = (currentUser.email || '').toLowerCase();
  const collabs   = (currentGardenData.collaboratorEmails || [])
    .map(e => e.toLowerCase());
  if (userEmail && collabs.includes(userEmail)) return true;
  // Public open edit
  if (currentGardenData.visibility === 'public' &&
      currentGardenData.publicPermission === 'openEdit') return true;
  return false;
}

// Check if current user can edit tasks
function canEditTasks() {
  if (!currentGardenData || !currentUser) return false;
  if (canEditTiles()) return true;
  if (currentGardenData.visibility === 'public' &&
      currentGardenData.publicPermission === 'taskonly') return true;
  return false;
}
