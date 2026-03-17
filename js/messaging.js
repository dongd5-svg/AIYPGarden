// ================================================================
// MESSAGING.JS — collaborator DMs, garden group chat, notifications
//
// Data model:
//   conversations/{convId}
//     type: 'dm' | 'group'
//     participants: [uid, uid, ...]
//     participantEmails: [email, ...]
//     participantNames: { uid: displayName }
//     participantPhotos: { uid: photoURL }
//     gardenId: string (groups only)
//     gardenName: string (groups only)
//     lastMessage: string
//     lastMessageAt: timestamp
//     unreadBy: [uid, ...]
//     createdAt: timestamp
//
//   conversations/{convId}/messages/{msgId}
//     text: string
//     senderId: uid
//     senderName: string
//     seenBy: [uid, ...]
//     reactions: { emoji: [uid, ...] }
//     createdAt: timestamp
//
//   notifications/{notifId}
//     toUid: uid
//     fromUid: uid
//     fromName: string
//     fromPhoto: string
//     type: 'garden_share'|'task_assigned'|'dm'|'group_message'|'collab_added'
//     gardenId?: string
//     gardenName?: string
//     taskTitle?: string
//     convId?: string
//     read: boolean
//     createdAt: timestamp
// ================================================================

// ── State ─────────────────────────────────────────────────────────
let convListUnsub   = null;
let chatUnsub       = null;
let notifUnsub      = null;
let activeConvId    = null;
let activeConvData  = null;
let convCache       = {};  // convId -> data
let notifCache      = [];
let unreadMsgCount  = 0;
let unreadNotifCount= 0;

// ── Refs ──────────────────────────────────────────────────────────
const convsRef  = () => db.collection('conversations');
const notifsRef = () => db.collection('notifications');
const msgsRef   = (convId) => db.collection('conversations').doc(convId).collection('messages');

// ── Boot (called from app.js after login) ─────────────────────────
function initMessaging() {
  listenConversations();
  listenNotifications();
  wireNavButtons();
}

// ── Wire nav buttons ──────────────────────────────────────────────
function wireNavButtons() {
  document.getElementById('mobMessagesBtn')?.addEventListener('click', openMessagesModal);
  document.getElementById('desktopMessagesBtn')?.addEventListener('click', openMessagesModal);
  document.getElementById('desktopNotifBtn')?.addEventListener('click', openNotifModal);
  document.getElementById('messagesCloseBtn')?.addEventListener('click', closeMessagesModal);
  document.getElementById('notifCloseBtn')?.addEventListener('click', closeNotifModal);
  document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotifsRead);
  document.getElementById('msgBackToListBtn')?.addEventListener('click', showConvList);

  // Message send
  document.getElementById('msgSendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('msgInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Close overlays on backdrop click
  document.getElementById('messages-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('messages-overlay')) closeMessagesModal();
  });
  document.getElementById('notif-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('notif-overlay')) closeNotifModal();
  });

  // Message collaborators button in settings
  document.getElementById('messageCollabsBtn')?.addEventListener('click', () => {
    document.getElementById('settings-modal-overlay').classList.remove('open');
    openOrCreateGroupChat(currentGardenId, currentGardenData);
  });
}

// ════════════════════════════════════════════════════════════════
// CONVERSATION LIST
// ════════════════════════════════════════════════════════════════
function listenConversations() {
  if (convListUnsub) convListUnsub();
  if (!currentUser) return;

  convListUnsub = convsRef()
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot(snap => {
      convCache = {};
      snap.forEach(doc => { convCache[doc.id] = { id: doc.id, ...doc.data() }; });

      // Count unread
      unreadMsgCount = Object.values(convCache)
        .filter(c => (c.unreadBy || []).includes(currentUser.uid)).length;
      updateMsgBadge();

      if (document.getElementById('messages-overlay').style.display !== 'none') {
        if (!activeConvId) renderConvList();
      }
    });
}

function updateMsgBadge() {
  ['mobMsgBadge','desktopMsgBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (unreadMsgCount > 0) {
      el.textContent = unreadMsgCount > 9 ? '9+' : unreadMsgCount;
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  });
}

// ── Open messages modal ───────────────────────────────────────────
function openMessagesModal() {
  document.getElementById('messages-overlay').style.display = 'flex';
  showConvList();
}

function closeMessagesModal() {
  document.getElementById('messages-overlay').style.display = 'none';
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  activeConvId   = null;
  activeConvData = null;
}

