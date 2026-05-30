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

/** E-mail и пароль из формы входа (нормализация убирает типичные ошибки ввода). */
function readLoginCredentials(form) {
  const emailRaw = String(form.querySelector('[name="email"]')?.value || '');
  const passRaw = String(form.querySelector('[name="password"]')?.value || '');
  const email = emailRaw.trim().toLowerCase();
  const password = passRaw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+$/g, '')
    .replace(/^\s+/g, '');
  return { email, password };
}

async function updateHeaderAuth() {
  const btn = document.querySelector('.header__cta');
  if (!btn) return;

  const { data: { session } } = await sb.auth.getSession();
  const user = session?.user;
  if (user) {
    btn.textContent = 'Личный кабинет';
    btn.href = 'cabinet.html';
    btn.setAttribute('aria-label', 'Личный кабинет');
  } else {
    btn.textContent = 'Войти';
    btn.href = 'cabinet.html';
    btn.setAttribute('aria-label', 'Войти в личный кабинет');
  }
}

sb.auth.onAuthStateChange(() => {
  void updateHeaderAuth();
});

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

/** Ширина колонок по содержимому (чтобы UUID и длинный текст не обрезались). */
function excelColumnWidths(rows) {
  const widths = [];
  rows.forEach((row) => {
    row.forEach((cell, colIndex) => {
      const lines = String(cell ?? '').split(/\r?\n/);
      const maxLen = Math.max(...lines.map((line) => line.length), 0);
      const wch = Math.min(Math.max(maxLen + 2, 10), 120);
      widths[colIndex] = Math.max(widths[colIndex] ?? 10, wch);
    });
  });
  return widths.map((wch) => ({ wch }));
}

/** Выгрузка таблицы в .xlsx с подобранной шириной колонок. */
function downloadTableAsExcel(rows, fileBase) {
  if (!rows.length) {
    showToast('Нет данных для выгрузки', 'error');
    return;
  }

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const fileName = `${fileBase}_${dateSuffix}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = excelColumnWidths(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Данные');
    XLSX.writeFile(book, fileName);
    showToast('Файл Excel выгружен', 'success');
    return;
  }

  const BOM = '\uFEFF';
  const sep = ';';
  const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(escapeCell).join(sep)).join('\r\n');
  const blob = new Blob([BOM + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase}_${dateSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Файл выгружен (откройте в Excel)', 'success');
}

document.addEventListener('DOMContentLoaded', updateHeaderAuth);
