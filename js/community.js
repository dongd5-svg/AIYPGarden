// ================================================================
// COMMUNITY.JS — feed, posts, comments, likes, bottom nav
// ================================================================

let feedTab          = 'foryou';   // foryou | following
let pendingImageUrl  = '';
let pendingImageUrl2 = '';
let pendingTaggedGardens  = [];
let pendingTaggedGardens2 = [];
let feedUnsubscribe  = null;
let activeFeedCompose = 1; // which compose box is active (1=feed, 2=post tab)

// ── Community init ────────────────────────────────────────────────
function initCommunity() {
  setCommTab('feed');
  loadFeed();
  loadDiscover();
  // Set compose avatars
  setComposeAvatar('composeAvatar2');
}

function setComposeAvatar(id) {
  const el = document.getElementById(id);
  if (!el || !currentUser) return;
  if (currentUser.photoURL) {
    el.style.backgroundImage = `url(${currentUser.photoURL})`;
    el.style.backgroundSize  = 'cover';
    el.textContent = '';
  } else {
    el.textContent = (currentUser.displayName || currentUser.email || '?')[0].toUpperCase();
  }
}

// ── Community bottom nav ──────────────────────────────────────────
document.querySelectorAll('.comm-nav-btn').forEach(btn => {
  btn.onclick = () => setCommTab(btn.dataset.comm);
});