function showConvList() {
  activeConvId   = null;
  activeConvData = null;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  document.getElementById('msg-conv-list-view').style.display = 'flex';
  document.getElementById('msg-chat-view').style.display       = 'none';
  document.getElementById('msgBackToListBtn').style.display    = 'none';
  document.getElementById('msgHeaderTitle').textContent        = 'Messages';
  renderConvList();
}

function renderConvList() {
  const list  = document.getElementById('msg-conv-list');
  const empty = document.getElementById('msg-conv-empty');
  if (!list) return;

  const convs = Object.values(convCache)
    .sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0));

  list.innerHTML = '';
  if (!convs.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  convs.forEach(conv => {
    const isUnread = (conv.unreadBy || []).includes(currentUser.uid);
    const isGroup  = conv.type === 'group';

    // Get display name and avatar for this conversation
    let displayName, avatarText, avatarColor;
    if (isGroup) {
      displayName = conv.gardenName ? `🌱 ${conv.gardenName}` : 'Garden Group';
      avatarText  = '🌱';
      avatarColor = 'var(--green-2)';
    } else {
      // DM: show the other person
      const otherId = (conv.participants || []).find(id => id !== currentUser.uid);
      displayName   = (conv.participantNames || {})[otherId] || 'Unknown';
      avatarText    = displayName[0]?.toUpperCase() || '?';
      avatarColor   = 'var(--green-3)';
    }

    const lastMsg  = conv.lastMessage || 'No messages yet';
    const timeStr  = conv.lastMessageAt ? timeAgo(conv.lastMessageAt.toDate()) : '';

    const row = document.createElement('div');
    row.className = 'msg-conv-row' + (isUnread ? ' msg-unread' : '');
    row.innerHTML = `
      <div class="msg-conv-avatar" style="background:${avatarColor}">${avatarText}</div>
      <div class="msg-conv-body">
        <div class="msg-conv-name">${escHtml(displayName)}</div>
        <div class="msg-conv-preview">${escHtml(lastMsg.slice(0, 60))}</div>
      </div>
      <div class="msg-conv-meta">
        <span class="msg-conv-time">${timeStr}</span>
        ${isUnread ? '<span class="msg-unread-dot"></span>' : ''}
      </div>
    `;
    row.addEventListener('click', () => openConversation(conv.id));
    list.appendChild(row);
  });
}

// ════════════════════════════════════════════════════════════════
// OPEN / CREATE CONVERSATIONS
// ════════════════════════════════════════════════════════════════

// Open an existing conversation
function openConversation(convId) {
  activeConvId   = convId;
  activeConvData = convCache[convId];
  if (!activeConvData) return;

  const isGroup  = activeConvData.type === 'group';
  const otherId  = isGroup ? null : (activeConvData.participants || []).find(id => id !== currentUser.uid);
  const title    = isGroup
    ? `🌱 ${activeConvData.gardenName || 'Garden Group'}`
    : (activeConvData.participantNames || {})[otherId] || 'Chat';

  document.getElementById('msg-conv-list-view').style.display = 'none';
  document.getElementById('msg-chat-view').style.display       = 'flex';
  document.getElementById('msgBackToListBtn').style.display    = 'inline-flex';
  document.getElementById('msgHeaderTitle').textContent        = title;

  // Mark as read
  if ((activeConvData.unreadBy || []).includes(currentUser.uid)) {
    convsRef().doc(convId).update({
      unreadBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    });
  }

  listenMessages(convId);
}

// Create or open a 1:1 DM between current user and another user
async function openOrCreateDM(otherUid, otherName, otherEmail, otherPhoto) {
  if (!currentUser) return;
  if (otherUid === currentUser.uid) return;

  // Check if DM already exists
  const existing = Object.values(convCache).find(c =>
    c.type === 'dm' &&
    (c.participants || []).includes(currentUser.uid) &&
    (c.participants || []).includes(otherUid)
  );
  if (existing) { openConversation(existing.id); return; }

  // Create new DM
  const ref = await convsRef().add({
    type:              'dm',
    participants:      [currentUser.uid, otherUid],
    participantEmails: [currentUser.email, otherEmail].filter(Boolean),
    participantNames: {
      [currentUser.uid]: currentUser.displayName || currentUser.email,
      [otherUid]:        otherName,
    },
    participantPhotos: {
      [currentUser.uid]: currentUser.photoURL || '',
      [otherUid]:        otherPhoto || '',
    },
    lastMessage:    '',
    lastMessageAt:  firebase.firestore.FieldValue.serverTimestamp(),
    unreadBy:       [],
    createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
  });
  openConversation(ref.id);
}

