function initCategoryPicker(container) {
  if (!container || container.dataset.pickerReady === '1') {
    return container?._categoryPicker || null;
  }
  container.dataset.pickerReady = '1';

  const kind = container.dataset.categoryPicker;
  const hiddenInput = container.querySelector('[name]');
  const trigger = container.querySelector('[data-category-trigger]');
  const dropdown = container.querySelector('[data-category-dropdown]');
  const searchEl = container.querySelector('[data-category-search]');
  const listEl = container.querySelector('[data-category-list]');
  const labelEl = container.querySelector('[data-category-label]');
  let selected = '';
  let open = false;

  const placeholder = kind === 'specialization'
    ? 'Выберите или введите специализацию'
    : 'Выберите или введите отрасль';

  function getItems() {
    return taxonomyGetMergedList(kind);
  }

  function syncHidden() {
    if (hiddenInput) hiddenInput.value = selected;
  }

  function close() {
    if (dropdown) {
      resetPickerDropdown(dropdown);
      dropdown.hidden = true;
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    unbindPickerReposition();
    open = false;
  }

  function repositionPanel() {
    if (!open || !dropdown || !trigger) return;
    positionPickerDropdown(trigger, dropdown);
  }

  function openPanel() {
    if (!dropdown || !trigger) return;
    trigger.setAttribute('aria-expanded', 'true');
    open = true;
    if (searchEl) searchEl.value = '';
    renderList('');
    requestAnimationFrame(() => {
      positionPickerDropdown(trigger, dropdown);
      bindPickerReposition(trigger, dropdown, repositionPanel);
      searchEl?.focus();
    });
  }

  function applyValue(value) {
    selected = String(value || '').trim();
    updateLabel();
    close();
  }

  function updateLabel() {
    if (!labelEl) return;
    labelEl.textContent = selected || placeholder;
    labelEl.classList.toggle('location-picker__value--placeholder', !selected);
    syncHidden();
  }

  function renderCustomFooter(query) {
    const trimmed = query.trim();
    let suggestHtml = '';
    if (trimmed.length >= 2) {
      const items = getItems();
      const exists = items.some((item) => item.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        suggestHtml = `
          <button
            type="button"
            class="location-picker__option location-picker__option--custom"
            data-pick-category="${escapeHtml(trimmed)}"
          >Использовать: «${escapeHtml(trimmed)}»</button>`;
      }
    }

    return `
      ${suggestHtml}
      <div class="location-picker__custom-form">
        <p class="location-picker__custom-hint">Нет в списке — введите свой вариант. После одобрения вакансии он появится в каталоге.</p>
        <div class="location-picker__custom-row">
          <input
            type="text"
            class="input location-picker__custom-input"
            data-category-custom-input
            placeholder="Свой вариант"
            maxlength="120"
            value="${escapeHtml(selected && !getItems().includes(selected) ? selected : '')}"
          />
          <button type="button" class="btn btn--outline btn--sm" data-category-custom-apply>OK</button>
        </div>
      </div>`;
  }

  function renderList(query) {
    if (!listEl) return;
    const q = query.trim().toLowerCase();
    const items = getItems().filter((item) => !q || item.toLowerCase().includes(q));

    let groupsHtml = '';
    if (items.length) {
      const groups = pmrGroupByLetter(items, (item) => item);
      groupsHtml = groups.map(([letter, groupItems]) => `
        <div class="location-picker__group">
          <div class="location-picker__letter">${letter}</div>
          ${groupItems.map((item) => `
            <button
              type="button"
              class="location-picker__option${selected === item ? ' location-picker__option--active' : ''}"
              data-pick-category="${escapeHtml(item)}"
            >${escapeHtml(item)}</button>
          `).join('')}
        </div>
      `).join('');
    } else if (!q) {
      groupsHtml = '<p class="location-picker__empty">Список пуст</p>';
    }

    listEl.innerHTML = groupsHtml + renderCustomFooter(query);

    listEl.querySelector('[data-category-custom-apply]')?.addEventListener('click', () => {
      const input = listEl.querySelector('[data-category-custom-input]');
      const val = input?.value?.trim();
      if (!val) return;
      applyValue(val);
    });

    listEl.querySelector('[data-category-custom-input]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val) applyValue(val);
      }
    });
  }

  const api = {
    setValue(value) {
      selected = String(value || '').trim();
      updateLabel();
      renderList('');
    },
    reset() {
      selected = '';
      if (searchEl) searchEl.value = '';
      close();
      updateLabel();
      renderList('');
    },
    getValue() {
      return selected;
    },
    refreshOptions() {
      renderList(searchEl?.value || '');
      updateLabel();
    }
  };

  container._categoryPicker = api;

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) close();
    else openPanel();
  });

  searchEl?.addEventListener('input', () => {
    renderList(searchEl.value);
    if (open) requestAnimationFrame(repositionPanel);
  });

  listEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-category]');
    if (!btn) return;
    applyValue(btn.dataset.pickCategory || '');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  renderList('');
  updateLabel();

  return api;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-category-picker]').forEach(initCategoryPicker);
});
