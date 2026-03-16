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
  setComposeAvatar('composeAvatar');
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
async function loadPostComments(postId, postAuthorId) {
  const section = document.getElementById(`comments-${postId}`);
  section.innerHTML = '';

  const snap = await db.collection('posts').doc(postId)
    .collection('comments')
    .orderBy('createdAt', 'asc').get();

  // Build tree: top-level comments, then replies
  const topLevel = snap.docs.filter(d => !d.data().parentId);
  const replies  = snap.docs.filter(d =>  d.data().parentId);

  topLevel.forEach(doc => {
    section.appendChild(buildCommentEl(doc, postId, postAuthorId, false));
    // Replies to this comment
    const myReplies = replies.filter(r => r.data().parentId === doc.id);
    if (myReplies.length > 0) {
      const replyWrap = document.createElement('div');
      replyWrap.className = 'comment-replies';
      myReplies.forEach(r =>
        replyWrap.appendChild(buildCommentEl(r, postId, postAuthorId, true)));
      section.appendChild(replyWrap);
    }
  });

  // Input row
  const inputRow = document.createElement('div');
  inputRow.className = 'comment-input-row';
  inputRow.innerHTML = `
    <input type="text" placeholder="Add a comment…" class="post-comment-input" data-post="${postId}" />
    <button class="post-comment-submit" data-post="${postId}">Send</button>
  `;
  inputRow.querySelector('.post-comment-submit').onclick = () =>
    submitPostComment(postId, postAuthorId, null);
  inputRow.querySelector('.post-comment-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitPostComment(postId, postAuthorId, null);
  });
  section.appendChild(inputRow);
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
    loadPostComments(postId, postAuthorId);
  };

  // Reply button
  const replyBtn = item.querySelector('.comment-reply-btn');
  if (replyBtn) {
    replyBtn.onclick = () => {
      const row = document.getElementById(`reply-${doc.id}`);
      row.style.display = row.style.display === 'none' ? 'flex' : 'none';
      if (row.style.display !== 'none') row.querySelector('input').focus();
    };
    const replyRow = document.getElementById(`reply-${doc.id}`);
    replyRow.querySelector('button').onclick = () =>
      submitPostComment(postId, postAuthorId, doc.id);
    replyRow.querySelector('input').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitPostComment(postId, postAuthorId, doc.id);
    });
  }

  // Delete comment
  const delBtn = item.querySelector('.comment-delete-btn');
  if (delBtn) delBtn.onclick = async () => {
    await db.collection('posts').doc(postId).collection('comments').doc(doc.id).delete();
    loadPostComments(postId, postAuthorId);
  };

  return item;
}

async function submitPostComment(postId, postAuthorId, parentId) {
  let input;
  if (parentId) {
    input = document.getElementById(`reply-${parentId}`)?.querySelector('input');
  } else {
    input = document.querySelector(`.post-comment-input[data-post="${postId}"]`);
  }
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  await db.collection('posts').doc(postId).collection('comments').add({
    text, parentId: parentId || null,
    authorId:    currentUser.uid,
    authorName:  currentUser.displayName || currentUser.email,
    authorPhoto: currentUser.photoURL || '',
    likes:       [],
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  });

  input.value = '';
  if (postAuthorId !== currentUser.uid)
    await sendNotification(postAuthorId, 'post_comment', { postId });
  loadPostComments(postId, postAuthorId);
}

// ── Compose (Feed tab) ────────────────────────────────────────────
document.getElementById('addImgBtn').onclick  = () => pickPostImage(1);
document.getElementById('removeImgBtn').onclick = () => clearPostImage(1);
document.getElementById('submitPostBtn').onclick = () => submitPost(1);
document.getElementById('tagGardenBtn').onclick  = () => openTagPicker(1);

document.getElementById('addImgBtn2').onclick   = () => pickPostImage(2);
document.getElementById('removeImgBtn2').onclick = () => clearPostImage(2);
document.getElementById('submitPostBtn2').onclick = () => submitPost(2);
document.getElementById('tagGardenBtn2').onclick  = () => openTagPicker(2);

function pickPostImage(n) {
  // For now show a URL prompt since storage isn't enabled
  const url = prompt('Paste an image URL:');
  if (!url) return;
  if (n === 1) {
    pendingImageUrl = url;
    document.getElementById('composeImgThumb').src = url;
    document.getElementById('composeImgPreview').style.display = 'flex';
  } else {
    pendingImageUrl2 = url;
    document.getElementById('composeImgThumb2').src = url;
    document.getElementById('composeImgPreview2').style.display = 'flex';
  }
}

function clearPostImage(n) {
  if (n === 1) {
    pendingImageUrl = '';
    document.getElementById('composeImgThumb').src = '';
    document.getElementById('composeImgPreview').style.display = 'none';
  } else {
    pendingImageUrl2 = '';
    document.getElementById('composeImgThumb2').src = '';
    document.getElementById('composeImgPreview2').style.display = 'none';
  }
}

function openTagPicker(n) {
  activeFeedCompose = n;
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
  const container = document.getElementById(n === 1 ? 'composeTags' : 'composeTags2');
  const tagged    = n === 1 ? pendingTaggedGardens : pendingTaggedGardens2;
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
  const inputId = n === 1 ? 'postTextInput'   : 'postTextInput2';
  const typeId  = n === 1 ? 'postTypeSelect'  : 'postTypeSelect2';
  const text    = document.getElementById(inputId).value.trim();
  const imgUrl  = n === 1 ? pendingImageUrl   : pendingImageUrl2;
  const tagged  = n === 1 ? pendingTaggedGardens : pendingTaggedGardens2;
  const postType = document.getElementById(typeId).value;

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

    document.getElementById(inputId).value = '';
    clearPostImage(n);
    if (n === 1) pendingTaggedGardens  = [];
    else         pendingTaggedGardens2 = [];
    renderComposeTags(n);
    showToast('Posted! 🌱');

    // Switch to feed to see the post
    if (n === 2) setCommTab('feed');
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