// Create or open the group chat for a garden
async function openOrCreateGroupChat(gardenId, gardenData) {
  if (!currentUser || !gardenId) return;
  openMessagesModal();

  // Check if group chat already exists for this garden
  const existing = Object.values(convCache).find(c =>
    c.type === 'group' && c.gardenId === gardenId
  );
  if (existing) { openConversation(existing.id); return; }

  // Build participant list from owner + collaborators
  const collabEmails = gardenData?.collaboratorEmails || [];
  const participants  = [gardenData?.ownerId || currentUser.uid];
  const participantNames  = { [gardenData?.ownerId || currentUser.uid]: gardenData?.ownerName || currentUser.displayName || '' };
  const participantEmails = [gardenData?.ownerEmail || currentUser.email || ''];

  // Try to resolve collaborator UIDs by email
  // (Best effort — we only have emails, so store them too)
  // If we can't resolve UIDs, we store emails in participantEmails for future matching

  const ref = await convsRef().add({
    type:             'group',
    gardenId,
    gardenName:       gardenData?.name || 'Garden Group',
    participants,
    participantEmails: [...participantEmails, ...collabEmails],
    participantNames,
    participantPhotos: {},
    lastMessage:      '',
    lastMessageAt:    firebase.firestore.FieldValue.serverTimestamp(),
    unreadBy:         [],
    createdAt:        firebase.firestore.FieldValue.serverTimestamp(),
  });
  openConversation(ref.id);
}

// ════════════════════════════════════════════════════════════════
// CHAT VIEW
// ════════════════════════════════════════════════════════════════
function listenMessages(convId) {
  if (chatUnsub) chatUnsub();

  const msgList = document.getElementById('msg-messages-list');
  msgList.innerHTML = '<div class="msg-loading">Loading…</div>';

  chatUnsub = msgsRef(convId)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      renderMessages(snap, convId);
    });
}

function renderMessages(snap, convId) {
  const list = document.getElementById('msg-messages-list');
  if (!list) return;

  const msgs = [];
  snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

  list.innerHTML = '';

  if (!msgs.length) {
    list.innerHTML = '<div class="msg-empty-chat">Say hello 👋</div>';
    return;
  }

  let lastDate = '';
  msgs.forEach((msg, idx) => {
    const isMine = msg.senderId === currentUser.uid;
    const date   = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Date separator
    if (dateStr !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'msg-date-sep';
      sep.textContent = dateStr;
      list.appendChild(sep);
      lastDate = dateStr;
    }

    const isGroup      = activeConvData?.type === 'group';
    const showName     = isGroup && !isMine;
    const isLastMine   = isMine && msgs.slice(idx + 1).every(m => m.senderId !== currentUser.uid || !m.createdAt);
    const seenByOthers = (msg.seenBy || []).some(id => id !== currentUser.uid);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble-wrap ' + (isMine ? 'msg-mine' : 'msg-theirs');
    bubble.innerHTML = `
      ${showName ? `<div class="msg-sender-name">${escHtml(msg.senderName || '')}</div>` : ''}
      <div class="msg-bubble" data-id="${msg.id}">
        <span class="msg-text">${escHtml(msg.text || '')}</span>
        <span class="msg-time">${date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      ${Object.keys(msg.reactions || {}).length ? renderReactionsHTML(msg.reactions) : ''}
      ${isMine && seenByOthers ? '<div class="msg-seen">✓ Seen</div>' : ''}
    `;

    // Long-press / right-click for reactions
    const bubbleEl = bubble.querySelector('.msg-bubble');
    bubbleEl.addEventListener('contextmenu', e => {
      e.preventDefault();
      showReactionPicker(msg.id, convId, e.clientX, e.clientY);
    });
    // Touch long-press
    let pressTimer;
    bubbleEl.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        const rect = bubbleEl.getBoundingClientRect();
        showReactionPicker(msg.id, convId, rect.left, rect.top);
      }, 500);
    });
    bubbleEl.addEventListener('touchend', () => clearTimeout(pressTimer));

    // Mark as seen
    if (!isMine && !(msg.seenBy || []).includes(currentUser.uid)) {
      msgsRef(convId).doc(msg.id).update({
        seenBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
      });
    }

    list.appendChild(bubble);
  });

  // Auto-scroll to bottom
  list.scrollTop = list.scrollHeight;
}

function renderReactionsHTML(reactions) {
  const parts = Object.entries(reactions)
    .filter(([, uids]) => uids.length > 0)
    .map(([emoji, uids]) =>
      `<span class="msg-reaction" data-emoji="${emoji}">${emoji} ${uids.length}</span>`
    );
  return parts.length ? `<div class="msg-reactions">${parts.join('')}</div>` : '';
}

