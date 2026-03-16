// ================================================================
// MESSAGES.JS — real-time DMs, seen receipts, new DM picker
// ================================================================

let activeConvId     = null;
let msgsUnsubscribe  = null;
let convsUnsubscribe = null;

// ── Init DMs ─────────────────────────────────────────────────────
function initDms() {
  if (convsUnsubscribe) return; // already listening
  loadConversationList();

  // New DM button
  document.getElementById('newDmBtn').onclick = openNewDmModal;
}

// ── Conversation list ─────────────────────────────────────────────
function loadConversationList() {
  if (convsUnsubscribe) convsUnsubscribe();

  convsUnsubscribe = db.collection('conversations')
    .where('participants', 'array-contains', currentUser.uid)
    .orderBy('updatedAt', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('dm-conv-list');
      list.innerHTML = '';

      // Update DM badge
      let unread = 0;

      snap.forEach(doc => {
        const conv = doc.data();
        const otherId   = conv.participants.find(p => p !== currentUser.uid);
        const otherName = conv.participantNames?.[otherId] || 'Unknown';
        const otherPhoto= conv.participantPhotos?.[otherId] || '';
        const lastMsg   = conv.lastMessage || '';
        const isUnread  = conv.unreadBy?.includes(currentUser.uid);
        if (isUnread) unread++;

        const item = document.createElement('div');
        item.className = 'dm-conv-item' +
          (doc.id === activeConvId ? ' active' : '') +
          (isUnread ? ' unread' : '');

        item.innerHTML = `
          <div class="dm-conv-avatar">
            ${otherPhoto
              ? `<img src="${escHtml(otherPhoto)}" />`
              : escHtml((otherName||'?')[0].toUpperCase())}
          </div>
          <div class="dm-conv-info">
            <div class="dm-conv-name">${escHtml(otherName)}</div>
            <div class="dm-conv-preview">${escHtml(lastMsg.slice(0,40))}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem">
            <span class="dm-conv-time">${conv.updatedAt?.toDate ? timeAgo(conv.updatedAt.toDate()) : ''}</span>
            ${isUnread ? '<span class="dm-unread-dot"></span>' : ''}
          </div>
        `;

        item.onclick = () => openConversation(doc.id, otherId, otherName, otherPhoto);
        list.appendChild(item);
      });

      // Update badge
      const badge = document.getElementById('dmBadge');
      badge.style.display = unread > 0 ? 'flex' : 'none';
      badge.textContent   = unread;
    }, err => {
      console.warn('DM conversations error:', err.message);
    });
}

// ── Open a conversation ───────────────────────────────────────────
function openConversation(convId, otherId, otherName, otherPhoto) {
  activeConvId = convId;

  // Mark as read
  db.collection('conversations').doc(convId).update({
    unreadBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
  }).catch(() => {});

  // Rebuild main pane
  const main = document.getElementById('dmMain');
  main.innerHTML = `
    <div class="dm-chat-header">
      <div class="dm-conv-avatar" style="width:36px;height:36px;font-size:0.9rem;border-radius:50%;overflow:hidden;background:var(--header);color:white;display:flex;align-items:center;justify-content:center">
        ${otherPhoto
          ? `<img src="${escHtml(otherPhoto)}" style="width:100%;height:100%;object-fit:cover"/>`
          : escHtml((otherName||'?')[0].toUpperCase())}
      </div>
      <span class="dm-chat-header-name">${escHtml(otherName)}</span>
    </div>
    <div class="dm-messages" id="dmMessages"></div>
    <div class="dm-input-row">
      <button class="dm-img-btn" id="dmImgBtn">📷</button>
      <input type="text" id="dmInput" placeholder="Message ${escHtml(otherName)}…" />
      <button class="dm-send-btn" id="dmSendBtn">➤</button>
    </div>
  `;

  document.getElementById('dmSendBtn').onclick = () => sendDm(convId, otherId);
  document.getElementById('dmInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendDm(convId, otherId);
  });
  document.getElementById('dmImgBtn').onclick = () => {
    const url = prompt('Paste image URL:');
    if (url) sendDm(convId, otherId, url, true);
  };

  // Subscribe to messages
  if (msgsUnsubscribe) msgsUnsubscribe();
  msgsUnsubscribe = db.collection('conversations').doc(convId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const container = document.getElementById('dmMessages');
      if (!container) return;
      container.innerHTML = '';

      snap.forEach((doc, i) => {
        const m    = doc.data();
        const mine = m.senderId === currentUser.uid;
        const isLast = i === snap.size - 1;

        const wrap = document.createElement('div');
        wrap.className = `dm-msg ${mine ? 'mine' : 'theirs'}`;

        const bubble = document.createElement('div');
        bubble.className = 'dm-msg-bubble';

        if (m.imageUrl) {
          bubble.innerHTML = `
            ${m.text ? escHtml(m.text) : ''}
            <img src="${escHtml(m.imageUrl)}" class="dm-msg-image"
              onerror="this.style.display='none'" />
          `;
        } else {
          bubble.textContent = m.text;
        }

        wrap.appendChild(bubble);

        const meta = document.createElement('div');
        meta.className = 'dm-msg-meta';
        meta.textContent = m.createdAt?.toDate ? timeAgo(m.createdAt.toDate()) : '';
        wrap.appendChild(meta);

        // Seen receipt on last sent message
        if (mine && isLast && m.seenBy?.includes(otherId)) {
          const seen = document.createElement('div');
          seen.className = 'dm-msg-seen';
          seen.textContent = 'Seen';
          wrap.appendChild(seen);
        }

        container.appendChild(wrap);
      });

      // Mark messages as seen by current user
      if (snap.size > 0) {
        const lastMsg = snap.docs[snap.size - 1];
        if (lastMsg.data().senderId !== currentUser.uid) {
          db.collection('conversations').doc(convId)
            .collection('messages').doc(lastMsg.id)
            .update({ seenBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) })
            .catch(() => {});
        }
      }

      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
    });

  // Highlight active conv in list
  document.querySelectorAll('.dm-conv-item').forEach(el => el.classList.remove('active'));
}

