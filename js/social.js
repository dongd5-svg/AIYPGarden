// ================================================================
// SOCIAL.JS — user profiles, follow/unfollow, search
// ================================================================

// ── Search ────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('discover-section').style.display = 'block';
  document.getElementById('search-results').querySelectorAll('.search-result-section')
    .forEach(s => s.remove());

  input.oninput = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      document.getElementById('discover-section').style.display = 'block';
      document.getElementById('search-results').querySelectorAll('.search-result-section')
        .forEach(s => s.remove());
      return;
    }
    document.getElementById('discover-section').style.display = 'none';
    await runSearch(q);
  }, 350);
}

async function runSearch(query) {
  const results = document.getElementById('search-results');
  // Clear old result sections
  results.querySelectorAll('.search-result-section').forEach(s => s.remove());

  const q = query.toLowerCase();

  // Search users
  const usersSnap = await db.collection('users').get();
  const matchedUsers = usersSnap.docs
    .filter(d => (d.data().displayName||'').toLowerCase().includes(q)
              || (d.data().email||'').toLowerCase().includes(q))
    .slice(0, 8);

  if (matchedUsers.length > 0) {
    const section = document.createElement('div');
    section.className = 'search-result-section';
    section.innerHTML = '<div class="search-section-title">People</div>';
    matchedUsers.forEach(doc => section.appendChild(buildUserSearchItem(doc.id, doc.data())));
    results.appendChild(section);
  }

  // Search public gardens
  const gardensSnap = await db.collection('gardens')
    .where('visibility', '==', 'public').get();
  const matchedGardens = gardensSnap.docs
    .filter(d => (d.data().name||'').toLowerCase().includes(q))
    .slice(0, 6);

  if (matchedGardens.length > 0) {
    const section = document.createElement('div');
    section.className = 'search-result-section';
    section.innerHTML = '<div class="search-section-title">Gardens</div>';
    const grid = document.createElement('div');
    grid.className = 'gardens-grid';
    matchedGardens.forEach(doc => {
      const isOwn = doc.data().ownerId === currentUser?.uid;
      grid.appendChild(buildGardenCard(doc.id, doc.data(), isOwn));
    });
    section.appendChild(grid);
    results.appendChild(section);
  }

  if (matchedUsers.length === 0 && matchedGardens.length === 0) {
    const none = document.createElement('div');
    none.style.cssText = 'text-align:center;padding:2rem;color:#888;font-size:0.9rem';
    none.textContent = `No results for "${query}"`;
    results.appendChild(none);
  }
}

function buildUserSearchItem(uid, data) {
  const item = document.createElement('div');
  item.className = 'search-user-item';
  item.innerHTML = `
    <div class="search-user-avatar">
      ${data.photoURL
        ? `<img src="${escHtml(data.photoURL)}" />`
        : escHtml((data.displayName||'?')[0].toUpperCase())}
    </div>
    <div>
      <div class="search-user-name">${escHtml(data.displayName||'Unknown')}</div>
      ${data.bio ? `<div class="search-user-bio">${escHtml(data.bio.slice(0,60))}</div>` : ''}
    </div>
  `;
  item.onclick = () => openUserProfile(uid);
  return item;
}

// ── Own profile ───────────────────────────────────────────────────
function renderOwnProfile() {
  renderUserProfile(currentUser.uid, document.getElementById('profile-view'), true);
}

// ── Open any user profile ─────────────────────────────────────────
async function openUserProfile(uid) {
  if (uid === currentUser.uid) {
    setCommTab('profile');
    return;
  }
  const overlay = document.getElementById('user-profile-overlay');
  const content = document.getElementById('user-profile-content');
  overlay.style.display = 'block';
  content.innerHTML = '<p style="padding:2rem;text-align:center;color:#888">Loading…</p>';
  await renderUserProfile(uid, content, false);
}

document.getElementById('userProfileBackBtn').onclick = () => {
  document.getElementById('user-profile-overlay').style.display = 'none';
};

