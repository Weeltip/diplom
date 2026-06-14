// Специализации и отрасли для вакансий (каталог и формы)

const TAXONOMY_SPECIALIZATIONS = [
  'Программист, разработчик',
  'Менеджер по продажам',
  'Менеджер по работе с клиентами',
  'Бухгалтер',
  'Аналитик',
  'Водитель',
  'Продавец, кассир',
  'Медицинский работник',
  'Инженер',
  'Рабочий, оператор станков',
  'Слесарь, электрик',
  'Строитель',
  'Повар, работник общепита',
  'Охранник',
  'Учитель, преподаватель',
  'Секретарь, делопроизводитель',
  'Кладовщик, комплектовщик',
  'Юрист',
  'Экономист',
  'Маркетолог',
  'Дизайнер',
  'Системный администратор',
  'Логист, диспетчер',
  'Агроном, работник сельского хозяйства',
  'Социальный работник',
  'Другое'
];

const TAXONOMY_SPECIALIZATIONS_PRIMARY = [
  'Менеджер по продажам',
  'Рабочий, оператор станков',
  'Водитель',
  'Продавец, кассир'
];

const TAXONOMY_INDUSTRIES = [
  'Производство',
  'Торговля, розница',
  'Строительство',
  'Транспорт, логистика',
  'Сельское хозяйство',
  'Медицина, фармацевтика',
  'Образование',
  'Государственный сектор',
  'IT, телекоммуникации',
  'Финансы, страхование',
  'Общественное питание, гостиницы',
  'Услуги населению',
  'Строительные материалы',
  'Пищевая промышленность',
  'Лёгкая промышленность',
  'Энергетика',
  'Связь, почта',
  'Реклама, СМИ',
  'Недвижимость',
  'Безопасность',
  'Другое'
];

const TAXONOMY_INDUSTRIES_PRIMARY = [
  'Производство',
  'Торговля, розница',
  'Строительство',
  'Транспорт, логистика'
];

const _taxonomyPublishedExtras = {
  specialization: [],
  industry: []
};

function taxonomyGetList(kind) {
  if (kind === 'specialization') return TAXONOMY_SPECIALIZATIONS;
  if (kind === 'industry') return TAXONOMY_INDUSTRIES;
  return [];
}

function taxonomyGetPrimary(kind) {
  if (kind === 'specialization') return TAXONOMY_SPECIALIZATIONS_PRIMARY;
  if (kind === 'industry') return TAXONOMY_INDUSTRIES_PRIMARY;
  return [];
}

function taxonomyExtractExtras(rows, field, baseList) {
  const base = new Set(baseList);
  const extra = new Set();
  (rows || []).forEach((row) => {
    const val = String(row[field] || '').trim();
    if (val && !base.has(val)) extra.add(val);
  });
  return [...extra].sort((a, b) => a.localeCompare(b, 'ru'));
}

function taxonomySyncPublishedExtras(rows) {
  _taxonomyPublishedExtras.specialization = taxonomyExtractExtras(
    rows,
    'specialization',
    TAXONOMY_SPECIALIZATIONS
  );
  _taxonomyPublishedExtras.industry = taxonomyExtractExtras(
    rows,
    'industry',
    TAXONOMY_INDUSTRIES
  );
}

function taxonomyGetMergedList(kind) {
  const base = taxonomyGetList(kind);
  const extras = kind === 'specialization'
    ? _taxonomyPublishedExtras.specialization
    : _taxonomyPublishedExtras.industry;
  const merged = [...base];
  extras.forEach((item) => {
    if (!merged.includes(item)) merged.push(item);
  });
  return merged;
}

async function taxonomyRefreshPublishedExtras(sb) {
  const { data, error } = await sb
    .from('vacancies')
    .select('specialization, industry')
    .eq('is_published', true);

  if (error) {
    taxonomySyncPublishedExtras([]);
    return [];
  }

  taxonomySyncPublishedExtras(data || []);
  return data || [];
}

function taxonomyBuildCounts(rows, field, allItems) {
  const counts = new Map();
  allItems.forEach((item) => counts.set(item, 0));
  (rows || []).forEach((row) => {
    const val = String(row[field] || '').trim();
    if (!val) return;
    if (!counts.has(val)) counts.set(val, 0);
    counts.set(val, counts.get(val) + 1);
  });
  return counts;
}

function taxonomyMatchesSelected(value, selectedSet) {
  if (!selectedSet?.size) return true;
  const v = String(value || '').trim();
  return selectedSet.has(v);
}

function taxonomyRefreshCategoryPickers() {
  document.querySelectorAll('[data-category-picker]').forEach((el) => {
    el._categoryPicker?.refreshOptions?.();
  });
}
