// Уровни опыта работы (фильтр каталога и формы вакансии)

const EXPERIENCE_LEVELS = [
  { id: 'any', label: 'Не имеет значения', value: null, filterOnly: true },
  { id: '3-6', label: 'От 3 до 6 лет', value: 'От 3 до 6 лет' },
  { id: '1-3', label: 'От 1 года до 3 лет', value: 'От 1 года до 3 лет' },
  { id: '6+', label: 'Более 6 лет', value: 'Более 6 лет' },
  { id: 'none', label: 'Нет опыта', value: 'Нет опыта' }
];

const EXPERIENCE_FORM_LEVELS = [
  { id: '', label: 'Не указан', value: '' },
  ...EXPERIENCE_LEVELS.filter((l) => !l.filterOnly)
];

function experienceLevelById(id) {
  return EXPERIENCE_LEVELS.find((l) => l.id === id) || null;
}

function experienceLevelByValue(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  return EXPERIENCE_LEVELS.find((l) => l.value === v) || null;
}

function classifyExperience(text) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return null;

  const byValue = experienceLevelByValue(text);
  if (byValue) return byValue.id;

  if (/без опыта|нет опыта|не требуется|стажировка|обучение/i.test(s)) {
    return 'none';
  }

  const nums = [];
  const re = /(\d+)\s*(?:лет|года|год)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    nums.push(parseInt(m[1], 10));
  }

  if (nums.length) {
    const n = Math.min(...nums);
    if (n >= 6) return '6+';
    if (n >= 3) return '3-6';
    if (n >= 1) return '1-3';
    return 'none';
  }

  if (/более\s*6|6\s*\+|от\s*6/i.test(s)) return '6+';
  if (/3\s*[—–-]\s*6|от\s*3\s*до\s*6|от\s*3/i.test(s)) return '3-6';
  if (/1\s*[—–-]\s*3|от\s*1\s*до\s*3|от\s*1/i.test(s)) return '1-3';

  return null;
}

function vacancyMatchesExperienceFilter(experienceText, filterId) {
  if (!filterId || filterId === 'any') return true;
  const level = experienceLevelById(filterId);
  if (!level) return true;
  const classified = classifyExperience(experienceText);
  if (classified === filterId) return true;
  if (level.value && String(experienceText || '').trim() === level.value) return true;
  return false;
}

function buildExperienceCounts(rows) {
  const counts = new Map();
  EXPERIENCE_LEVELS.forEach((l) => counts.set(l.id, 0));
  (rows || []).forEach((row) => {
    const id = classifyExperience(row.experience);
    if (id && counts.has(id)) counts.set(id, counts.get(id) + 1);
  });
  return counts;
}

function createExperienceSidebarFilter(config) {
  const { root, onChange } = config;
  if (!root) {
    return { getSelected: () => 'any', setCounts: () => {}, render: () => {} };
  }

  const listEl = root.querySelector('[data-experience-list]');
  let selected = 'any';
  let counts = new Map();

  function render() {
    if (!listEl) return;
    listEl.innerHTML = EXPERIENCE_LEVELS.map((level, i) => {
      const count = level.filterOnly ? null : (counts.get(level.id) ?? 0);
      const checked = selected === level.id ? ' checked' : '';
      const safeId = `exp-filter-${level.id || 'any'}-${i}`;
      const countHtml = count === null
        ? ''
        : `<span class="experience-filter-item__count">${count.toLocaleString('ru-RU')}</span>`;

      return `
        <label class="experience-filter-item">
          <input
            type="radio"
            class="experience-filter-item__input"
            name="experience_filter"
            id="${safeId}"
            value="${escapeHtml(level.id)}"
            ${checked}
          />
          <span class="experience-filter-item__name">${escapeHtml(level.label)}</span>
          ${countHtml}
        </label>`;
    }).join('');
  }

  root.addEventListener('change', (e) => {
    const input = e.target.closest('.experience-filter-item__input');
    if (!input) return;
    selected = input.value || 'any';
    onChange?.();
  });

  render();

  return {
    getSelected() {
      return selected;
    },
    readSelectedFromDom() {
      const checked = root.querySelector('.experience-filter-item__input:checked');
      selected = checked?.value || 'any';
    },
    setCounts(newCounts) {
      counts = newCounts;
      render();
    },
    render
  };
}

function resolveExperienceFormValue(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const byValue = experienceLevelByValue(v);
  if (byValue) return byValue.value;
  const classified = classifyExperience(v);
  const level = experienceLevelById(classified);
  return level?.value || '';
}

function renderExperienceFormOptions(name = 'experience', selectedValue = '') {
  const resolved = resolveExperienceFormValue(selectedValue);

  return EXPERIENCE_FORM_LEVELS.map((level, i) => {
    const checked = level.value === resolved ? ' checked' : '';
    const safeId = `exp-form-${name}-${i}`;

    return `
      <label class="experience-form__item">
        <input
          type="radio"
          class="experience-form__input"
          name="${escapeHtml(name)}"
          id="${safeId}"
          value="${escapeHtml(level.value)}"
          ${checked}
        />
        <span class="experience-form__label">${escapeHtml(level.label)}</span>
      </label>`;
  }).join('');
}

function initExperienceForms() {
  document.querySelectorAll('[data-experience-form]').forEach((fieldset) => {
    const list = fieldset.querySelector('[data-experience-options]');
    const name = fieldset.dataset.experienceName || 'experience';
    if (!list || list.dataset.ready === '1') return;
    list.dataset.ready = '1';
    list.innerHTML = renderExperienceFormOptions(name, '');
  });
}

function setExperienceFormValue(form, value) {
  if (!form) return;
  const list = form.querySelector('[data-experience-options]');
  if (list) {
    list.innerHTML = renderExperienceFormOptions('experience', value || '');
  }
}

document.addEventListener('DOMContentLoaded', initExperienceForms);