function setCommTab(tab) {
  document.querySelectorAll('.comm-nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.comm === tab));
  document.querySelectorAll('.comm-tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `comm-${tab}`));
  currentCommTab = tab;

  if (tab === 'feed')    loadFeed();
  if (tab === 'search')  initSearch();
  if (tab === 'profile') renderOwnProfile();
  if (tab === 'dms')     initDms();
  // scroll content back to top on tab switch
  const content = document.getElementById('comm-content');
  if (content) content.scrollTop = 0;
}

// ── Feed tab buttons ──────────────────────────────────────────────
document.querySelectorAll('.feed-tab-btn').forEach(btn => {
  btn.onclick = () => {
    feedTab = btn.dataset.feed;
    document.querySelectorAll('.feed-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.feed === feedTab));
    loadFeed();
  };
});

// ── Load feed ─────────────────────────────────────────────────────
function loadFeed() {
  if (feedUnsubscribe) { feedUnsubscribe(); feedUnsubscribe = null; }
  // Clean up any open comment listeners
  Object.values(commentListeners).forEach(unsub => unsub());
  Object.keys(commentListeners).forEach(k => delete commentListeners[k]);
  const feedEl  = document.getElementById('community-feed');
  const emptyEl = document.getElementById('feed-empty');
  feedEl.innerHTML = '';

  let query = db.collection('posts').orderBy('createdAt', 'desc').limit(60);

  feedUnsubscribe = query.onSnapshot(snap => {
    feedEl.innerHTML = '';
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter for Following tab
    if (feedTab === 'following') {
      db.collection('users').doc(currentUser.uid).get().then(userDoc => {
        const following = userDoc.data()?.following || [];
        docs = docs.filter(p => following.includes(p.authorId) || p.authorId === currentUser.uid);
        if (docs.length === 0) { emptyEl.style.display = 'block'; return; }
        emptyEl.style.display = 'none';
        docs.forEach(post => feedEl.appendChild(buildPostCard(post)));
      });
      return;
    }

    if (docs.length === 0) { emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';
    docs.forEach(post => feedEl.appendChild(buildPostCard(post)));
  });
}

// ── Build post card ───────────────────────────────────────────────
function buildPostCard(post) {
  const card    = document.createElement('div');
  card.className = 'post-card';
  card.dataset.type = post.postType || 'general';

  const isOwn     = currentUser && post.authorId === currentUser.uid;
  const liked     = (post.likes || []).includes(currentUser?.uid);
  const likeCount = (post.likes || []).length;
  const initials  = (post.authorName || '?')[0].toUpperCase();

  const avatarHtml = post.authorPhoto
    ? `<img src="${escHtml(post.authorPhoto)}" class="post-avatar-img" />`
    : `<div class="post-avatar-initials">${initials}</div>`;

  const imgHtml = post.imageUrl
    ? `<img src="${escHtml(post.imageUrl)}" class="post-image"
         onerror="this.style.display='none'" />`
    : '';

  const tagsHtml = (post.taggedGardens || []).length
    ? `<div class="post-tags">${post.taggedGardens.map(g =>
        `<span class="post-tag-chip" data-id="${escHtml(g.id)}">🌿 ${escHtml(g.name)}</span>`
      ).join('')}</div>` : '';

  const typeBadge = post.postType && post.postType !== 'general'
    ? `<span class="post-type-badge">${POST_TYPES[post.postType]?.label || ''}</span>` : '';

  card.innerHTML = `
    <div class="post-header">
      <div class="post-avatar" data-uid="${escHtml(post.authorId)}">${avatarHtml}</div>
      <div class="post-meta">
        <span class="post-author" data-uid="${escHtml(post.authorId)}">${escHtml(post.authorName||'Unknown')}</span>
        <span class="post-time">${post.createdAt?.toDate ? timeAgo(post.createdAt.toDate()) : 'just now'}</span>
      </div>
      ${typeBadge}
      ${isOwn ? `<button class="post-delete-btn" data-id="${post.id}">🗑</button>` : ''}
    </div>
    ${post.text ? `<p class="post-text">${escHtml(post.text)}</p>` : ''}
    ${imgHtml}
    ${tagsHtml}
    <div class="post-actions">
      <button class="like-btn ${liked?'liked':''}" data-id="${post.id}">
        ${liked?'❤':'🤍'} <span>${likeCount}</span>
      </button>
      <button class="comment-btn" data-id="${post.id}">💬 Comment</button>
    </div>
    <div class="comments-section" id="comments-${post.id}" style="display:none"></div>
  `;

  // Author name / avatar → open profile
  card.querySelectorAll('[data-uid]').forEach(el => {
    el.onclick = () => openUserProfile(el.dataset.uid);
  });

  // Like
  card.querySelector('.like-btn').onclick = async e => {
    e.stopPropagation();
    const ref = db.collection('posts').doc(post.id);
    const uid = currentUser.uid;
    if (liked) {
      await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(uid) });
    } else {
      await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(uid) });
      if (post.authorId !== uid)
        await sendNotification(post.authorId, 'post_like', { postId: post.id });
    }
  };

  // Comment toggle
  card.querySelector('.comment-btn').onclick = () => {
    const section = document.getElementById(`comments-${post.id}`);
    if (section.style.display === 'none') {
      section.style.display = 'block';
      loadPostComments(post.id, post.authorId);
    } else {
      section.style.display = 'none';
    }
  };

  // Delete post
  const delBtn = card.querySelector('.post-delete-btn');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Delete this post?')) return;
    await db.collection('posts').doc(post.id).delete();
    showToast('Post deleted');
  };

  // Tagged garden chips
  card.querySelectorAll('.post-tag-chip').forEach(chip => {
    chip.onclick = async () => {
      const doc = await db.collection('gardens').doc(chip.dataset.id).get();
      if (doc.exists) {
        const own    = doc.data().ownerId === currentUser?.uid;
        const collab = (doc.data().collaboratorEmails||[]).includes(currentUser?.email);
        openGardenPage(doc.id, doc.data(), own || collab);
      }
    };
  });

  // Image lightbox
  const img = card.querySelector('.post-image');
  if (img) img.onclick = () => openLightbox(post.imageUrl);

  return card;
}

// ── Post comments (nested) ────────────────────────────────────────
// Track active comment listeners so we can clean them up
const commentListeners = {};