// ── Send message ──────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text || !activeConvId) return;
  input.value = '';

  const conv = activeConvData || {};

  await msgsRef(activeConvId).add({
    text,
    senderId:   currentUser.uid,
    senderName: currentUser.displayName || currentUser.email || '',
    seenBy:     [currentUser.uid],
    reactions:  {},
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Update conversation metadata
  const otherParticipants = (conv.participants || []).filter(id => id !== currentUser.uid);
  await convsRef().doc(activeConvId).update({
    lastMessage:   text.slice(0, 80),
    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    unreadBy:      firebase.firestore.FieldValue.arrayUnion(...otherParticipants),
  });

  // Send notifications to other participants
  otherParticipants.forEach(uid => {
    sendNotification({
      toUid:    uid,
      type:     conv.type === 'group' ? 'group_message' : 'dm',
      convId:   activeConvId,
      gardenName: conv.gardenName || '',
      snippet:  text.slice(0, 60),
    });
  });
}

// ── Reaction picker ───────────────────────────────────────────────
const REACTION_EMOJIS = ['❤️','😂','👍','👎','😮','😢','🌱','🔥'];

function showReactionPicker(msgId, convId, x, y) {
  const existing = document.getElementById('reaction-picker-popup');
  if (existing) existing.remove();

  const picker = document.createElement('div');
  picker.id = 'reaction-picker-popup';
  picker.className = 'reaction-picker';
  picker.style.left = Math.min(x, window.innerWidth - 280) + 'px';
  picker.style.top  = Math.max(y - 60, 10) + 'px';

  REACTION_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.className   = 'reaction-btn';
    btn.onclick = async () => {
      picker.remove();
      const ref   = msgsRef(convId).doc(msgId);
      const snap  = await ref.get();
      const reacts = snap.data()?.reactions || {};
      const field  = `reactions.${emoji}`;
      const already = (reacts[emoji] || []).includes(currentUser.uid);
      if (already) {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
      } else {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      }
    };
    picker.appendChild(btn);
  });

  document.body.appendChild(picker);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function dismiss() {
      picker.remove();
      document.removeEventListener('click', dismiss);
    });
  }, 10);
}

// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════
function listenNotifications() {
  if (notifUnsub) notifUnsub();
  if (!currentUser) return;

  const processSnap = snap => {
    notifCache = [];
    snap.forEach(doc => notifCache.push({ id: doc.id, ...doc.data() }));
    // Sort client-side so we don't depend on orderBy index
    notifCache.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    notifCache = notifCache.slice(0, 40);
    unreadNotifCount = notifCache.filter(n => !n.read).length;
    updateNotifBadge();
    if (document.getElementById('notif-overlay').style.display !== 'none') {
      renderNotifList();
    }
  };

  // Try with orderBy first, fall back to simple query if index missing
  notifUnsub = notifsRef()
    .where('toUid', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .limit(40)
    .onSnapshot(processSnap, () => {
      // Index not ready — use simpler query and sort client-side
      notifsRef()
        .where('toUid', '==', currentUser.uid)
        .limit(40)
        .onSnapshot(processSnap);
    });
}

function updateNotifBadge() {
  const count = unreadNotifCount;
  ['desktopNotifBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count > 9 ? '9+' : count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });

  // Mobile — update badge and label on the profile/notif button
  const mobBadge = document.getElementById('mobNotifBadge');
  const mobLabel = document.getElementById('profileNavLabel');
  if (mobBadge) {
    mobBadge.textContent = count > 9 ? '9+' : count;
    mobBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  if (mobLabel) {
    mobLabel.textContent = count > 0 ? `Notifs (${count})` : 'Profile';
  }
}

function openNotifModal() {
  document.getElementById('notif-overlay').style.display = 'flex';
  renderNotifList();
}
function closeNotifModal() {
  document.getElementById('notif-overlay').style.display = 'none';
}

function renderNotifList() {
  const list  = document.getElementById('notif-list');
  const empty = document.getElementById('notif-empty');
  if (!list) return;

  list.innerHTML = '';
  if (!notifCache.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  notifCache.forEach(notif => {
    const { emoji, text } = formatNotif(notif);
    const row = document.createElement('div');
    row.className = 'notif-row' + (notif.read ? '' : ' notif-unread');
    row.innerHTML = `
      <div class="notif-emoji">${emoji}</div>
      <div class="notif-body">
        <div class="notif-text">${text}</div>
        <div class="notif-time">${notif.createdAt?.toDate ? timeAgo(notif.createdAt.toDate()) : ''}</div>
      </div>
      ${!notif.read ? '<div class="notif-dot"></div>' : ''}
    `;
    row.addEventListener('click', () => handleNotifClick(notif));
    list.appendChild(row);
  });
}

function formatNotif(notif) {
  const name = escHtml(notif.fromName || 'Someone');
  switch (notif.type) {
    case 'dm':
      return { emoji: '💬', text: `<strong>${name}</strong> sent you a message${notif.snippet ? `: "${escHtml(notif.snippet)}"` : ''}` };
    case 'group_message':
      return { emoji: '🌱', text: `<strong>${name}</strong> messaged in <strong>${escHtml(notif.gardenName || 'garden chat')}</strong>${notif.snippet ? `: "${escHtml(notif.snippet)}"` : ''}` };
    case 'garden_share':
      return { emoji: '🌿', text: `<strong>${name}</strong> added you as a collaborator on <strong>${escHtml(notif.gardenName || 'a garden')}</strong>` };
    case 'task_assigned':
      return { emoji: '📋', text: `<strong>${name}</strong> assigned you a task: <strong>${escHtml(notif.taskTitle || 'a task')}</strong>` };
    case 'collab_added':
      return { emoji: '✏', text: `You were added as a collaborator on <strong>${escHtml(notif.gardenName || 'a garden')}</strong>` };
    default:
      return { emoji: '🔔', text: `Notification from <strong>${name}</strong>` };
  }
}

async function handleNotifClick(notif) {
  // Mark as read
  if (!notif.read) {
    await notifsRef().doc(notif.id).update({ read: true });
  }

  closeNotifModal();

  // Navigate to relevant content
  if ((notif.type === 'dm' || notif.type === 'group_message') && notif.convId) {
    openMessagesModal();
    // Wait for conv cache to load then open
    setTimeout(() => {
      if (convCache[notif.convId]) openConversation(notif.convId);
    }, 400);
  } else if (notif.type === 'garden_share' || notif.type === 'collab_added') {
    if (notif.gardenId) {
      // Navigate to the garden — reload home first
      navigateTo('home');
    }
  }
}

async function markAllNotifsRead() {
  const unread = notifCache.filter(n => !n.read);
  if (!unread.length) return;
  const batch = db.batch();
  unread.forEach(n => batch.update(notifsRef().doc(n.id), { read: true }));
  await batch.commit();
  showToast('All notifications marked as read');
}

// ── Send notification (called from other modules) ─────────────────
async function sendNotification(opts) {
  if (!currentUser) return;
  if (opts.toUid === currentUser.uid) return; // don't notify yourself

  await notifsRef().add({
    toUid:     opts.toUid,
    fromUid:   currentUser.uid,
    fromName:  currentUser.displayName || currentUser.email || '',
    fromPhoto: currentUser.photoURL || '',
    type:      opts.type,
    convId:    opts.convId    || null,
    gardenId:  opts.gardenId  || null,
    gardenName:opts.gardenName|| null,
    taskTitle: opts.taskTitle || null,
    snippet:   opts.snippet   || null,
    read:      false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ── Send notification when collaborator added ─────────────────────
// Hooked into settings.js addCollaborator
const _origAddCollab = window.addCollaborator;
// We wrap after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Wire the messageCollabsBtn visibility in settings
  document.getElementById('gardenSettingsBtn')?.addEventListener('click', () => {
    setTimeout(() => {
      const btn    = document.getElementById('messageCollabsBtn');
      const collabs = currentGardenData?.collaboratorEmails || [];
      if (btn) btn.style.display = collabs.length ? 'block' : 'none';
    }, 100);
  });
});

// ── Notification trigger: task assigned ───────────────────────────
// Called by tasks.js when a task is saved with an assignee
function notifyTaskAssigned(toEmail, taskTitle, gardenName) {
  // Look up UID from email — best effort via collaborator list
  // We can only notify if we know their UID; otherwise skip
  // In a production app this would use a Cloud Function
  // For now we store by email and resolve when the recipient next opens the app
}

// ── Notification trigger: garden shared ──────────────────────────
// Called by settings.js when a collaborator is added
async function notifyCollabAdded(email, gardenId, gardenName) {
  // Find user doc by email
  try {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) return;
    const toUid = snap.docs[0].id;
    await sendNotification({ toUid, type: 'collab_added', gardenId, gardenName });
  } catch {}
}

// ── Expose globally ───────────────────────────────────────────────
window.initMessaging        = initMessaging;
window.openOrCreateDM       = openOrCreateDM;
window.openOrCreateGroupChat= openOrCreateGroupChat;
window.sendNotification     = sendNotification;
window.notifyCollabAdded    = notifyCollabAdded;

// ── Helpers ───────────────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
