// =============================================
// Supabase — подключение
// Замени SUPABASE_URL и SUPABASE_ANON_KEY
// значениями из Settings → API в панели Supabase
// =============================================

const SUPABASE_URL  = 'https://vjfiktkartbwkhfwrbst.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-UAm8TL_tf-ONDAbNfRsTA_JGBC9CdJ';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function updateHeaderAuth() {
  const btn = document.querySelector('.header__cta');
  if (!btn) return;

  const user = await getCurrentUser();
  if (user) {
    btn.textContent = 'Личный кабинет';
    btn.href = 'cabinet.html';
  } else {
    btn.textContent = 'Войти';
    btn.href = 'cabinet.html';
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Для отклика соискателя: в профиле должен быть хотя бы телефон или e-mail для связи. */
function profileHasRespondContacts(profile) {
  if (!profile) return false;
  const phone = String(profile.phone ?? '').trim();
  const email = String(profile.contact_email ?? '').trim();
  return phone.length > 0 || email.length > 0;
}

document.addEventListener('DOMContentLoaded', updateHeaderAuth);
