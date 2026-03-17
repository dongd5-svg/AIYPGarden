// ================================================================
// UTILS.JS — shared helpers used across all modules
// ================================================================

// Escape HTML to prevent XSS
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Human-readable time ago
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return date.toLocaleDateString();
}

// Format a Firestore timestamp or Date to readable string
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

// Format date for input[type=date]
function toInputDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split('T')[0];
}

// Parse input[type=date] value to Date
function fromInputDate(str) {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

// Debounce
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Generate a short unique ID
function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

// Show a brief toast notification
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Priority config (used in tasks + tiles)
const PRIORITY_ORDER  = ['urgent','high','medium','low','none'];
const PRIORITY_COLORS = {
  urgent: '#ffb3b3',
  high:   '#ffd5a8',
  medium: '#fff3a8',
  low:    '#b3d4ff',
  none:   null
};
const PRIORITY_LABELS = {
  urgent: '🔴 Urgent',
  high:   '🟠 High',
  medium: '🟡 Medium',
  low:    '🔵 Low',
  none:   'None'
};
const STATUS_LABELS = {
  todo:       'To Do',
  inprogress: 'In Progress',
  done:       '✓ Done'
};

// Season config
const SEASONS = ['spring','summer','fall','winter'];
const SEASON_LABELS = { spring:'🌸 Spring', summer:'☀️ Summer', fall:'🍂 Fall', winter:'❄️ Winter' };
const SEASON_COLORS = { spring:'#d4f5d4', summer:'#fff3a8', fall:'#ffd5a8', winter:'#d4e8ff' };

// Post type config
const POST_TYPES = {
  general:  { label: '💬 General',  color: '#e8ffd6' },
  question: { label: '❓ Question', color: '#fff3a8' },
  tip:      { label: '💡 Tip',      color: '#d4f5d4' },
  harvest:  { label: '🌾 Harvest',  color: '#ffd5a8' },
  update:   { label: '📣 Update',   color: '#d4e8ff' }
};