// ── Render a profile ──────────────────────────────────────────────
async function renderUserProfile(uid, container, isOwn) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    container.innerHTML = '<p style="padding:2rem;color:#888">User not found.</p>';
    return;
  }
  const user = userDoc.data();

  // Follow state
  const myDoc     = await db.collection('users').doc(currentUser.uid).get();
  const myData    = myDoc.data() || {};
  const following = myData.following || [];
  const isFollowing = following.includes(uid);

  // Counts
  const followerCount  = (user.followers || []).length;
  const followingCount = (user.following || []).length;

  // Posts
  const postsSnap = await db.collection('posts')
    .where('authorId', '==', uid)
    .orderBy('createdAt', 'desc').limit(20).get();

  // Public gardens
  const gardensSnap = await db.collection('gardens')
    .where('ownerId', '==', uid)
    .where('visibility', '==', 'public').get();

  // Tagged posts (posts where taggedGardens contains one of this user's gardens)
  const gardenIds = gardensSnap.docs.map(d => d.id);
  let taggedPosts = [];
  // Simple approach: get posts and filter client-side
  const allPostsSnap = await db.collection('posts')
    .orderBy('createdAt', 'desc').limit(100).get();
  taggedPosts = allPostsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => (p.taggedGardens || []).some(g => gardenIds.includes(g.id)))
    .slice(0, 20);

  container.innerHTML = `
    <div class="profile-cover"></div>
    <div class="profile-info-row">
      <div class="profile-big-avatar">
        ${user.photoURL
          ? `<img src="${escHtml(user.photoURL)}" />`
          : escHtml((user.displayName||'?')[0].toUpperCase())}
      </div>
      <div class="profile-actions">
        ${!isOwn ? `
          <button class="btn-follow ${isFollowing?'following':''}" id="followBtn" data-uid="${uid}">
            ${isFollowing ? 'Following' : 'Follow'}
          </button>
          <button class="btn-message" id="msgBtn" data-uid="${uid}">Message</button>
        ` : `
          <button class="btn-message" id="editBioBtn">Edit Bio</button>
        `}
      </div>
    </div>
    <div style="padding:0 1rem">
      <div class="profile-name">${escHtml(user.displayName||'Unknown')}</div>
    </div>
    ${user.bio
      ? `<p class="profile-bio">${escHtml(user.bio)}</p>`
      : isOwn ? '<p class="profile-bio" style="color:#aaa">No bio yet — add one!</p>' : ''}
    ${isOwn ? `
      <div class="profile-edit-bio" id="editBioRow" style="display:none">
        <input id="bioInput" type="text" value="${escHtml(user.bio||'')}" placeholder="Write a short bio…" maxlength="150"/>
        <button id="saveBioBtn">Save</button>
      </div>` : ''}
    <div class="profile-stats">
      <div class="profile-stat">
        <span class="profile-stat-num">${postsSnap.size}</span>
        <span class="profile-stat-label">Posts</span>
      </div>
      <div class="profile-stat" id="followersStat">
        <span class="profile-stat-num">${followerCount}</span>
        <span class="profile-stat-label">Followers</span>
      </div>
      <div class="profile-stat" id="followingStat">
        <span class="profile-stat-num">${followingCount}</span>
        <span class="profile-stat-label">Following</span>
      </div>
    </div>
    <div class="profile-tabs">
      <button class="profile-tab active" data-ptab="posts">Posts</button>
      <button class="profile-tab" data-ptab="gardens">Gardens</button>
      <button class="profile-tab" data-ptab="tagged">Tagged</button>
    </div>
    <div id="profileTabContent"></div>
  `;

  // Tab switching
  const tabContent = container.querySelector('#profileTabContent');
  const renderTab  = tab => {
    container.querySelectorAll('.profile-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.ptab === tab));
    tabContent.innerHTML = '';
    if (tab === 'posts') {
      if (postsSnap.empty) {
        tabContent.innerHTML = '<p style="color:#888;text-align:center;padding:2rem">No posts yet.</p>';
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'profile-posts-grid';
        postsSnap.forEach(doc => wrap.appendChild(buildPostCard({ id: doc.id, ...doc.data() })));
        tabContent.appendChild(wrap);
      }
    } else if (tab === 'gardens') {
      if (gardensSnap.empty) {
        tabContent.innerHTML = '<p style="color:#888;text-align:center;padding:2rem">No public gardens.</p>';
      } else {
        const grid = document.createElement('div');
        grid.className = 'profile-gardens-grid';
        gardensSnap.forEach(doc => grid.appendChild(buildGardenCard(doc.id, doc.data(), isOwn)));
        tabContent.appendChild(grid);
      }
    } else if (tab === 'tagged') {
      if (taggedPosts.length === 0) {
        tabContent.innerHTML = '<p style="color:#888;text-align:center;padding:2rem">No tagged posts.</p>';
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'profile-posts-grid';
        taggedPosts.forEach(post => wrap.appendChild(buildPostCard(post)));
        tabContent.appendChild(wrap);
      }
    }
  };

  container.querySelectorAll('.profile-tab').forEach(btn => {
    btn.onclick = () => renderTab(btn.dataset.ptab);
  });
  renderTab('posts');

  // Follow button
  const followBtn = container.querySelector('#followBtn');
  if (followBtn) followBtn.onclick = () => toggleFollow(uid, followBtn);

  // Message button
  const msgBtn = container.querySelector('#msgBtn');
  if (msgBtn) msgBtn.onclick = () => {
    document.getElementById('user-profile-overlay').style.display = 'none';
    navigateTo('community');
    setCommTab('dms');
    openDmWithUser(uid, user.displayName || user.email, user.photoURL || '');
  };

  // Edit bio (own profile)
  const editBioBtn = container.querySelector('#editBioBtn');
  if (editBioBtn) editBioBtn.onclick = () => {
    const row = container.querySelector('#editBioRow');
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  };
  const saveBioBtn = container.querySelector('#saveBioBtn');
  if (saveBioBtn) saveBioBtn.onclick = async () => {
    const bio = container.querySelector('#bioInput').value.trim();
    await db.collection('users').doc(currentUser.uid).update({ bio });
    showToast('Bio updated!');
    container.querySelector('#editBioRow').style.display = 'none';
    container.querySelector('.profile-bio').textContent = bio;
  };
}

// ── Follow / unfollow ─────────────────────────────────────────────
async function toggleFollow(targetUid, btn) {
  const myRef     = db.collection('users').doc(currentUser.uid);
  const targetRef = db.collection('users').doc(targetUid);
  const mySnap    = await myRef.get();
  const following = mySnap.data()?.following || [];

  if (following.includes(targetUid)) {
    // Unfollow
    await myRef.update({
      following: firebase.firestore.FieldValue.arrayRemove(targetUid)
    });
    await targetRef.update({
      followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    });
    btn.textContent = 'Follow';
    btn.classList.remove('following');
    showToast('Unfollowed');
  } else {
    // Follow
    await myRef.update({
      following: firebase.firestore.FieldValue.arrayUnion(targetUid)
    });
    await targetRef.update({
      followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
    btn.textContent = 'Following';
    btn.classList.add('following');
    showToast('Following! 🌱');
    await sendNotification(targetUid, 'follow');
  }
}