// ── Send DM ───────────────────────────────────────────────────────
async function sendDm(convId, otherId, imageUrl = null, isImage = false) {
  const input = document.getElementById('dmInput');
  const text  = input?.value.trim() || '';
  if (!text && !imageUrl) return;

  const payload = {
    text:     isImage ? '' : text,
    imageUrl: imageUrl || null,
    senderId: currentUser.uid,
    seenBy:   [currentUser.uid],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('conversations').doc(convId)
    .collection('messages').add(payload);

  // Update conversation metadata
  await db.collection('conversations').doc(convId).update({
    lastMessage: isImage ? '📷 Photo' : text,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    unreadBy:    firebase.firestore.FieldValue.arrayUnion(otherId)
  });

  if (input) input.value = '';

  // Send notification to recipient
  await sendNotification(otherId, 'dm', {
    convId,
    fromUid:   currentUser.uid,
    fromName:  currentUser.displayName || currentUser.email,
    fromPhoto: currentUser.photoURL || ''
  });
}

// ── Open DM with a specific user ──────────────────────────────────
// Called from notifications, profile page, etc.
async function openDmWithUser(uid, name, photo) {
  navigateTo('community');
  setCommTab('dms');
  initDms();

  // Check if conversation already exists
  const snap = await db.collection('conversations')
    .where('participants', 'array-contains', currentUser.uid)
    .get();

  let convId = null;
  snap.forEach(doc => {
    if (doc.data().participants.includes(uid)) convId = doc.id;
  });

  // Create if not exists
  if (!convId) {
    const ref = await db.collection('conversations').add({
      participants: [currentUser.uid, uid],
      participantNames: {
        [currentUser.uid]: currentUser.displayName || currentUser.email,
        [uid]: name
      },
      participantPhotos: {
        [currentUser.uid]: currentUser.photoURL || '',
        [uid]: photo
      },
      lastMessage: '',
      unreadBy:    [],
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
    convId = ref.id;
  }

  setTimeout(() => openConversation(convId, uid, name, photo), 300);
}

// ── New DM modal ──────────────────────────────────────────────────
function openNewDmModal() {
  const overlay = document.getElementById('new-dm-overlay');
  const input   = document.getElementById('newDmSearch');
  const results = document.getElementById('newDmResults');
  input.value   = '';
  results.innerHTML = '';
  overlay.classList.add('open');
  setTimeout(() => input.focus(), 200);

  input.oninput = debounce(async () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (q.length < 2) return;

    const snap = await db.collection('users').get();
    const matches = snap.docs
      .filter(d => d.id !== currentUser.uid &&
        ((d.data().displayName||'').toLowerCase().includes(q) ||
         (d.data().email||'').toLowerCase().includes(q)))
      .slice(0, 8);

    if (matches.length === 0) {
      results.innerHTML = '<p style="color:#888;font-size:0.88rem;text-align:center">No users found.</p>';
      return;
    }

    matches.forEach(doc => {
      const u    = doc.data();
      const item = document.createElement('div');
      item.className = 'search-user-item';
      item.innerHTML = `
        <div class="search-user-avatar">
          ${u.photoURL
            ? `<img src="${escHtml(u.photoURL)}" />`
            : escHtml((u.displayName||'?')[0].toUpperCase())}
        </div>
        <div>
          <div class="search-user-name">${escHtml(u.displayName||'Unknown')}</div>
          <div class="search-user-bio">${escHtml(u.email||'')}</div>
        </div>
      `;
      item.onclick = () => {
        overlay.classList.remove('open');
        openDmWithUser(doc.id, u.displayName || u.email, u.photoURL || '');
      };
      results.appendChild(item);
    });
  }, 300);
}

document.getElementById('newDmCloseBtn').onclick = () =>
  document.getElementById('new-dm-overlay').classList.remove('open');
document.getElementById('new-dm-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('new-dm-overlay'))
    document.getElementById('new-dm-overlay').classList.remove('open');
});
