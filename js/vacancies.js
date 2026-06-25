document.addEventListener('DOMContentLoaded', () => {
  const grid              = document.getElementById('vacancy-list');
  const wrap              = document.getElementById('vacancy-list-wrap');
  const preloader         = document.getElementById('vacancies-preloader');
  const countEl           = document.getElementById('vacancy-count');
  const searchForm        = document.querySelector('.search-form');
  const chips             = document.querySelectorAll('.chips--sidebar .chip');
  const loadMoreBtn       = document.getElementById('load-more');
  const salaryBlock       = document.getElementById('salary-filter');
  const salaryMinEl       = document.getElementById('salary-min');
  const salaryMaxEl       = document.getElementById('salary-max');
  const salaryLabel       = document.getElementById('salary-range-label');
  const cityCompactEl     = document.getElementById('city-filter-compact');
  const cityExpandBtn     = document.getElementById('city-filter-expand');
  const cityExpandedEl    = document.getElementById('city-filter-expanded');
  const cityCollapseBtn   = document.getElementById('city-filter-collapse');
  const cityListEl        = document.getElementById('city-filter-list');
  const citySearchEl      = document.getElementById('city-search');
  const districtCompactEl = document.getElementById('district-filter-compact');
  const districtExpandBtn = document.getElementById('district-filter-expand');
  const districtExpandedEl = document.getElementById('district-filter-expanded');
  const districtCollapseBtn = document.getElementById('district-filter-collapse');
  const districtListEl    = document.getElementById('district-filter-list');
  const districtSearchEl  = document.getElementById('district-search');
  const applyFiltersBtn   = document.getElementById('vacancies-apply-filters');
  const applyFiltersCount = document.getElementById('vacancies-apply-count');
  const resetFiltersBtn   = document.getElementById('vacancies-reset-filters');

  const SEARCH_DEBOUNCE_MS = 320;
  const PAGE_SIZE          = 6;

  let currentOffset       = 0;
  let currentFilter       = '';
  let searchQuery         = '';
  let serverRows          = [];
  let filteredList        = [];
  let catalogSalaryMin    = 0;
  let catalogSalaryMax    = 0;
  let filterSalaryMin     = 0;
  let filterSalaryMax     = 0;
  let searchDebounce      = null;
  let salaryDebounce      = null;
  let salaryBoundsReady   = false;
  let selectedCities      = new Set();
  let cityCounts          = new Map();
  let cityFilterExpanded    = false;
  let citySearchQuery       = '';
  let selectedDistricts     = new Set();
  let districtCounts        = new Map();
  let geoCountRows          = [];
  let districtFilterExpanded = false;
  let districtSearchQuery   = '';
  let filterScrollEnabled   = false;
  let appliedSidebarState   = null;
  let applyPreviewToken     = 0;
  let applyPreviewDebounce  = null;

  function scrollAfterFilter() {
    if (!filterScrollEnabled) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  function cloneSet(set) {
    return new Set(set);
  }

  function getActiveEmploymentChip() {
    const active = document.querySelector('.chips--sidebar .chip--active');
    if (!active) return '';
    const label = active.textContent.trim();
    return label === 'Все' ? '' : label;
  }

  function captureSidebarState() {
    readSelectedCitiesFromDom();
    readSelectedDistrictsFromDom();
    specializationFilter.readSelectedFromDom();
    industryFilter.readSelectedFromDom();
    readSalaryFilterFromDom();
    return {
      cities: cloneSet(selectedCities),
      districts: cloneSet(selectedDistricts),
      spec: cloneSet(specializationFilter.getSelected()),
      industry: cloneSet(industryFilter.getSelected()),
      experience: experienceFilter.getSelected(),
      salaryMin: filterSalaryMin,
      salaryMax: filterSalaryMax,
      employment: getActiveEmploymentChip()
    };
  }

  function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }

  function isSidebarDirty() {
    if (!appliedSidebarState) return false;
    const pending = captureSidebarState();
    const a = appliedSidebarState;
    return (
      !setsEqual(pending.cities, a.cities)
      || !setsEqual(pending.districts, a.districts)
      || !setsEqual(pending.spec, a.spec)
      || !setsEqual(pending.industry, a.industry)
      || pending.experience !== a.experience
      || pending.salaryMin !== a.salaryMin
      || pending.salaryMax !== a.salaryMax
      || pending.employment !== a.employment
    );
  }

  function isSidebarStateDefault(state) {
    if (!state) return true;
    return (
      state.cities.size === 0
      && state.districts.size === 0
      && state.spec.size === 0
      && state.industry.size === 0
      && state.experience === 'any'
      && salaryRangeIsFull(state.salaryMin, state.salaryMax)
      && !state.employment
    );
  }

  function canResetSidebarFilters() {
    if (!appliedSidebarState) return false;
    return isSidebarDirty() || !isSidebarStateDefault(appliedSidebarState);
  }

  function vacancyMatchesCitiesFromSet(location, cities) {
    if (!cities.size) return true;
    for (const city of cities) {
      if (pmrLocationMatchesCity(location, city)) return true;
    }
    return false;
  }

  function vacancyMatchesDistrictsFromSet(location, districts, cities) {
    if (!districts.size) return true;
    for (const districtName of districts) {
      if (pmrLocationMatchesDistrictName(location, districtName, cities)) return true;
    }
    return false;
  }

  function salaryRangeIsFull(min, max) {
    if (!salaryBoundsReady) return true;
    return min <= catalogSalaryMin && max >= catalogSalaryMax;
  }

  function vacancyMatchesSalaryRange(salaryText, min, max) {
    if (!salaryBoundsReady) return true;
    if (salaryRangeIsFull(min, max)) return true;
    const range = parseSalaryRange(salaryText);
    if (!range) return salaryRangeIsFull(min, max);
    return range.min <= max && range.max >= min;
  }

  function filterRowsWithState(rows, state) {
    const expFilter = state.experience;
    let list = rows
      .filter((v) => vacancyMatchesCitiesFromSet(v.location, state.cities))
      .filter((v) => vacancyMatchesDistrictsFromSet(v.location, state.districts, state.cities))
      .filter((v) => taxonomyMatchesSelected(v.specialization, state.spec))
      .filter((v) => taxonomyMatchesSelected(v.industry, state.industry))
      .filter((v) => vacancyMatchesExperienceFilter(v.experience, expFilter));
    if (salaryBoundsReady) {
      list = list.filter((v) => vacancyMatchesSalaryRange(v.salary, state.salaryMin, state.salaryMax));
    }
    return list;
  }

  function hideApplyFiltersButton() {
    if (applyFiltersBtn) applyFiltersBtn.hidden = true;
  }

  function updateResetFiltersButton() {
    if (!resetFiltersBtn || !filterScrollEnabled) return;
    resetFiltersBtn.disabled = !canResetSidebarFilters();
  }

  function resetSidebarFiltersUi() {
    selectedCities.clear();
    selectedDistricts.clear();
    setCityFilterExpanded(false);
    setDistrictFilterExpanded(false);
    updateCityFilterUi();
    updateDistrictFilterUi();

    document
      .querySelectorAll(
        '#specialization-filter .city-filter-item__input:checked, #industry-filter .city-filter-item__input:checked'
      )
      .forEach((input) => {
        input.checked = false;
      });
    specializationFilter.readSelectedFromDom();
    industryFilter.readSelectedFromDom();
    specializationFilter.render();
    industryFilter.render();

    const anyExperience = document.querySelector('#experience-filter input[value="any"]');
    if (anyExperience) anyExperience.checked = true;
    experienceFilter.readSelectedFromDom();
    experienceFilter.render();

    if (salaryBoundsReady && salaryMinEl && salaryMaxEl) {
      filterSalaryMin = catalogSalaryMin;
      filterSalaryMax = catalogSalaryMax;
      salaryMinEl.value = String(catalogSalaryMin);
      salaryMaxEl.value = String(catalogSalaryMax);
      updateSalaryLabel();
    }

    chips.forEach((chip) => {
      const isAll = chip.textContent.trim() === 'Все';
      chip.classList.toggle('chip--active', isAll);
      chip.setAttribute('aria-pressed', isAll ? 'true' : 'false');
    });
    currentFilter = '';
  }

  async function resetSidebarFilters() {
    if (!canResetSidebarFilters()) return;

    resetSidebarFiltersUi();
    if (resetFiltersBtn) resetFiltersBtn.disabled = true;
    if (applyFiltersBtn) applyFiltersBtn.disabled = true;
    setPreloader(true);

    try {
      serverRows = await fetchVacancyRows('', searchQuery);
      applyClientFilters();
      appliedSidebarState = captureSidebarState();
      rerenderList({ scroll: true });
      hideApplyFiltersButton();
    } catch (err) {
      console.error(err);
      showToast('Не удалось сбросить фильтры', 'error');
    } finally {
      updateResetFiltersButton();
      requestAnimationFrame(() => setPreloader(false));
    }
  }

  async function refreshApplyFiltersButton() {
    if (!applyFiltersBtn || !filterScrollEnabled) return;

    if (!isSidebarDirty()) {
      hideApplyFiltersButton();
      updateResetFiltersButton();
      return;
    }

    applyFiltersBtn.hidden = false;
    applyFiltersBtn.disabled = true;
    if (applyFiltersCount) applyFiltersCount.textContent = '…';

    const token = ++applyPreviewToken;
    const pending = captureSidebarState();

    try {
      let rows = serverRows;
      if (pending.employment !== appliedSidebarState.employment) {
        rows = await fetchVacancyRows(pending.employment, searchQuery);
      }
      if (token !== applyPreviewToken) return;
      const count = filterRowsWithState(rows, pending).length;
      if (applyFiltersCount) applyFiltersCount.textContent = count.toLocaleString('ru-RU');
      applyFiltersBtn.disabled = false;
      updateResetFiltersButton();
    } catch (err) {
      console.error(err);
      if (applyFiltersCount) applyFiltersCount.textContent = '?';
      applyFiltersBtn.disabled = false;
      updateResetFiltersButton();
    }
  }

  function onSidebarFilterChange() {
    clearTimeout(applyPreviewDebounce);
    applyPreviewDebounce = setTimeout(() => {
      void refreshApplyFiltersButton();
    }, 120);
  }

  async function applyPendingSidebarFilters() {
    const state = captureSidebarState();
    currentFilter = state.employment;
    if (applyFiltersBtn) applyFiltersBtn.disabled = true;
    setPreloader(true);

    try {
      serverRows = await fetchVacancyRows(state.employment, searchQuery);
      applyClientFilters();
      appliedSidebarState = state;
      rerenderList({ scroll: true });
      hideApplyFiltersButton();
      updateResetFiltersButton();
    } catch (err) {
      console.error(err);
      showToast('Ошибка применения фильтров', 'error');
      if (applyFiltersBtn) applyFiltersBtn.disabled = false;
    } finally {
      requestAnimationFrame(() => setPreloader(false));
    }
  }

  const taxonomyOnChange = () => {
    onSidebarFilterChange();
  };

  const specializationFilter = createTaxonomySidebarFilter({
    root: document.getElementById('specialization-filter'),
    allItems: TAXONOMY_SPECIALIZATIONS,
    primaryItems: TAXONOMY_SPECIALIZATIONS_PRIMARY,
    onChange: taxonomyOnChange
  });

  const industryFilter = createTaxonomySidebarFilter({
    root: document.getElementById('industry-filter'),
    allItems: TAXONOMY_INDUSTRIES,
    primaryItems: TAXONOMY_INDUSTRIES_PRIMARY,
    onChange: taxonomyOnChange
  });

  const experienceFilter = createExperienceSidebarFilter({
    root: document.getElementById('experience-filter'),
    onChange: taxonomyOnChange
  });

  function vacancyMatchesSelectedCities(location) {
    if (!selectedCities.size) return true;
    for (const city of selectedCities) {
      if (pmrLocationMatchesCity(location, city)) return true;
    }
    return false;
  }

  function vacancyMatchesSelectedDistricts(location) {
    if (!selectedDistricts.size) return true;
    for (const districtName of selectedDistricts) {
      if (pmrLocationMatchesDistrictName(location, districtName, selectedCities)) return true;
    }
    return false;
  }

  function normalizeDistrictValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.includes('|')) return pmrParseDistrictKey(raw).district;
    return raw;
  }

  function pruneSelectedDistricts() {
    const available = new Set(pmrGetDistrictNamesForCities(selectedCities));
    selectedDistricts = new Set(
      [...selectedDistricts]
        .map(normalizeDistrictValue)
        .filter((district) => district && available.has(district))
    );
  }

  function readFiltersFromDom() {
    if (!searchForm) return;
    searchQuery = (searchForm.querySelector('[name="keywords"]')?.value || '').trim();
  }

  function readSelectedCitiesFromDom() {
    selectedCities = new Set();
    document.querySelectorAll('#city-filter .city-filter-item__input:checked').forEach((input) => {
      if (input.value) selectedCities.add(input.value);
    });
  }

  function readSelectedDistrictsFromDom() {
    selectedDistricts = new Set();
    document.querySelectorAll('#district-filter .city-filter-item__input:checked').forEach((input) => {
      const district = normalizeDistrictValue(input.value);
      if (district) selectedDistricts.add(district);
    });
  }

  function readSalaryFilterFromDom() {
    if (!salaryMinEl || !salaryMaxEl) return;
    filterSalaryMin = parseInt(salaryMinEl.value, 10);
    filterSalaryMax = parseInt(salaryMaxEl.value, 10);
    if (!Number.isFinite(filterSalaryMin)) filterSalaryMin = catalogSalaryMin;
    if (!Number.isFinite(filterSalaryMax)) filterSalaryMax = catalogSalaryMax;
    if (filterSalaryMin > filterSalaryMax) {
      const t = filterSalaryMin;
      filterSalaryMin = filterSalaryMax;
      filterSalaryMax = t;
      salaryMinEl.value = String(filterSalaryMin);
      salaryMaxEl.value = String(filterSalaryMax);
    }
  }

  function updateSalaryLabel() {
    if (!salaryLabel) return;
    salaryLabel.textContent = `${formatSalaryAmount(filterSalaryMin)} — ${formatSalaryAmount(filterSalaryMax)}`;
  }

  function setPreloader(visible) {
    if (!preloader) return;
    preloader.classList.toggle('vacancies-preloader--visible', visible);
    preloader.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (wrap) wrap.setAttribute('aria-busy', visible ? 'true' : 'false');
  }

  function salaryFilterIsFullRange() {
    if (!salaryBoundsReady) return true;
    return salaryRangeIsFull(filterSalaryMin, filterSalaryMax);
  }

  function vacancyMatchesSalary(salaryText) {
    return vacancyMatchesSalaryRange(salaryText, filterSalaryMin, filterSalaryMax);
  }

  function applyClientFilters() {
    readSelectedCitiesFromDom();
    readSelectedDistrictsFromDom();
    specializationFilter.readSelectedFromDom();
    industryFilter.readSelectedFromDom();
    experienceFilter.readSelectedFromDom();
    readSalaryFilterFromDom();

    const expFilter = experienceFilter.getSelected();
    let rows = serverRows
      .filter((v) => vacancyMatchesSelectedCities(v.location))
      .filter((v) => vacancyMatchesSelectedDistricts(v.location))
      .filter((v) => taxonomyMatchesSelected(v.specialization, specializationFilter.getSelected()))
      .filter((v) => taxonomyMatchesSelected(v.industry, industryFilter.getSelected()))
      .filter((v) => vacancyMatchesExperienceFilter(v.experience, expFilter));
    if (!salaryBoundsReady) {
      filteredList = rows;
      return;
    }
    filteredList = rows.filter((v) => vacancyMatchesSalary(v.salary));
  }

  function renderCountLine() {
    if (!countEl) return;
    const notes = [];
    if (selectedCities.size) notes.push('фильтр по городу');
    if (selectedDistricts.size) notes.push('фильтр по району');
    if (specializationFilter.getSelected().size) notes.push('специализация');
    if (industryFilter.getSelected().size) notes.push('отрасль');
    if (experienceFilter.getSelected() && experienceFilter.getSelected() !== 'any') {
      notes.push('опыт');
    }
    if (!salaryFilterIsFullRange()) notes.push('фильтр по зарплате');
    const noteText = notes.length ? ` · ${notes.join(', ')}` : '';
    countEl.textContent = `Показано ${currentOffset} из ${filteredList.length} · сортировка по дате${noteText}`;
  }

  function renderEmptyState() {
    grid.innerHTML = `
      <li class="vacancy-empty">
        <p class="auth-form__note vacancy-empty__text">
          Подходящих вакансий не найдено. Измените поиск, город, зарплату или фильтры.
        </p>
      </li>`;
  }

  function appendSlice(slice) {
    slice.forEach((v) => {
      grid.insertAdjacentHTML('beforeend', renderVacancyCard(v));
    });
  }

  function updateLoadMore() {
    if (loadMoreBtn) {
      loadMoreBtn.hidden = currentOffset >= filteredList.length;
    }
  }

  function rerenderList(options = {}) {
    currentOffset = 0;
    grid.innerHTML = '';
    const slice = filteredList.slice(0, PAGE_SIZE);
    currentOffset = slice.length;
    if (!slice.length) renderEmptyState();
    else appendSlice(slice);
    renderCountLine();
    updateLoadMore();
    if (options.scroll) scrollAfterFilter();
  }

  function scheduleDebouncedSearch() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      void loadVacancies(true, { scroll: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  function scheduleDebouncedSalary() {
    clearTimeout(salaryDebounce);
    salaryDebounce = setTimeout(() => {
      readSalaryFilterFromDom();
      updateSalaryLabel();
      onSidebarFilterChange();
    }, 120);
  }

  function countVacanciesForCity(city, rows) {
    return rows.filter((v) => pmrLocationMatchesCity(v.location, city)).length;
  }

  function countVacanciesForDistrictName(districtName, rows, scopeCities) {
    return rows.filter((v) => pmrLocationMatchesDistrictName(v.location, districtName, scopeCities)).length;
  }

  function buildCityCounts(rows) {
    cityCounts = new Map();
    PMR_CITIES_ALL.forEach((city) => {
      cityCounts.set(city, countVacanciesForCity(city, rows));
    });
  }

  function buildDistrictCounts(rows) {
    districtCounts = new Map();
    pmrGetDistrictNamesForCities(selectedCities).forEach((districtName) => {
      districtCounts.set(
        districtName,
        countVacanciesForDistrictName(districtName, rows, selectedCities)
      );
    });
  }

  function getVisibleDistrictNames() {
    return pmrGetDistrictNamesForCities(selectedCities);
  }

  function getCompactDistrictNames() {
    const available = new Set(getVisibleDistrictNames());
    return PMR_DISTRICTS_PRIMARY.filter((district) => available.has(district));
  }

  function renderDistrictCheckbox(districtName, idSuffix) {
    const count = districtCounts.get(districtName)
      ?? countVacanciesForDistrictName(districtName, geoCountRows, selectedCities);
    const checked = selectedDistricts.has(districtName) ? ' checked' : '';
    const safeId = `district-${idSuffix}-${districtName}`.replace(/\s+/g, '-');

    return `
      <label class="city-filter-item" data-district-name="${escapeHtml(districtName)}">
        <input
          type="checkbox"
          class="city-filter-item__input"
          id="${safeId}"
          name="district"
          value="${escapeHtml(districtName)}"
          ${checked}
        />
        <span class="city-filter-item__name">${escapeHtml(districtName)}</span>
        <span class="city-filter-item__count">${count.toLocaleString('ru-RU')}</span>
      </label>`;
  }

  function renderCompactDistricts() {
    if (!districtCompactEl) return;
    districtCompactEl.innerHTML = getCompactDistrictNames()
      .map((districtName, i) => renderDistrictCheckbox(districtName, `compact-${i}`))
      .join('');
  }

  function renderExpandedDistricts() {
    if (!districtListEl) return;
    const query = districtSearchQuery.trim().toLowerCase();
    const names = getVisibleDistrictNames().filter((districtName) => {
      if (!query) return true;
      return districtName.toLowerCase().includes(query);
    });

    if (!names.length) {
      districtListEl.innerHTML = '<p class="city-filter__empty">Район не найден</p>';
      return;
    }

    const groups = pmrGroupByLetter(names, (districtName) => districtName);
    districtListEl.innerHTML = groups.map(([letter, items]) => `
      <div class="city-filter-group" data-letter="${letter}">
        <div class="city-filter-group__letter" aria-hidden="true">${letter}</div>
        ${items.map((districtName, i) => renderDistrictCheckbox(districtName, `full-${letter}-${i}`)).join('')}
      </div>
    `).join('');
  }

  function syncDistrictCheckboxes() {
    document.querySelectorAll('#district-filter .city-filter-item__input').forEach((input) => {
      input.checked = selectedDistricts.has(normalizeDistrictValue(input.value));
    });
  }

  function updateDistrictFilterUi() {
    buildDistrictCounts(geoCountRows);
    renderCompactDistricts();
    renderExpandedDistricts();
    if (districtExpandBtn) districtExpandBtn.hidden = districtFilterExpanded;
    if (districtExpandedEl) districtExpandedEl.hidden = !districtFilterExpanded;
    if (districtCompactEl) districtCompactEl.hidden = districtFilterExpanded;
  }

  function renderCityCheckbox(city, idSuffix) {
    const count = cityCounts.get(city) ?? 0;
    const checked = selectedCities.has(city) ? ' checked' : '';
    const safeId = `city-${idSuffix}-${city.replace(/\s+/g, '-')}`;
    return `
      <label class="city-filter-item" data-city="${escapeHtml(city)}">
        <input
          type="checkbox"
          class="city-filter-item__input"
          id="${safeId}"
          name="city"
          value="${escapeHtml(city)}"
          ${checked}
        />
        <span class="city-filter-item__name">${escapeHtml(city)}</span>
        <span class="city-filter-item__count">${count.toLocaleString('ru-RU')}</span>
      </label>`;
  }

  function renderCompactCities() {
    if (!cityCompactEl) return;
    cityCompactEl.innerHTML = PMR_CITIES_PRIMARY.map((city, i) => renderCityCheckbox(city, `compact-${i}`)).join('');
  }

  function setDistrictFilterExpanded(expanded) {
    districtFilterExpanded = expanded;
    if (!expanded) {
      districtSearchQuery = '';
      if (districtSearchEl) districtSearchEl.value = '';
    }
    updateDistrictFilterUi();
  }

  function renderExpandedCities() {
    if (!cityListEl) return;
    const query = citySearchQuery.trim().toLowerCase();
    const cities = PMR_CITIES_ALL.filter((city) => !query || city.toLowerCase().includes(query));

    if (!cities.length) {
      cityListEl.innerHTML = '<p class="city-filter__empty">Город не найден</p>';
      return;
    }

    const groups = pmrGroupByLetter(cities, (city) => city);
    cityListEl.innerHTML = groups.map(([letter, items]) => `
      <div class="city-filter-group" data-letter="${letter}">
        <div class="city-filter-group__letter" aria-hidden="true">${letter}</div>
        ${items.map((city, i) => renderCityCheckbox(city, `full-${letter}-${i}`)).join('')}
      </div>
    `).join('');
  }

  function syncCityCheckboxes() {
    document.querySelectorAll('#city-filter .city-filter-item__input').forEach((input) => {
      input.checked = selectedCities.has(input.value);
    });
  }

  function updateCityFilterUi() {
    renderCompactCities();
    renderExpandedCities();
    if (cityExpandBtn) cityExpandBtn.hidden = cityFilterExpanded;
    if (cityExpandedEl) cityExpandedEl.hidden = !cityFilterExpanded;
    if (cityCompactEl) cityCompactEl.hidden = cityFilterExpanded;
  }

  function setCityFilterExpanded(expanded) {
    cityFilterExpanded = expanded;
    if (!expanded) {
      citySearchQuery = '';
      if (citySearchEl) citySearchEl.value = '';
    }
    updateCityFilterUi();
  }

  async function fetchPublishedLocationRows() {
    const full = await sb
      .from('vacancies')
      .select('location, specialization, industry, experience')
      .eq('is_published', true);

    if (!full.error) return full.data || [];

    const fallback = await sb
      .from('vacancies')
      .select('location')
      .eq('is_published', true);

    if (fallback.error) {
      console.error(fallback.error);
      return [];
    }
    return fallback.data || [];
  }

  async function initGeoFilters() {
    updateCityFilterUi();
    updateDistrictFilterUi();

    const rows = await fetchPublishedLocationRows();
    const taxRows = await taxonomyRefreshPublishedExtras(sb);

    geoCountRows = rows;
    buildCityCounts(rows);

    const mergedSpec = taxonomyGetMergedList('specialization');
    const mergedInd = taxonomyGetMergedList('industry');
    specializationFilter.setAllItems(mergedSpec);
    industryFilter.setAllItems(mergedInd);
    specializationFilter.setCounts(taxonomyBuildCounts(taxRows, 'specialization', mergedSpec));
    industryFilter.setCounts(taxonomyBuildCounts(taxRows, 'industry', mergedInd));
    experienceFilter.setCounts(buildExperienceCounts(rows));

    updateCityFilterUi();
    updateDistrictFilterUi();
  }

  async function initSalaryBounds() {
    const { data, error } = await sb
      .from('vacancies')
      .select('salary')
      .eq('is_published', true);

    if (error) return;

    const mins = [];
    const maxs = [];
    (data || []).forEach((row) => {
      const r = parseSalaryRange(row.salary);
      if (r) {
        mins.push(r.min);
        maxs.push(r.max);
      }
    });

    if (!mins.length) {
      salaryBoundsReady = false;
      if (salaryBlock) salaryBlock.hidden = true;
      return;
    }

    catalogSalaryMin = Math.min(...mins);
    catalogSalaryMax = Math.max(...maxs);
    salaryBoundsReady = true;
    filterSalaryMin = catalogSalaryMin;
    filterSalaryMax = catalogSalaryMax;

    const span = Math.max(catalogSalaryMax - catalogSalaryMin, 0);
    const step = span >= 5000 ? 500 : span >= 2000 ? 200 : span > 0 ? 100 : 50;

    [salaryMinEl, salaryMaxEl].forEach((el) => {
      if (!el) return;
      el.min = String(catalogSalaryMin);
      el.max = String(Math.max(catalogSalaryMax, catalogSalaryMin + step));
      el.step = String(step);
    });

    if (salaryMinEl) salaryMinEl.value = String(catalogSalaryMin);
    if (salaryMaxEl) salaryMaxEl.value = String(catalogSalaryMax);

    updateSalaryLabel();
    if (salaryBlock) salaryBlock.hidden = false;
  }

  async function fetchVacancyRows(employmentType, keywords) {
    let q = sb
      .from('vacancies')
      .select('*')
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (employmentType) q = q.eq('employment_type', employmentType);
    if (keywords) q = q.ilike('title', `%${keywords}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function fetchMatchingVacancies() {
    return fetchVacancyRows(currentFilter, searchQuery);
  }

  async function loadVacancies(reset = false, options = {}) {
    if (reset) {
      readFiltersFromDom();
      setPreloader(true);
      currentOffset = 0;
      grid.innerHTML = '';

      try {
        serverRows = await fetchMatchingVacancies();
        applyClientFilters();
      } catch (err) {
        setPreloader(false);
        console.error(err);
        showToast('Ошибка загрузки вакансий', 'error');
        return;
      }

      const slice = filteredList.slice(0, PAGE_SIZE);
      currentOffset = slice.length;
      if (!slice.length) renderEmptyState();
      else appendSlice(slice);

      renderCountLine();
      updateLoadMore();
      appliedSidebarState = captureSidebarState();
      hideApplyFiltersButton();
      updateResetFiltersButton();
      if (options.scroll) scrollAfterFilter();
      requestAnimationFrame(() => setPreloader(false));
      return;
    }

    const slice = filteredList.slice(currentOffset, currentOffset + PAGE_SIZE);
    currentOffset += slice.length;
    appendSlice(slice);
    renderCountLine();
    updateLoadMore();
  }

  function renderVacancyCard(v) {
    return renderVacancyCardHtml(v, 'list');
  }

  function onCityCheckboxChange(event) {
    const input = event.target.closest('.city-filter-item__input');
    if (!input) return;

    if (input.checked) selectedCities.add(input.value);
    else selectedCities.delete(input.value);

    syncCityCheckboxes();
    pruneSelectedDistricts();
    updateDistrictFilterUi();
    syncDistrictCheckboxes();
    onSidebarFilterChange();
  }

  function onDistrictCheckboxChange(event) {
    const input = event.target.closest('.city-filter-item__input');
    if (!input) return;

    const district = normalizeDistrictValue(input.value);
    if (!district) return;

    if (input.checked) selectedDistricts.add(district);
    else selectedDistricts.delete(district);

    syncDistrictCheckboxes();
    onSidebarFilterChange();
  }

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => e.preventDefault());
    searchForm.querySelector('[name="keywords"]')?.addEventListener('input', scheduleDebouncedSearch);
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.remove('chip--active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('chip--active');
      chip.setAttribute('aria-pressed', 'true');
      onSidebarFilterChange();
    });
  });

  applyFiltersBtn?.addEventListener('click', () => {
    void applyPendingSidebarFilters();
  });

  resetFiltersBtn?.addEventListener('click', () => {
    void resetSidebarFilters();
  });

  document.getElementById('city-filter')?.addEventListener('change', onCityCheckboxChange);
  document.getElementById('district-filter')?.addEventListener('change', onDistrictCheckboxChange);

  cityExpandBtn?.addEventListener('click', () => setCityFilterExpanded(true));
  cityCollapseBtn?.addEventListener('click', () => setCityFilterExpanded(false));

  districtExpandBtn?.addEventListener('click', () => setDistrictFilterExpanded(true));
  districtCollapseBtn?.addEventListener('click', () => setDistrictFilterExpanded(false));

  citySearchEl?.addEventListener('input', () => {
    citySearchQuery = citySearchEl.value;
    renderExpandedCities();
    syncCityCheckboxes();
  });

  districtSearchEl?.addEventListener('input', () => {
    districtSearchQuery = districtSearchEl.value;
    renderExpandedDistricts();
    syncDistrictCheckboxes();
  });

  salaryMinEl?.addEventListener('input', () => {
    if (parseInt(salaryMinEl.value, 10) > parseInt(salaryMaxEl.value, 10)) {
      salaryMaxEl.value = salaryMinEl.value;
    }
    scheduleDebouncedSalary();
  });

  salaryMaxEl?.addEventListener('input', () => {
    if (parseInt(salaryMaxEl.value, 10) < parseInt(salaryMinEl.value, 10)) {
      salaryMinEl.value = salaryMaxEl.value;
    }
    scheduleDebouncedSalary();
  });

  loadMoreBtn?.addEventListener('click', () => { void loadVacancies(false); });

  updateCityFilterUi();
  updateDistrictFilterUi();

  void (async () => {
    await Promise.all([initGeoFilters(), initSalaryBounds()]);
    await loadVacancies(true);
    appliedSidebarState = captureSidebarState();
    filterScrollEnabled = true;
    updateResetFiltersButton();
  })();
});
