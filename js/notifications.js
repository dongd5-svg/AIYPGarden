// ================================================================
// NOTIFICATIONS.JS — in-app notifications
// Triggers: new follower, post like, post comment, garden share,
//           task assignment, DM received
// ================================================================

let notifsUnsubscribe = null;
let unreadCount       = 0;

// ── Init ──────────────────────────────────────────────────────────
function initNotifications() {
  if (notifsUnsubscribe) notifsUnsubscribe();

  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');

  // Toggle dropdown
  notifBtn.onclick = e => {
    e.stopPropagation();
    const open = notifDropdown.style.display !== 'none';
    notifDropdown.style.display = open ? 'none' : 'block';
    if (!open) markNotifsAsSeen();
  };

  // Close on outside click
  document.addEventListener('click', e => {
    if (!document.getElementById('notifWrap').contains(e.target))
      notifDropdown.style.display = 'none';
  });

  // Mark all read button
  document.getElementById('markAllReadBtn').onclick = async () => {
    await markAllNotifsRead();
    notifDropdown.style.display = 'none';
  };

  // Subscribe to notifications for current user
  notifsUnsubscribe = db.collection('notifications')
    .where('toUid', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(snap => {
      unreadCount = 0;
      snap.forEach(doc => { if (!doc.data().read) unreadCount++; });
      updateNotifBadge();
      renderNotifList(snap);
    }, err => {
      console.warn('Notifications error:', err.message);
    });
}

// ── Badge ─────────────────────────────────────────────────────────
function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (unreadCount > 0) {
    badge.style.display = 'flex';
    badge.textContent   = unreadCount > 99 ? '99+' : unreadCount;
  } else {
    badge.style.display = 'none';
  }
}

// ── Render list ───────────────────────────────────────────────────
function renderNotifList(snap) {
  const list = document.getElementById('notifList');
  list.innerHTML = '';

  if (snap.empty) {
    list.innerHTML = '<p class="notif-empty">No notifications yet</p>';
    return;
  }

  snap.forEach(doc => {
    const n    = doc.data();
    const item = document.createElement('div');
    item.className = 'notif-item' + (n.read ? '' : ' unread');

    item.innerHTML = `
      <div class="notif-item-text">${escHtml(getNotifText(n))}</div>
      <div class="notif-item-time">${n.createdAt?.toDate ? timeAgo(n.createdAt.toDate()) : ''}</div>
    `;

    item.onclick = async () => {
      // Mark as read
      await db.collection('notifications').doc(doc.id).update({ read: true });
      // Navigate to relevant content
      handleNotifClick(n);
      document.getElementById('notifDropdown').style.display = 'none';
    };

    list.appendChild(item);
  });
}

function getNotifText(n) {
  const from = n.fromName || 'Someone';
  switch (n.type) {
    case 'follow':        return `${from} started following you`;
    case 'post_like':     return `${from} liked your post`;
    case 'post_comment':  return `${from} commented on your post`;
    case 'garden_share':  return `${from} shared a garden with you: "${n.gardenName || ''}"`;
    case 'task_assigned': return `${from} assigned you a task: "${n.taskTitle || ''}"`;
    case 'dm':            return `${from} sent you a message`;
    case 'comment_like':  return `${from} liked your comment`;
    default:              return n.text || 'New notification';
  }
}

function handleNotifClick(n) {
  switch (n.type) {
    case 'follow':
    case 'post_like':
    case 'post_comment':
      navigateTo('community');
      break;
    case 'garden_share':
      navigateTo('home');
      break;
    case 'task_assigned':
      if (n.gardenId) {
        db.collection('gardens').doc(n.gardenId).get().then(doc => {
          if (doc.exists) {
            const isOwn = doc.data().ownerId === currentUser.uid;
            openGardenPage(doc.id, doc.data(), isOwn);
            setTimeout(() => openTasksView(), 500);
          }
        });
      }
      break;
    case 'dm':
      navigateTo('community');
      switchCommTab('dms');
      if (n.fromUid) openDmWithUser(n.fromUid, n.fromName, n.fromPhoto || '');
      break;
  }
}

// ── Mark seen / read ──────────────────────────────────────────────
async function markNotifsAsSeen() {
  // Just update badge — actual read happens on click
  unreadCount = 0;
  updateNotifBadge();
}

async function markAllNotifsRead() {
  const snap = await db.collection('notifications')
    .where('toUid', '==', currentUser.uid)
    .where('read', '==', false)
    .get();

  const batch = db.batch();
  snap.forEach(doc => batch.update(doc.ref, { read: true }));
  await batch.commit();
}

// ── Send notification (called by other modules) ───────────────────
async function sendNotification(toUid, type, extra = {}) {
  if (!toUid || toUid === currentUser.uid) return; // Don't notify yourself

  await db.collection('notifications').add({
    toUid,
    fromUid:   currentUser.uid,
    fromName:  currentUser.displayName || currentUser.email,
    fromPhoto: currentUser.photoURL || '',
    type,
    read:      false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...extra
  });
}