function loadPostComments(postId, postAuthorId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  // Clean up existing listener for this post if any
  if (commentListeners[postId]) {
    commentListeners[postId]();
    delete commentListeners[postId];
  }

  // Build the persistent input row ONCE — it never gets wiped
  section.innerHTML = `
    <div id="comment-list-${postId}" class="comment-list"></div>
    <div class="comment-input-row" id="comment-input-row-${postId}">
      <input type="text" placeholder="Add a comment…"
        class="post-comment-input" id="comment-input-${postId}" />
      <button class="post-comment-submit" id="comment-submit-${postId}">Send</button>
    </div>
  `;

  // Wire up the input — these references are stable now
  const input  = document.getElementById(`comment-input-${postId}`);
  const submit = document.getElementById(`comment-submit-${postId}`);

  const doSubmit = () => submitPostComment(postId, postAuthorId, null, input);
  submit.onclick = doSubmit;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });

  // Real-time listener for comments — no orderBy to avoid index requirement,
  // sort client-side instead
  const unsub = db.collection('posts').doc(postId)
    .collection('comments')
    .onSnapshot(snap => {
      const list = document.getElementById(`comment-list-${postId}`);
      if (!list) return;
      list.innerHTML = '';

      // Sort by createdAt client-side
      const allDocs = snap.docs.slice().sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() || 0;
        const tb = b.data().createdAt?.toMillis?.() || 0;
        return ta - tb;
      });

      const topLevel = allDocs.filter(d => !d.data().parentId);
      const replies  = allDocs.filter(d =>  d.data().parentId);

      if (topLevel.length === 0) {
        list.innerHTML = '<p style="color:#aaa;font-size:0.82rem;margin:0.3rem 0">No comments yet — be the first!</p>';
        return;
      }

      topLevel.forEach(doc => {
        list.appendChild(buildCommentEl(doc, postId, postAuthorId, false));
        const myReplies = replies.filter(r => r.data().parentId === doc.id);
        if (myReplies.length > 0) {
          const replyWrap = document.createElement('div');
          replyWrap.className = 'comment-replies';
          myReplies.forEach(r =>
            replyWrap.appendChild(buildCommentEl(r, postId, postAuthorId, true)));
          list.appendChild(replyWrap);
        }
      });
    }, err => {
      console.error('Comments error:', err.message);
      const list = document.getElementById(`comment-list-${postId}`);
      if (list) list.innerHTML = `<p style="color:#c0392b;font-size:0.82rem">Could not load comments: ${err.message}</p>`;
    });

  commentListeners[postId] = unsub;
}

