function createTaxonomySidebarFilter(config) {
  const {
    root,
    allItems: initialItems,
    primaryItems,
    expandLabel = 'Выбрать ещё',
    collapseLabel = 'Свернуть',
    emptyLabel = 'Ничего не найдено',
    onChange
  } = config;

  if (!root) {
    return {
      getSelected: () => new Set(),
      readSelectedFromDom: () => {},
      setCounts: () => {},
      render: () => {}
    };
  }

  const compactEl = root.querySelector('[data-taxonomy-compact]');
  const expandBtn = root.querySelector('[data-taxonomy-expand]');
  const expandedEl = root.querySelector('[data-taxonomy-expanded]');
  const collapseBtn = root.querySelector('[data-taxonomy-collapse]');
  const listEl = root.querySelector('[data-taxonomy-list]');
  const searchEl = root.querySelector('[data-taxonomy-search]');

  let allItems = [...initialItems];
  let selected = new Set();
  let counts = new Map();
  let expanded = false;
  let searchQuery = '';

  function renderCheckbox(item, idSuffix) {
    const count = counts.get(item) ?? 0;
    const checked = selected.has(item) ? ' checked' : '';
    const safeId = `${root.id}-${idSuffix}-${item}`.replace(/[^\wа-яА-ЯёЁ-]+/gi, '-');

    return `
      <label class="city-filter-item">
        <input
          type="checkbox"
          class="city-filter-item__input"
          id="${safeId}"
          value="${escapeHtml(item)}"
          ${checked}
        />
        <span class="city-filter-item__name">${escapeHtml(item)}</span>
        <span class="city-filter-item__count">${count.toLocaleString('ru-RU')}</span>
      </label>`;
  }

  function renderCompact() {
    if (!compactEl) return;
    compactEl.innerHTML = primaryItems.map((item, i) => renderCheckbox(item, `c-${i}`)).join('');
  }

  function renderExpanded() {
    if (!listEl) return;
    const q = searchQuery.trim().toLowerCase();
    const items = allItems.filter((item) => !q || item.toLowerCase().includes(q));

    if (!items.length) {
      listEl.innerHTML = `<p class="city-filter__empty">${escapeHtml(emptyLabel)}</p>`;
      return;
    }

    const groups = pmrGroupByLetter(items, (item) => item);
    listEl.innerHTML = groups.map(([letter, groupItems]) => `
      <div class="city-filter-group" data-letter="${letter}">
        <div class="city-filter-group__letter" aria-hidden="true">${letter}</div>
        ${groupItems.map((item, i) => renderCheckbox(item, `f-${letter}-${i}`)).join('')}
      </div>
    `).join('');
  }

  function syncCheckboxes() {
    root.querySelectorAll('.city-filter-item__input').forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function render() {
    renderCompact();
    renderExpanded();
    if (expandBtn) {
      expandBtn.hidden = expanded;
      expandBtn.textContent = expandLabel;
    }
    if (expandedEl) expandedEl.hidden = !expanded;
    if (compactEl) compactEl.hidden = expanded;
    if (collapseBtn) collapseBtn.textContent = collapseLabel;
  }

  function setExpanded(value) {
    expanded = value;
    if (!expanded) {
      searchQuery = '';
      if (searchEl) searchEl.value = '';
    }
    render();
  }

  function onCheckboxChange(event) {
    const input = event.target.closest('.city-filter-item__input');
    if (!input) return;

    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);

    syncCheckboxes();
    onChange?.();
  }

  root.addEventListener('change', onCheckboxChange);
  expandBtn?.addEventListener('click', () => setExpanded(true));
  collapseBtn?.addEventListener('click', () => setExpanded(false));
  searchEl?.addEventListener('input', () => {
    searchQuery = searchEl.value;
    renderExpanded();
    syncCheckboxes();
  });

  render();

  return {
    getSelected() {
      return selected;
    },
    readSelectedFromDom() {
      selected = new Set();
      root.querySelectorAll('.city-filter-item__input:checked').forEach((input) => {
        if (input.value) selected.add(input.value);
      });
    },
    setCounts(newCounts) {
      counts = newCounts;
      render();
    },
    setAllItems(items) {
      allItems = [...items];
      render();
    },
    render
  };
}
