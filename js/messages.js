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

  const isMobile = window.innerWidth <= 900;
  const avatarHtml = otherPhoto
    ? `<img src="${escHtml(otherPhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
    : escHtml((otherName||'?')[0].toUpperCase());

  const chatHtml = `
    <div class="dm-chat-header">
      ${isMobile ? `<button class="dm-back-btn" id="dmBackBtn">← Back</button>` : ''}
      <div class="dm-conv-avatar" style="width:36px;height:36px;font-size:0.9rem;border-radius:50%;overflow:hidden;background:var(--header);color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${avatarHtml}
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

  if (isMobile) {
    // On mobile: show full-screen chat, hide the sidebar
    const dmLayout = document.querySelector('.dm-layout');
    const sidebar  = document.querySelector('.dm-sidebar');
    const main     = document.getElementById('dmMain');
    if (sidebar) sidebar.style.display = 'none';
    main.innerHTML = chatHtml;
    main.style.display = 'flex';
    main.style.flexDirection = 'column';
    main.style.height = '100%';
    // Back button returns to conversation list
    document.getElementById('dmBackBtn').onclick = () => {
      if (msgsUnsubscribe) { msgsUnsubscribe(); msgsUnsubscribe = null; }
      sidebar.style.display = 'flex';
      sidebar.style.flexDirection = 'column';
      main.innerHTML = '';
      main.style.display = '';
      activeConvId = null;
    };
  } else {
    // Desktop: show chat in right pane as normal
    const main = document.getElementById('dmMain');
    main.innerHTML = chatHtml;
  }

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
    .onSnapshot(rawSnap => {
      const container = document.getElementById('dmMessages');
      if (!container) return;
      container.innerHTML = '';

      // Sort client-side — avoids needing a composite index
      const sortedDocs = rawSnap.docs.slice().sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() || 0;
        const tb = b.data().createdAt?.toMillis?.() || 0;
        return ta - tb;
      });

      // Mark last incoming message as seen
      if (sortedDocs.length > 0) {
        const lastDoc = sortedDocs[sortedDocs.length - 1];
        if (lastDoc.data().senderId !== currentUser.uid) {
          db.collection('conversations').doc(convId)
            .collection('messages').doc(lastDoc.id)
            .update({ seenBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) })
            .catch(() => {});
        }
      }

      sortedDocs.forEach((doc, i) => {
        const m      = doc.data();
        const mine   = m.senderId === currentUser.uid;
        const isLast = i === sortedDocs.length - 1;

        const wrap = document.createElement('div');
        wrap.className = `dm-msg ${mine ? 'mine' : 'theirs'}`;

        // Bubble
        const bubble = document.createElement('div');
        bubble.className = 'dm-msg-bubble';
        if (m.imageUrl) {
          bubble.innerHTML = `
            ${m.text ? `<span>${escHtml(m.text)}</span><br>` : ''}
            <img src="${escHtml(m.imageUrl)}" class="dm-msg-image" onerror="this.style.display='none'" />
          `;
        } else {
          bubble.textContent = m.text;
        }
        wrap.appendChild(bubble);

        // Reactions display
        const reactions = m.reactions || {};
        const reactEmojis = Object.keys(reactions).filter(e => (reactions[e]||[]).length > 0);
        if (reactEmojis.length > 0) {
          const reactRow = document.createElement('div');
          reactRow.className = 'dm-reactions';
          reactEmojis.forEach(emoji => {
            const users = reactions[emoji] || [];
            const pill = document.createElement('button');
            pill.className = 'dm-reaction-pill' + (users.includes(currentUser.uid) ? ' reacted' : '');
            pill.textContent = emoji + ' ' + users.length;
            pill.onclick = () => toggleReaction(convId, doc.id, emoji, users.includes(currentUser.uid));
            reactRow.appendChild(pill);
          });
          wrap.appendChild(reactRow);
        }

        // Hover react button
        const reactBtn = document.createElement('button');
        reactBtn.className = 'dm-react-btn';
        reactBtn.textContent = '😊';
        reactBtn.onclick = e => { e.stopPropagation(); openReactionPicker(convId, doc.id, wrap); };
        wrap.appendChild(reactBtn);

        // Time + read receipt
        const meta = document.createElement('div');
        meta.className = 'dm-msg-meta';
        const timeStr = m.createdAt?.toDate ? timeAgo(m.createdAt.toDate()) : '';
        const seenStr = (mine && isLast && (m.seenBy||[]).includes(otherId)) ? ' · Seen ✓' : '';
        meta.textContent = timeStr + seenStr;
        wrap.appendChild(meta);

        container.appendChild(wrap);
      });

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

// ── Reactions ─────────────────────────────────────────────────────
const REACTION_EMOJIS = ['❤️','😂','😮','😢','👍','👎','🌱','🔥'];

function openReactionPicker(convId, msgId, wrapEl) {
  // Remove any existing picker
  document.querySelectorAll('.reaction-picker-popup').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'reaction-picker-popup';
  REACTION_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'reaction-pick-btn';
    btn.textContent = emoji;
    btn.onclick = () => {
      toggleReaction(convId, msgId, emoji, false);
      picker.remove();
    };
    picker.appendChild(btn);
  });

  wrapEl.style.position = 'relative';
  wrapEl.appendChild(picker);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 50);
}

async function toggleReaction(convId, msgId, emoji, alreadyReacted) {
  const ref = db.collection('conversations').doc(convId)
    .collection('messages').doc(msgId);
  const field = `reactions.${emoji}`;
  if (alreadyReacted) {
    await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
  } else {
    await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
  }
}
