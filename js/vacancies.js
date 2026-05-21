document.addEventListener('DOMContentLoaded', () => {
  const grid       = document.getElementById('vacancy-list');
  const wrap       = document.getElementById('vacancy-list-wrap');
  const preloader  = document.getElementById('vacancies-preloader');
  const countEl    = document.getElementById('vacancy-count');
  const searchForm = document.querySelector('.search-bar .search-form');
  const chips      = document.querySelectorAll('.chip');
  const loadMoreBtn = document.getElementById('load-more');

  const SEARCH_DEBOUNCE_MS = 320;
  const PAGE_SIZE           = 6;

  let currentOffset  = 0;
  let currentFilter  = '';
  let searchQuery    = '';
  let searchLocation = '';
  let totalCount     = 0;
  let searchDebounce = null;

  function readFiltersFromDom() {
    if (!searchForm) return;
    searchQuery    = (searchForm.querySelector('[name="keywords"]')?.value || '').trim();
    searchLocation = (searchForm.querySelector('[name="location"]')?.value || '').trim();
  }

  function setPreloader(visible) {
    if (!preloader) return;
    preloader.classList.toggle('vacancies-preloader--visible', visible);
    preloader.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (wrap) wrap.setAttribute('aria-busy', visible ? 'true' : 'false');
  }

  function scheduleDebouncedSearch() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      loadVacancies(true);
    }, SEARCH_DEBOUNCE_MS);
  }

  async function loadVacancies(reset = false) {
    if (reset) {
      readFiltersFromDom();
      setPreloader(true);
      currentOffset = 0;
      grid.innerHTML = '';
    }

    let query = sb
      .from('vacancies')
      .select('*', { count: 'exact' })
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (currentFilter) {
      query = query.eq('employment_type', currentFilter);
    }
    if (searchQuery) {
      query = query.ilike('title', `%${searchQuery}%`);
    }
    if (searchLocation) {
      query = query.ilike('location', `%${searchLocation}%`);
    }

    const { data, count, error } = await query;
    if (error) {
      if (reset) setPreloader(false);
      showToast('Ошибка загрузки вакансий', 'error');
      return;
    }

    totalCount = count ?? 0;
    currentOffset += data.length;

    if (countEl) {
      countEl.textContent = `Показано ${currentOffset} из ${totalCount} · сортировка по дате`;
    }

    data.forEach((v) => {
      grid.insertAdjacentHTML('beforeend', renderVacancyCard(v));
    });

    if (reset && totalCount === 0) {
      grid.innerHTML = `
        <li class="vacancy-empty">
          <p class="auth-form__note vacancy-empty__text">
            Подходящих вакансий не найдено. Измените поиск или фильтры.
          </p>
        </li>`;
    }

    if (loadMoreBtn) {
      loadMoreBtn.hidden = currentOffset >= totalCount;
    }

    if (reset) {
      requestAnimationFrame(() => setPreloader(false));
    }
  }

  function renderVacancyCard(v) {
    const tags = [v.experience, v.employment_type, v.location].filter(Boolean);
    const ribbonHtml = v.is_featured
      ? '<div class="vacancy-card__ribbon">Горячая</div>'
      : '';

    return `<li>
      <article class="vacancy-card${v.is_featured ? ' vacancy-card--featured' : ''}">
        ${ribbonHtml}
        <div class="vacancy-card__top">
          <span class="vacancy-card__employer">${escapeHtml(v.employer)}</span>
          <time class="vacancy-card__date" datetime="${v.created_at}">${formatDate(v.created_at)}</time>
        </div>
        <h3 class="vacancy-card__title">${escapeHtml(v.title)}</h3>
        <p class="vacancy-card__salary">${escapeHtml(v.salary || 'По договорённости')}</p>
        <ul class="vacancy-card__tags">
          ${tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
        <a class="btn btn--link" href="vacancy.html?id=${v.id}">Подробнее</a>
      </article>
    </li>`;
  }

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => e.preventDefault());

    const kwInput = searchForm.querySelector('[name="keywords"]');
    const locInput = searchForm.querySelector('[name="location"]');

    kwInput?.addEventListener('input', scheduleDebouncedSearch);
    locInput?.addEventListener('input', scheduleDebouncedSearch);
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.remove('chip--active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('chip--active');
      chip.setAttribute('aria-pressed', 'true');

      const text = chip.textContent.trim();
      currentFilter = text === 'Все' ? '' : text;

      loadVacancies(true);
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadVacancies(false));
  }

  loadVacancies(true);
});
