function initLocationPicker(container) {
  if (!container || container.dataset.pickerReady === '1') {
    return container?._locationPicker || null;
  }
  container.dataset.pickerReady = '1';

  const hiddenInput = container.querySelector('[name="location"]');
  const cityTrigger = container.querySelector('[data-picker-trigger="city"]');
  const cityDropdown = container.querySelector('[data-picker-dropdown="city"]');
  const citySearch = container.querySelector('[data-picker-search="city"]');
  const cityList = container.querySelector('[data-picker-list="city"]');
  const cityLabel = container.querySelector('[data-picker-label="city"]');
  const districtGroup = container.querySelector('[data-district-group]');
  const districtTrigger = container.querySelector('[data-picker-trigger="district"]');
  const districtDropdown = container.querySelector('[data-picker-dropdown="district"]');
  const districtSearch = container.querySelector('[data-picker-search="district"]');
  const districtList = container.querySelector('[data-picker-list="district"]');
  const districtLabel = container.querySelector('[data-picker-label="district"]');

  let selectedCity = '';
  let selectedDistrict = '';
  let openDropdown = null;

  function syncHidden() {
    if (hiddenInput) {
      hiddenInput.value = pmrFormatLocation(selectedCity, selectedDistrict);
    }
  }

  function closeDropdowns() {
    [cityDropdown, districtDropdown].forEach((el) => {
      if (el) {
        resetPickerDropdown(el);
        el.hidden = true;
      }
    });
    [cityTrigger, districtTrigger].forEach((el) => {
      if (el) el.setAttribute('aria-expanded', 'false');
    });
    unbindPickerReposition();
    openDropdown = null;
  }

  function repositionOpenDropdown() {
    if (!openDropdown) return;
    const dropdown = openDropdown === 'city' ? cityDropdown : districtDropdown;
    const trigger = openDropdown === 'city' ? cityTrigger : districtTrigger;
    positionPickerDropdown(trigger, dropdown);
  }

  function openDropdownPanel(name) {
    closeDropdowns();
    const dropdown = name === 'city' ? cityDropdown : districtDropdown;
    const trigger = name === 'city' ? cityTrigger : districtTrigger;
    if (!dropdown || !trigger) return;
    trigger.setAttribute('aria-expanded', 'true');
    openDropdown = name;
    const search = name === 'city' ? citySearch : districtSearch;
    if (search) {
      search.value = '';
      renderList(name, '');
    }
    requestAnimationFrame(() => {
      positionPickerDropdown(trigger, dropdown);
      bindPickerReposition(trigger, dropdown, repositionOpenDropdown);
      search?.focus();
    });
  }

  function updateLabels() {
    if (cityLabel) {
      cityLabel.textContent = selectedCity || 'Выберите город';
      cityLabel.classList.toggle('location-picker__value--placeholder', !selectedCity);
    }
    if (districtLabel) {
      districtLabel.textContent = selectedDistrict || 'Не обязательно';
      districtLabel.classList.toggle('location-picker__value--placeholder', !selectedDistrict);
    }
    if (districtGroup) {
      const show = selectedCity && pmrCityHasDistricts(selectedCity);
      districtGroup.hidden = !show;
      if (!show) selectedDistrict = '';
    }
    syncHidden();
  }

  function renderCityList(query) {
    if (!cityList) return;
    const q = query.trim().toLowerCase();
    const cities = PMR_CITIES_ALL.filter((city) => !q || city.toLowerCase().includes(q));

    if (!cities.length) {
      cityList.innerHTML = '<p class="location-picker__empty">Город не найден</p>';
      return;
    }

    const groups = pmrGroupByLetter(cities, (c) => c);
    cityList.innerHTML = groups.map(([letter, items]) => `
      <div class="location-picker__group">
        <div class="location-picker__letter">${letter}</div>
        ${items.map((city) => `
          <button
            type="button"
            class="location-picker__option${selectedCity === city ? ' location-picker__option--active' : ''}"
            data-pick-city="${escapeHtml(city)}"
          >${escapeHtml(city)}</button>
        `).join('')}
      </div>
    `).join('');
  }

  function renderDistrictList(query) {
    if (!districtList || !selectedCity) return;
    const districts = pmrGetDistricts(selectedCity);
    const q = query.trim().toLowerCase();
    const filtered = districts.filter((d) => !q || d.toLowerCase().includes(q));

    if (!filtered.length) {
      districtList.innerHTML = '<p class="location-picker__empty">Район не найден</p>';
      return;
    }

    const groups = pmrGroupByLetter(filtered, (d) => d);
    districtList.innerHTML = `
      <button
        type="button"
        class="location-picker__option location-picker__option--muted${!selectedDistrict ? ' location-picker__option--active' : ''}"
        data-pick-district=""
      >Весь город</button>
      ${groups.map(([letter, items]) => `
        <div class="location-picker__group">
          <div class="location-picker__letter">${letter}</div>
          ${items.map((district) => `
            <button
              type="button"
              class="location-picker__option${selectedDistrict === district ? ' location-picker__option--active' : ''}"
              data-pick-district="${escapeHtml(district)}"
            >${escapeHtml(district)}</button>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  function renderList(name, query) {
    if (name === 'city') renderCityList(query);
    else renderDistrictList(query);
  }

  const api = {
    setValue(location) {
      const parsed = pmrParseLocation(location);
      selectedCity = parsed.city;
      selectedDistrict = parsed.district;
      updateLabels();
      renderCityList('');
      renderDistrictList('');
    },
    reset() {
      selectedCity = '';
      selectedDistrict = '';
      if (citySearch) citySearch.value = '';
      if (districtSearch) districtSearch.value = '';
      closeDropdowns();
      updateLabels();
      renderCityList('');
      renderDistrictList('');
    },
    getCity() {
      return selectedCity;
    },
    getDistrict() {
      return selectedDistrict;
    }
  };

  container._locationPicker = api;

  cityTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openDropdown === 'city') closeDropdowns();
    else openDropdownPanel('city');
  });

  districtTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!selectedCity || !pmrCityHasDistricts(selectedCity)) return;
    if (openDropdown === 'district') closeDropdowns();
    else openDropdownPanel('district');
  });

  citySearch?.addEventListener('input', () => {
    renderCityList(citySearch.value);
    if (openDropdown === 'city') requestAnimationFrame(repositionOpenDropdown);
  });
  districtSearch?.addEventListener('input', () => {
    renderDistrictList(districtSearch.value);
    if (openDropdown === 'district') requestAnimationFrame(repositionOpenDropdown);
  });

  cityList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-city]');
    if (!btn) return;
    selectedCity = btn.dataset.pickCity || '';
    selectedDistrict = '';
    updateLabels();
    renderDistrictList('');
    closeDropdowns();
  });

  districtList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-district]');
    if (!btn) return;
    selectedDistrict = btn.dataset.pickDistrict || '';
    updateLabels();
    closeDropdowns();
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) closeDropdowns();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdowns();
  });

  renderCityList('');
  updateLabels();

  return api;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-location-picker]').forEach(initLocationPicker);
});
