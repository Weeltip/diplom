// =============================================
// Supabase — подключение
// Замени SUPABASE_URL и SUPABASE_ANON_KEY
// значениями из Settings → API в панели Supabase
// =============================================

const SUPABASE_URL  = 'https://vjfiktkartbwkhfwrbst.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-UAm8TL_tf-ONDAbNfRsTA_JGBC9CdJ';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _pickerRepositionHandler = null;

function positionPickerDropdown(trigger, dropdown) {
  if (!trigger || !dropdown) return;

  dropdown.classList.add('location-picker__dropdown--fixed');
  dropdown.hidden = false;
  dropdown.style.visibility = 'hidden';

  const gap = 6;
  const triggerRect = trigger.getBoundingClientRect();
  const maxPanel = Math.min(340, window.innerHeight * 0.52);
  const panelHeight = Math.min(dropdown.offsetHeight || maxPanel, maxPanel);
  const spaceBelow = window.innerHeight - triggerRect.bottom - gap;
  const spaceAbove = triggerRect.top - gap;
  const openUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;

  dropdown.style.width = `${Math.round(triggerRect.width)}px`;
  dropdown.style.left = `${Math.round(triggerRect.left)}px`;
  dropdown.style.right = 'auto';

  if (openUp) {
    dropdown.classList.add('location-picker__dropdown--up');
    dropdown.style.top = 'auto';
    dropdown.style.bottom = `${Math.round(window.innerHeight - triggerRect.top + gap)}px`;
    dropdown.style.maxHeight = `${Math.max(120, Math.min(maxPanel, spaceAbove))}px`;
  } else {
    dropdown.classList.remove('location-picker__dropdown--up');
    dropdown.style.top = `${Math.round(triggerRect.bottom + gap)}px`;
    dropdown.style.bottom = 'auto';
    dropdown.style.maxHeight = `${Math.max(120, Math.min(maxPanel, spaceBelow))}px`;
  }

  dropdown.style.visibility = '';
}

function resetPickerDropdown(dropdown) {
  if (!dropdown) return;
  dropdown.classList.remove('location-picker__dropdown--fixed', 'location-picker__dropdown--up');
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.left = '';
  dropdown.style.right = '';
  dropdown.style.width = '';
  dropdown.style.maxHeight = '';
  dropdown.style.visibility = '';
}

function bindPickerReposition(trigger, dropdown, reposition) {
  unbindPickerReposition();
  _pickerRepositionHandler = () => {
    if (!dropdown || dropdown.hidden) return;
    reposition();
  };
  window.addEventListener('resize', _pickerRepositionHandler);
  window.addEventListener('scroll', _pickerRepositionHandler, true);
}

function unbindPickerReposition() {
  if (!_pickerRepositionHandler) return;
  window.removeEventListener('resize', _pickerRepositionHandler);
  window.removeEventListener('scroll', _pickerRepositionHandler, true);
  _pickerRepositionHandler = null;
}

function formatSupabaseError(error) {
  const msg = String(error?.message || error || '').trim();
  if (
    /specialization|industry/i.test(msg)
    && (/schema cache/i.test(msg) || /column/i.test(msg) || /does not exist/i.test(msg))
  ) {
    return 'В таблице vacancies нет колонок specialization и industry. '
      + 'Выполните sql/vacancies.sql в Supabase → SQL Editor (новый проект — все 3 файла по порядку).';
  }
  return msg || 'Неизвестная ошибка';
}

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

/** Суффикс валюты в каталоге (приднестровский рубль). */
const SALARY_CURRENCY = 'руб.';

/** Числа из строки зарплаты («от 8 500 руб.», «6 500 — 9 200 руб.», «от 55 000 ₽»). */
function parseSalaryRange(text) {
  if (!text || !String(text).trim()) return null;
  const s = String(text).replace(/\u00a0/g, ' ').trim();
  const rangeMatch = s.match(/(\d[\d\s]*)\s*[—–\-]\s*(\d[\d\s]*)/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1].replace(/\s/g, ''), 10);
    const b = parseInt(rangeMatch[2].replace(/\s/g, ''), 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const chunks = s.match(/\d[\d\s]*/g);
  if (!chunks?.length) return null;
  const vals = chunks
    .map((n) => parseInt(n.replace(/\s/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!vals.length) return null;
  const v = vals[0];
  return { min: v, max: v };
}

function formatSalaryAmount(amount) {
  return `${Number(amount).toLocaleString('ru-RU')} ${SALARY_CURRENCY}`;
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

function formatVacancyPlace(location) {
  const text = String(location || '').trim();
  if (!text) return '';

  if (typeof pmrParseLocation === 'function') {
    const { city, district } = pmrParseLocation(text);
    if (city && district) return `г. ${city} • р-н ${district}`;
    if (city) return `г. ${city}`;
  }

  return text
    .replace(/\s*,\s*р-н\s*/gi, ' • р-н ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function renderVacancyCardHtml(v, variant = 'list') {
  const featured = !!v.is_featured;
  const place = formatVacancyPlace(v.location);
  const chips = [v.experience, v.employment_type].filter(Boolean);
  const spec = String(v.specialization || '').trim();
  const showSpec = spec && spec.toLowerCase() !== String(v.title || '').trim().toLowerCase();

  const chipsHtml = chips
    .map((c) => `<li class="vacancy-card__chip">${escapeHtml(c)}</li>`)
    .join('');

  const hotHtml = featured
    ? '<span class="vacancy-card__hot">Горячая</span>'
    : '';

  const payRowHtml = `
    <div class="vacancy-card__pay-row">
      <p class="vacancy-card__salary">${escapeHtml(v.salary || 'По договорённости')}</p>
      ${chips.length ? `<ul class="vacancy-card__chips">${chipsHtml}</ul>` : ''}
    </div>`;

  const metaHtml = `
    <p class="vacancy-card__employer">${escapeHtml(v.employer)}</p>
    ${showSpec ? `<p class="vacancy-card__spec">${escapeHtml(spec)}</p>` : ''}
    ${place ? `<p class="vacancy-card__place">${escapeHtml(place)}</p>` : ''}`;

  const titleHtml = `<a href="vacancy.html?id=${v.id}" class="vacancy-card__title-link">${escapeHtml(v.title)}</a>`;

  if (variant === 'list') {
    return `<li>
      <article class="vacancy-card vacancy-card--list${featured ? ' vacancy-card--featured' : ''}">
        <div class="vacancy-card__body">
          <div class="vacancy-card__headline">
            <h3 class="vacancy-card__title">${titleHtml}</h3>
            ${hotHtml}
          </div>
          ${payRowHtml}
          ${metaHtml}
        </div>
        <div class="vacancy-card__side">
          <time class="vacancy-card__date" datetime="${v.created_at}">${formatDate(v.created_at)}</time>
          <a class="vacancy-card__more" href="vacancy.html?id=${v.id}">Подробнее</a>
        </div>
      </article>
    </li>`;
  }

  return `<li>
    <article class="vacancy-card vacancy-card--tile${featured ? ' vacancy-card--featured' : ''}">
      <div class="vacancy-card__headline">
        <h3 class="vacancy-card__title">${titleHtml}</h3>
        ${hotHtml}
      </div>
      ${payRowHtml}
      ${metaHtml}
      <div class="vacancy-card__tile-foot">
        <time class="vacancy-card__date" datetime="${v.created_at}">${formatDate(v.created_at)}</time>
        <a class="vacancy-card__more" href="vacancy.html?id=${v.id}">Подробнее</a>
      </div>
    </article>
  </li>`;
}

document.addEventListener('DOMContentLoaded', updateHeaderAuth);