function buildCommentEl(doc, postId, postAuthorId, isReply) {
  const c      = doc.data();
  const isOwn  = currentUser && c.authorId === currentUser.uid;
  const isPostOwner = currentUser && postAuthorId === currentUser.uid;
  const liked  = (c.likes || []).includes(currentUser?.uid);
  const item   = document.createElement('div');
  item.className = 'comment-item';

  item.innerHTML = `
    <div class="comment-avatar" data-uid="${escHtml(c.authorId)}">
      ${c.authorPhoto
        ? `<img src="${escHtml(c.authorPhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
        : escHtml((c.authorName||'?')[0].toUpperCase())}
    </div>
    <div class="comment-body">
      <div class="comment-author" data-uid="${escHtml(c.authorId)}">${escHtml(c.authorName||'Unknown')}</div>
      <div class="comment-text">${escHtml(c.text)}</div>
      <div class="comment-meta">
        <span class="comment-time">${c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : ''}</span>
        <button class="comment-like-btn ${liked?'liked':''}" data-id="${doc.id}">
          ${liked?'❤':'🤍'} ${(c.likes||[]).length||''}
        </button>
        ${!isReply ? `<button class="comment-reply-btn" data-id="${doc.id}">Reply</button>` : ''}
        ${(isOwn||isPostOwner) ? `<button class="comment-delete-btn" data-id="${doc.id}">🗑</button>` : ''}
      </div>
      <div class="reply-input-row" id="reply-${doc.id}" style="display:none">
        <input type="text" placeholder="Write a reply…" />
        <button>Send</button>
      </div>
    </div>
  `;

  // Author click → profile
  item.querySelectorAll('[data-uid]').forEach(el => {
    el.onclick = () => openUserProfile(el.dataset.uid);
  });

  // Like comment
  item.querySelector('.comment-like-btn').onclick = async e => {
    e.stopPropagation();
    const ref = db.collection('posts').doc(postId).collection('comments').doc(doc.id);
    if (liked) await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
    else {
      await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      if (c.authorId !== currentUser.uid)
        await sendNotification(c.authorId, 'comment_like');
    }
    // Real-time listener handles the update automatically
  };

  // Reply button — use item.querySelector, NOT document.getElementById
  // because item hasn't been appended to the DOM yet at this point
  const replyBtn = item.querySelector('.comment-reply-btn');
  if (replyBtn) {
    const replyRow   = item.querySelector('.reply-input-row');
    const replyInput = replyRow ? replyRow.querySelector('input') : null;

    replyBtn.onclick = () => {
      if (!replyRow) return;
      replyRow.style.display = replyRow.style.display === 'none' ? 'flex' : 'none';
      if (replyRow.style.display !== 'none' && replyInput) replyInput.focus();
    };

    if (replyRow && replyInput) {
      replyRow.querySelector('button').onclick = () =>
        submitPostComment(postId, postAuthorId, doc.id, replyInput);
      replyInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitPostComment(postId, postAuthorId, doc.id, replyInput);
      });
    }
  }

  // Delete comment
  const delBtn = item.querySelector('.comment-delete-btn');
  if (delBtn) delBtn.onclick = async () => {
    await db.collection('posts').doc(postId).collection('comments').doc(doc.id).delete();
    // Real-time listener handles the update automatically
  };

  return item;
}

// inputEl is passed directly so we never do a DOM query that could
// match the wrong element when multiple posts are open
async function submitPostComment(postId, postAuthorId, parentId, inputEl) {
  // For replies, find the input inside the reply row
  let input = inputEl;
  if (!input && parentId) {
    input = document.getElementById(`reply-${parentId}`)?.querySelector('input');
  }
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // Disable while saving to prevent double-submit
  input.disabled = true;

  try {
    await db.collection('posts').doc(postId).collection('comments').add({
      text,
      parentId:    parentId || null,
      authorId:    currentUser.uid,
      authorName:  currentUser.displayName || currentUser.email,
      authorPhoto: currentUser.photoURL || '',
      likes:       [],
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';

    if (postAuthorId !== currentUser.uid)
      sendNotification(postAuthorId, 'post_comment', { postId });

    // Close reply row if this was a reply
    if (parentId) {
      const row = document.getElementById(`reply-${parentId}`);
      if (row) row.style.display = 'none';
    }

    // Real-time listener will update the list automatically —
    // no need to call loadPostComments again
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ── Compose (Feed tab) ────────────────────────────────────────────
// Only compose 2 (post tab) is used — feed compose was removed
document.getElementById('addImgBtn2').onclick    = () => pickPostImage(2);
document.getElementById('removeImgBtn2').onclick  = () => clearPostImage(2);
document.getElementById('submitPostBtn2').onclick = () => submitPost(2);
document.getElementById('tagGardenBtn2').onclick  = () => openTagPicker(2);

function pickPostImage(n) {
  const url = prompt('Paste an image URL:');
  if (!url) return;
  pendingImageUrl2 = url;
  document.getElementById('composeImgThumb2').src = url;
  document.getElementById('composeImgPreview2').style.display = 'flex';
}

function clearPostImage(n) {
  pendingImageUrl2 = '';
  document.getElementById('composeImgThumb2').src = '';
  document.getElementById('composeImgPreview2').style.display = 'none';
}

function openTagPicker(n) {
  activeFeedCompose = 2; // always use compose 2
  const list = document.getElementById('tag-picker-list');
  list.innerHTML = '<p style="color:#888;font-size:0.9rem">Loading…</p>';
  document.getElementById('tag-picker-overlay').classList.add('open');

  db.collection('gardens').where('ownerId', '==', currentUser.uid).get().then(snap => {
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p style="color:#888">No gardens to tag yet.</p>';
      return;
    }
    const tagged = n === 1 ? pendingTaggedGardens : pendingTaggedGardens2;
    snap.forEach(doc => {
      const d = doc.data();
      const already = tagged.find(g => g.id === doc.id);
      const btn = document.createElement('button');
      btn.className = 'tag-picker-item' + (already ? ' selected' : '');
      btn.textContent = d.name || 'Unnamed';
      btn.onclick = () => {
        if (already) {
          if (n === 1) pendingTaggedGardens  = pendingTaggedGardens.filter(g => g.id !== doc.id);
          else         pendingTaggedGardens2 = pendingTaggedGardens2.filter(g => g.id !== doc.id);
        } else {
          const entry = { id: doc.id, name: d.name || 'Unnamed' };
          if (n === 1) pendingTaggedGardens.push(entry);
          else         pendingTaggedGardens2.push(entry);
        }
        document.getElementById('tag-picker-overlay').classList.remove('open');
        renderComposeTags(n);
      };
      list.appendChild(btn);
    });
  });
}

function renderComposeTags(n) {
  const container = document.getElementById('composeTags2');
  const tagged    = pendingTaggedGardens2;
  container.innerHTML = '';
  tagged.forEach(g => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `🌿 ${escHtml(g.name)} <button class="chip-remove">✕</button>`;
    chip.querySelector('.chip-remove').onclick = () => {
      if (n === 1) pendingTaggedGardens  = pendingTaggedGardens.filter(x => x.id !== g.id);
      else         pendingTaggedGardens2 = pendingTaggedGardens2.filter(x => x.id !== g.id);
      renderComposeTags(n);
    };
    container.appendChild(chip);
  });
}

document.getElementById('tagPickerCloseBtn').onclick = () =>
  document.getElementById('tag-picker-overlay').classList.remove('open');
document.getElementById('tag-picker-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('tag-picker-overlay'))
    document.getElementById('tag-picker-overlay').classList.remove('open');
});

async function submitPost(n) {
  const text     = document.getElementById('postTextInput2').value.trim();
  const imgUrl   = pendingImageUrl2;
  const tagged   = pendingTaggedGardens2;
  const postType = document.getElementById('postTypeSelect2').value;

  if (!text && !imgUrl) return;

  const btn = document.getElementById(n === 1 ? 'submitPostBtn' : 'submitPostBtn2');
  btn.disabled = true;

  try {
    await db.collection('posts').add({
      text, imageUrl: imgUrl, taggedGardens: tagged, postType,
      authorId:    currentUser.uid,
      authorName:  currentUser.displayName || currentUser.email,
      authorPhoto: currentUser.photoURL || '',
      likes:       [],
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('postTextInput2').value = '';
    clearPostImage(2);
    pendingTaggedGardens2 = [];
    renderComposeTags(2);
    showToast('Posted! 🌱');
    setCommTab('feed');
  } finally {
    btn.disabled = false;
  }
}

// ── Discover section ──────────────────────────────────────────────
function loadDiscover() {
  db.collection('gardens')
    .where('visibility', '==', 'public')
    .limit(6).get()
    .then(snap => {
      const grid = document.getElementById('discover-gardens');
      if (!grid) return;
      grid.innerHTML = '';
      snap.forEach(doc => grid.appendChild(buildGardenCard(doc.id, doc.data(), false)));
    });
}

// ── Image lightbox ────────────────────────────────────────────────
function openLightbox(url) {
  const lb = document.createElement('div');
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9000;display:flex;align-items:center;justify-content:center;cursor:pointer';
  lb.innerHTML = `<img src="${escHtml(url)}" style="max-width:95vw;max-height:95vh;border-radius:0.5rem;object-fit:contain"/>`;
  lb.onclick = () => lb.remove();
  document.body.appendChild(lb);
}
