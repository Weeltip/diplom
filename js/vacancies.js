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
  let districtFilterExpanded = false;
  let districtSearchQuery   = '';
  let filterScrollEnabled   = false;

  function scrollAfterFilter() {
    if (!filterScrollEnabled) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  const taxonomyOnChange = () => {
    applyClientFilters();
    rerenderList();
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
    for (const key of selectedDistricts) {
      const { city, district } = pmrParseDistrictKey(key);
      if (pmrLocationMatchesDistrict(location, city, district)) return true;
    }
    return false;
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
      if (input.value) selectedDistricts.add(input.value);
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
    return filterSalaryMin <= catalogSalaryMin && filterSalaryMax >= catalogSalaryMax;
  }

  function vacancyMatchesSalary(salaryText) {
    if (!salaryBoundsReady) return true;
    const range = parseSalaryRange(salaryText);
    if (!range) return salaryFilterIsFullRange();
    return range.min <= filterSalaryMax && range.max >= filterSalaryMin;
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

  function rerenderList() {
    currentOffset = 0;
    grid.innerHTML = '';
    const slice = filteredList.slice(0, PAGE_SIZE);
    currentOffset = slice.length;
    if (!slice.length) renderEmptyState();
    else appendSlice(slice);
    renderCountLine();
    updateLoadMore();
    scrollAfterFilter();
  }

  function scheduleDebouncedSearch() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      void loadVacancies(true);
    }, SEARCH_DEBOUNCE_MS);
  }

  function scheduleDebouncedSalary() {
    clearTimeout(salaryDebounce);
    salaryDebounce = setTimeout(() => {
      applyClientFilters();
      updateSalaryLabel();
      rerenderList();
    }, 120);
  }

  function countVacanciesForCity(city, rows) {
    return rows.filter((v) => pmrLocationMatchesCity(v.location, city)).length;
  }

  function countVacanciesForDistrict(city, district, rows) {
    return rows.filter((v) => pmrLocationMatchesDistrict(v.location, city, district)).length;
  }

  function buildCityCounts(rows) {
    cityCounts = new Map();
    PMR_CITIES_ALL.forEach((city) => {
      cityCounts.set(city, countVacanciesForCity(city, rows));
    });
  }

  function buildDistrictCounts(rows) {
    districtCounts = new Map();
    pmrGetAllDistrictEntries().forEach(({ city, district }) => {
      const key = pmrDistrictKey(city, district);
      districtCounts.set(key, countVacanciesForDistrict(city, district, rows));
    });
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

  function renderDistrictCheckbox(entry, idSuffix, showHint = true) {
    const key = pmrDistrictKey(entry.city, entry.district);
    const count = districtCounts.get(key) ?? 0;
    const checked = selectedDistricts.has(key) ? ' checked' : '';
    const safeId = `district-${idSuffix}-${entry.city}-${entry.district}`.replace(/\s+/g, '-');
    const hintHtml = showHint
      ? `<span class="city-filter-item__hint">${escapeHtml(entry.city)}</span>`
      : '';

    return `
      <label class="city-filter-item" data-district-key="${escapeHtml(key)}">
        <input
          type="checkbox"
          class="city-filter-item__input"
          id="${safeId}"
          name="district"
          value="${escapeHtml(key)}"
          ${checked}
        />
        <span class="city-filter-item__name">
          ${escapeHtml(entry.district)}
          ${hintHtml}
        </span>
        <span class="city-filter-item__count">${count.toLocaleString('ru-RU')}</span>
      </label>`;
  }

  function renderCompactDistricts() {
    if (!districtCompactEl) return;
    districtCompactEl.innerHTML = PMR_DISTRICTS_PRIMARY.map((entry, i) =>
      renderDistrictCheckbox(entry, `compact-${i}`, false)
    ).join('');
  }

  function renderExpandedDistricts() {
    if (!districtListEl) return;
    const query = districtSearchQuery.trim().toLowerCase();
    const entries = pmrGetAllDistrictEntries().filter((entry) => {
      if (!query) return true;
      return (
        entry.district.toLowerCase().includes(query)
        || entry.city.toLowerCase().includes(query)
      );
    });

    if (!entries.length) {
      districtListEl.innerHTML = '<p class="city-filter__empty">Район не найден</p>';
      return;
    }

    const groups = pmrGroupByLetter(entries, (entry) => entry.district);
    districtListEl.innerHTML = groups.map(([letter, items]) => `
      <div class="city-filter-group" data-letter="${letter}">
        <div class="city-filter-group__letter" aria-hidden="true">${letter}</div>
        ${items.map((entry, i) => renderDistrictCheckbox(entry, `full-${letter}-${i}`, true)).join('')}
      </div>
    `).join('');
  }

  function syncDistrictCheckboxes() {
    document.querySelectorAll('#district-filter .city-filter-item__input').forEach((input) => {
      input.checked = selectedDistricts.has(input.value);
    });
  }

  function updateDistrictFilterUi() {
    renderCompactDistricts();
    renderExpandedDistricts();
    if (districtExpandBtn) districtExpandBtn.hidden = districtFilterExpanded;
    if (districtExpandedEl) districtExpandedEl.hidden = !districtFilterExpanded;
    if (districtCompactEl) districtCompactEl.hidden = districtFilterExpanded;
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

    buildCityCounts(rows);
    buildDistrictCounts(rows);

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

  async function fetchMatchingVacancies() {
    let q = sb
      .from('vacancies')
      .select('*')
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (currentFilter) q = q.eq('employment_type', currentFilter);
    if (searchQuery) q = q.ilike('title', `%${searchQuery}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function loadVacancies(reset = false) {
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
      scrollAfterFilter();
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
    applyClientFilters();
    rerenderList();
  }

  function onDistrictCheckboxChange(event) {
    const input = event.target.closest('.city-filter-item__input');
    if (!input) return;

    if (input.checked) selectedDistricts.add(input.value);
    else selectedDistricts.delete(input.value);

    syncDistrictCheckboxes();
    applyClientFilters();
    rerenderList();
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
      currentFilter = chip.textContent.trim() === 'Все' ? '' : chip.textContent.trim();
      void loadVacancies(true);
    });
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
    filterScrollEnabled = true;
  })();
});
