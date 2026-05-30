(function () {
  const RESPONSES_LIMIT = 150;
  const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];
  const EXPORT_LIMIT = 5000;

  const REJECT_REASON_TEXTS = {
    incomplete: 'Неполное описание вакансии или отсутствуют обязательные сведения.',
    unreliable: 'Недостоверные сведения об организации, оплате или условиях труда.',
    rules: 'Нарушение правил размещения объявлений центра занятости.',
    duplicate: 'Дублирование ранее опубликованной вакансии.',
    contacts: 'Некорректные или непроверяемые контактные данные работодателя.'
  };

  function hideAdminPageLoader() {
    const el = document.getElementById('admin-page-loader');
    if (!el || el.dataset.done === '1') return;
    el.dataset.done = '1';
    el.classList.add('page-loader--hide');
    el.setAttribute('aria-busy', 'false');
    window.setTimeout(() => {
      el.hidden = true;
    }, 420);
  }

  let currentUserId = null;
  let vacPage = 1;
  let vacPageSize = 5;
  let vacTotalCount = 0;
  let vacSearch = '';
  let vacSearchDebounce = null;
  let usersPage = 1;
  let usersPageSize = 5;
  let usersTotalCount = 0;

  function shortId(uuid) {
    if (!uuid || typeof uuid !== 'string') return '—';
    return `${uuid.slice(0, 8)}…`;
  }

  function openModal() {
    const m = document.getElementById('admin-vacancy-modal');
    if (!m) return;
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    const m = document.getElementById('admin-vacancy-modal');
    if (!m) return;
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
  }

  function openRejectModal(v) {
    const m = document.getElementById('admin-reject-modal');
    const form = document.getElementById('admin-reject-form');
    if (!m || !form) return;
    form.elements.vacancy_id.value = String(v.id);
    const titleEl = document.getElementById('admin-reject-vacancy-title');
    if (titleEl) titleEl.textContent = `Вакансия: «${v.title}» (${v.employer})`;
    form.querySelector('[name="reject_preset"][value="incomplete"]').checked = true;
    form.elements.reject_custom.value = '';
    document.getElementById('admin-reject-custom-wrap').hidden = true;
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
  }

  function closeRejectModal() {
    const m = document.getElementById('admin-reject-modal');
    if (!m) return;
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
  }

  function resolveRejectReason(form) {
    const preset = form.elements.reject_preset?.value;
    if (preset === 'custom') {
      const custom = String(form.elements.reject_custom?.value || '').trim();
      if (!custom) return null;
      return custom;
    }
    return REJECT_REASON_TEXTS[preset] || null;
  }

  function vacancyModerationStatus(v) {
    if (v.is_published) return 'published';
    if (v.rejection_reason) return 'rejected';
    return 'pending';
  }

  function roleLabel(role) {
    if (role === 'seeker') return 'Соискатель';
    if (role === 'employer') return 'Работодатель';
    if (role === 'admin') return 'Администратор';
    return role || '—';
  }

  function totalPages(count, pageSize) {
    return Math.max(1, Math.ceil((count || 0) / pageSize) || 1);
  }

  function renderPagination(rootId, { page, pageSize, totalCount, onPage }) {
    const root = document.getElementById(rootId);
    if (!root) return page;

    const pages = totalPages(totalCount, pageSize);
    const safePage = Math.min(Math.max(1, page), pages);

    if (totalCount === 0) {
      root.hidden = true;
      root.innerHTML = '';
      return safePage;
    }

    root.hidden = false;
    root.innerHTML = `
      <button type="button" class="btn btn--outline admin-pagination__arrow" data-prev aria-label="Предыдущая страница" ${safePage <= 1 ? 'disabled' : ''}>←</button>
      <span class="admin-pagination__info">Страница <strong>${safePage}</strong> из <strong>${pages}</strong></span>
      <button type="button" class="btn btn--outline admin-pagination__arrow" data-next aria-label="Следующая страница" ${safePage >= pages ? 'disabled' : ''}>→</button>`;

    const prevBtn = root.querySelector('[data-prev]');
    const nextBtn = root.querySelector('[data-next]');
    if (safePage <= 1) prevBtn?.setAttribute('data-disabled-by-page', '');
    else prevBtn?.removeAttribute('data-disabled-by-page');
    if (safePage >= pages) nextBtn?.setAttribute('data-disabled-by-page', '');
    else nextBtn?.removeAttribute('data-disabled-by-page');

    prevBtn?.addEventListener('click', () => {
      if (safePage > 1) onPage(safePage - 1);
    });
    nextBtn?.addEventListener('click', () => {
      if (safePage < pages) onPage(safePage + 1);
    });

    return safePage;
  }

  function readPageSize(selectId, fallback) {
    const sel = document.getElementById(selectId);
    const n = parseInt(sel?.value, 10);
    return PAGE_SIZE_OPTIONS.includes(n) ? n : fallback;
  }

  function ensureTablePreloader(wrap) {
    if (!wrap || wrap.querySelector('.admin-table-preloader')) return;
    const el = document.createElement('div');
    el.className = 'admin-table-preloader';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="admin-table-preloader__spinner" aria-hidden="true"></div>
      <p class="admin-table-preloader__text">Загрузка…</p>`;
    wrap.appendChild(el);
  }

  function setTableLoading(wrap, loading) {
    if (!wrap) return;
    if (loading) {
      ensureTablePreloader(wrap);
      wrap.classList.add('admin-table-wrap--loading');
      wrap.setAttribute('aria-busy', 'true');
      const pre = wrap.querySelector('.admin-table-preloader');
      if (pre) {
        pre.classList.add('admin-table-preloader--visible');
        pre.setAttribute('aria-hidden', 'false');
      }
    } else {
      wrap.classList.remove('admin-table-wrap--loading');
      wrap.setAttribute('aria-busy', 'false');
      const pre = wrap.querySelector('.admin-table-preloader');
      if (pre) {
        pre.classList.remove('admin-table-preloader--visible');
        pre.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function setPaginationLoading(paginationId, loading) {
    const root = document.getElementById(paginationId);
    if (!root) return;
    root.classList.toggle('admin-pagination--loading', loading);
    root.querySelectorAll('button').forEach((btn) => {
      btn.disabled = loading || btn.hasAttribute('data-disabled-by-page');
    });
  }

  async function fetchAllRows(table, select, orderCol) {
    const rows = [];
    let from = 0;
    const step = 1000;
    while (from < EXPORT_LIMIT) {
      const { data, error } = await sb
        .from(table)
        .select(select)
        .order(orderCol, { ascending: false })
        .range(from, from + step - 1);
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < step) break;
      from += step;
    }
    return rows;
  }

  async function exportUsersExcel() {
    try {
      const data = await fetchAllRows(
        'profiles',
        'id, full_name, role, phone, contact_email, created_at',
        'created_at'
      );
      const header = ['ID', 'ФИО', 'Роль', 'Телефон', 'E-mail', 'Дата регистрации'];
      const body = data.map((p) => [
        p.id,
        p.full_name || '',
        roleLabel(p.role),
        (p.phone || '').trim(),
        (p.contact_email || '').trim(),
        p.created_at ? formatDate(p.created_at) : ''
      ]);
      downloadTableAsExcel([header, ...body], 'polzovateli');
    } catch (e) {
      showToast(e.message || 'Ошибка выгрузки', 'error');
    }
  }

  async function exportVacanciesExcel() {
    try {
      const data = await fetchAllRows(
        'vacancies',
        'id, title, employer, salary, employment_type, location, experience, is_published, rejection_reason, is_featured, created_at',
        'created_at'
      );
      const header = [
        'ID', 'Должность', 'Организация', 'Зарплата', 'Тип занятости', 'Локация', 'Опыт',
        'Статус', 'Причина отклонения', 'Закреплена', 'Дата создания'
      ];
      const statusText = (v) => {
        const s = vacancyModerationStatus(v);
        if (s === 'published') return 'Опубликована';
        if (s === 'rejected') return 'Отклонена';
        return 'На проверке';
      };
      const body = data.map((v) => [
        v.id,
        v.title || '',
        v.employer || '',
        v.salary || '',
        v.employment_type || '',
        v.location || '',
        v.experience || '',
        statusText(v),
        v.rejection_reason || '',
        v.is_featured ? 'Да' : 'Нет',
        v.created_at ? formatDate(v.created_at) : ''
      ]);
      downloadTableAsExcel([header, ...body], 'vakansii');
    } catch (e) {
      showToast(e.message || 'Ошибка выгрузки', 'error');
    }
  }

  async function loadCounts() {
    const [{ count: pc }, { count: vc }, { count: rc }, { count: pending }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('vacancies').select('*', { count: 'exact', head: true }),
      sb.from('responses').select('*', { count: 'exact', head: true }),
      sb.from('vacancies').select('*', { count: 'exact', head: true }).eq('is_published', false).is('rejection_reason', null)
    ]);
    const elP = document.getElementById('stat-profiles');
    const elV = document.getElementById('stat-vacancies');
    const elR = document.getElementById('stat-responses');
    const elPending = document.getElementById('stat-pending');
    if (elP) elP.textContent = pc ?? '0';
    if (elV) elV.textContent = vc ?? '0';
    if (elR) elR.textContent = rc ?? '0';
    if (elPending) elPending.textContent = pending ?? '0';
  }

  function vacancyStatusLabel(v) {
    const status = typeof v === 'object' ? vacancyModerationStatus(v) : (v ? 'published' : 'pending');
    if (status === 'published') {
      return '<span class="vacancy-status vacancy-status--published">Опубликована</span>';
    }
    if (status === 'rejected') {
      return '<span class="vacancy-status vacancy-status--rejected">Отклонена</span>';
    }
    return '<span class="vacancy-status vacancy-status--pending">На проверке</span>';
  }

  async function loadModeration() {
    const wrap = document.getElementById('admin-moderation-list');
    if (!wrap) return;
    wrap.innerHTML = '<p class="auth-form__note">Загрузка…</p>';

    const { data, error } = await sb
      .from('vacancies')
      .select('*')
      .eq('is_published', false)
      .is('rejection_reason', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      wrap.innerHTML = `<p class="auth-form__note">Ошибка: ${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data.length) {
      wrap.innerHTML = '<p class="auth-form__note">Нет вакансий, ожидающих проверки.</p>';
      return;
    }

    wrap.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Должность</th>
            <th>Организация</th>
            <th>Дата</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="admin-moderation-tbody"></tbody>
      </table>`;

    const tbody = document.getElementById('admin-moderation-tbody');
    if (!tbody) return;

    data.forEach((v) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="vacancy.html?id=${v.id}" class="admin-table__link">${escapeHtml(v.title)}</a></td>
        <td>${escapeHtml(v.employer)}</td>
        <td>${formatDate(v.created_at)}</td>
        <td class="admin-table__actions">
          <button type="button" class="btn btn--primary btn--sm" data-vac-approve="${v.id}">Разрешить</button>
          <button type="button" class="btn btn--outline btn--sm" data-vac-edit-mod="${v.id}">Правка</button>
          <button type="button" class="btn btn--outline btn--sm" data-vac-reject="${v.id}">Отклонить</button>
        </td>`;
      tbody.appendChild(tr);

      tr.querySelector(`[data-vac-approve="${v.id}"]`)?.addEventListener('click', () => approveVacancy(v.id, v.title));
      tr.querySelector(`[data-vac-edit-mod="${v.id}"]`)?.addEventListener('click', () => openVacancyEditor(v));
      tr.querySelector(`[data-vac-reject="${v.id}"]`)?.addEventListener('click', () => openRejectModal(v));
    });
  }

  async function approveVacancy(id, title) {
    if (!confirm(`Разрешить публикацию вакансии «${title}»?`)) return;
    const { error } = await sb.from('vacancies').update({
      is_published: true,
      rejection_reason: null,
      rejected_at: null
    }).eq('id', id);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Вакансия опубликована в каталоге', 'success');
    void loadModeration();
    void loadCounts();
  }

  async function submitRejectVacancy(form) {
    const id = parseInt(form.elements.vacancy_id.value, 10);
    if (!id) return;
    const reason = resolveRejectReason(form);
    if (!reason) {
      showToast('Укажите причину отклонения', 'error');
      return;
    }
    const { error } = await sb.from('vacancies').update({
      is_published: false,
      rejection_reason: reason,
      rejected_at: new Date().toISOString()
    }).eq('id', id);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Вакансия возвращена работодателю с комментарием', 'success');
    closeRejectModal();
    void loadModeration();
    void loadCounts();
  }

  function renderVacancyRows(data) {
    return data
      .map((v) => {
        const id = v.id;
        return `
        <tr>
          <td><a href="vacancy.html?id=${id}" class="admin-table__link">${escapeHtml(v.title)}</a></td>
          <td>${escapeHtml(v.employer)}</td>
          <td>${formatDate(v.created_at)}</td>
          <td>${vacancyStatusLabel(v)}</td>
          <td>
            <label class="admin-inline-check">
              <input type="checkbox" data-vac-feature="${id}" ${v.is_featured ? 'checked' : ''} />
            </label>
          </td>
          <td class="admin-table__actions">
            <button type="button" class="btn btn--outline btn--sm" data-vac-edit="${id}">Правка</button>
            <button type="button" class="btn btn--outline btn--sm" data-vac-del="${id}">Удалить</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function bindVacancyTableRows(data) {
    const tbody = document.getElementById('admin-vac-tbody');
    if (!tbody) return;

    data.forEach((v) => {
      const tr = tbody.querySelector(`[data-vac-edit="${v.id}"]`)?.closest('tr');
      if (!tr) return;

      tr.querySelector(`[data-vac-feature="${v.id}"]`)?.addEventListener('change', async (e) => {
        const on = e.target.checked;
        const { error: err } = await sb.from('vacancies').update({ is_featured: on }).eq('id', v.id);
        if (err) {
          showToast(err.message, 'error');
          e.target.checked = !on;
          return;
        }
        showToast(on ? 'Вакансия закреплена' : 'Закрепление снято', 'success');
      });

      tr.querySelector(`[data-vac-edit="${v.id}"]`)?.addEventListener('click', () => openVacancyEditor(v));
      tr.querySelector(`[data-vac-del="${v.id}"]`)?.addEventListener('click', () => deleteVacancy(v.id, v.title));
    });
  }

  async function loadVacancies(pageArg) {
    const wrap = document.getElementById('admin-vac-list');
    if (!wrap) return;

    vacPageSize = readPageSize('admin-vac-page-size', vacPageSize);

    if (pageArg === true) vacPage = 1;
    else if (typeof pageArg === 'number') vacPage = pageArg;

    const hadTable = !!wrap.querySelector('.admin-table');
    if (!hadTable) wrap.innerHTML = '';
    setTableLoading(wrap, true);
    setPaginationLoading('admin-vac-pagination', true);

    const from = (vacPage - 1) * vacPageSize;
    const to = from + vacPageSize - 1;

    let q = sb
      .from('vacancies')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (vacSearch) {
      q = q.ilike('title', `%${vacSearch}%`);
    }

    try {
      const { data, count, error } = await q;
      if (error) {
        wrap.innerHTML = `<p class="auth-form__note">Ошибка: ${escapeHtml(error.message)}</p>`;
        document.getElementById('admin-vac-pagination').hidden = true;
        return;
      }

      vacTotalCount = count ?? 0;
      const pages = totalPages(vacTotalCount, vacPageSize);

      if (vacPage > pages) {
        vacPage = pages;
        return loadVacancies(vacPage);
      }

      if (!data?.length && vacTotalCount === 0) {
        wrap.innerHTML = '<p class="auth-form__note">Вакансий нет.</p>';
        renderPagination('admin-vac-pagination', {
          page: 1,
          pageSize: vacPageSize,
          totalCount: 0,
          onPage: (p) => void loadVacancies(p)
        });
        return;
      }

      wrap.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Должность</th>
            <th>Организация</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Топ</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="admin-vac-tbody">${renderVacancyRows(data)}</tbody>
      </table>`;

      bindVacancyTableRows(data);

      vacPage = renderPagination('admin-vac-pagination', {
        page: vacPage,
        pageSize: vacPageSize,
        totalCount: vacTotalCount,
        onPage: (p) => void loadVacancies(p)
      });
    } finally {
      setTableLoading(wrap, false);
      setPaginationLoading('admin-vac-pagination', false);
    }
  }

  async function deleteVacancy(id, title) {
    if (!confirm(`Удалить вакансию «${title}»?`)) return;
    const { error } = await sb.from('vacancies').delete().eq('id', id);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Удалено', 'success');
    void loadVacancies(true);
  }

  function openVacancyEditor(v) {
    const form = document.getElementById('admin-vacancy-form');
    if (!form) return;
    form.elements.vacancy_id.value = String(v.id);
    form.elements.employer.value = v.employer || '';
    form.elements.title.value = v.title || '';
    form.elements.salary.value = v.salary || '';
    form.elements.employment_type.value = v.employment_type || 'Полная занятость';
    form.elements.location.value = v.location || '';
    form.elements.experience.value = v.experience || '';
    form.elements.description.value = v.description || '';
    form.elements.requirements.value = v.requirements || '';
    form.elements.conditions.value = v.conditions || '';
    form.elements.is_featured.checked = !!v.is_featured;
    form.elements.is_published.checked = !!v.is_published;
    openModal();
  }

  function renderUserRows(data) {
    return data
      .map((p) => {
        const isSelf = p.id === currentUserId;
        const isTargetAdmin = p.role === 'admin';
        return `
        <tr>
          <td>${escapeHtml(p.full_name || '—')}</td>
          <td><code class="admin-code">${shortId(p.id)}</code></td>
          <td>
            <select class="input input--sm admin-role-select" data-profile-id="${p.id}" ${isSelf || isTargetAdmin ? 'disabled' : ''}>
              <option value="seeker"${p.role === 'seeker' ? ' selected' : ''}>Соискатель</option>
              <option value="employer"${p.role === 'employer' ? ' selected' : ''}>Работодатель</option>
            </select>
            ${isTargetAdmin ? '<span class="admin-badge">admin</span>' : ''}
          </td>
          <td>${escapeHtml((p.phone || '').trim() || '—')}</td>
          <td>
            ${isSelf || isTargetAdmin ? '<span class="auth-form__note">—</span>' : `<button type="button" class="btn btn--outline btn--sm" data-save-role="${p.id}">Сохранить</button>`}
          </td>
        </tr>`;
      })
      .join('');
  }

  function bindUserTableRows(data) {
    data.forEach((p) => {
      const btn = document.querySelector(`[data-save-role="${p.id}"]`);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const sel = tr?.querySelector('.admin-role-select');
        const role = sel?.value;
        if (role !== 'seeker' && role !== 'employer') return;

        const { error } = await sb.from('profiles').update({ role }).eq('id', p.id);
        if (error) {
          showToast(error.message, 'error');
          return;
        }
        showToast('Роль обновлена', 'success');
      });
    });
  }

  async function loadUsers(pageArg) {
    const wrap = document.getElementById('admin-users-list');
    if (!wrap) return;

    usersPageSize = readPageSize('admin-users-page-size', usersPageSize);

    if (pageArg === true) usersPage = 1;
    else if (typeof pageArg === 'number') usersPage = pageArg;

    const hadTable = !!wrap.querySelector('.admin-table');
    if (!hadTable) wrap.innerHTML = '';
    setTableLoading(wrap, true);
    setPaginationLoading('admin-users-pagination', true);

    const from = (usersPage - 1) * usersPageSize;
    const to = from + usersPageSize - 1;

    try {
      const { data, count, error } = await sb
        .from('profiles')
        .select('id, full_name, role, phone, contact_email, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        wrap.innerHTML = `<p class="auth-form__note">Ошибка: ${escapeHtml(error.message)}</p>`;
        document.getElementById('admin-users-pagination').hidden = true;
        return;
      }

      usersTotalCount = count ?? 0;
      const pages = totalPages(usersTotalCount, usersPageSize);

      if (usersPage > pages) {
        usersPage = pages;
        return loadUsers(usersPage);
      }

      if (!data?.length && usersTotalCount === 0) {
        wrap.innerHTML = '<p class="auth-form__note">Профилей нет.</p>';
        renderPagination('admin-users-pagination', {
          page: 1,
          pageSize: usersPageSize,
          totalCount: 0,
          onPage: (p) => void loadUsers(p)
        });
        return;
      }

      wrap.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>ID</th>
            <th>Роль</th>
            <th>Телефон</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="admin-users-tbody">${renderUserRows(data)}</tbody>
      </table>`;

      bindUserTableRows(data);

      usersPage = renderPagination('admin-users-pagination', {
        page: usersPage,
        pageSize: usersPageSize,
        totalCount: usersTotalCount,
        onPage: (p) => void loadUsers(p)
      });
    } finally {
      setTableLoading(wrap, false);
      setPaginationLoading('admin-users-pagination', false);
    }
  }

  async function loadResponses() {
    const host = document.getElementById('admin-responses-list');
    if (!host) return;
    host.innerHTML = '<p class="auth-form__note">Загрузка…</p>';

    const { data, error } = await sb
      .from('responses')
      .select(
        `
        id,
        created_at,
        vacancy_id,
        profiles (full_name, phone, contact_email),
        vacancies (title, employer)
      `
      )
      .order('created_at', { ascending: false })
      .limit(RESPONSES_LIMIT);

    if (error) {
      host.innerHTML = `<p class="auth-form__note">Ошибка: ${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data.length) {
      host.innerHTML = '<p class="auth-form__note">Откликов пока нет.</p>';
      return;
    }

    host.innerHTML = data
      .map((row) => {
        const pr = row.profiles || {};
        const vac = row.vacancies || {};
        const phone = (pr.phone || '').trim();
        const mail = (pr.contact_email || '').trim();
        const phoneHtml = phone
          ? `<a class="employer-response__link" href="tel:${escapeHtml(phone.replace(/\s/g, ''))}">${escapeHtml(phone)}</a>`
          : '—';
        const mailHtml = mail
          ? `<a class="employer-response__link" href="mailto:${escapeHtml(mail)}">${escapeHtml(mail)}</a>`
          : '—';
        return `
      <article class="employer-response-card admin-response-card">
        <header class="employer-response-card__head">
          <span class="employer-response-card__vacancy">${escapeHtml(vac.title || '—')} · ${escapeHtml(vac.employer || '')}</span>
          <time class="employer-response-card__date" datetime="${row.created_at}">${formatDate(row.created_at)}</time>
        </header>
        <p class="employer-response-card__name">${escapeHtml(pr.full_name || '—')}</p>
        <dl class="employer-response-card__contacts">
          <div><dt>Телефон</dt><dd>${phoneHtml}</dd></div>
          <div><dt>E-mail</dt><dd>${mailHtml}</dd></div>
        </dl>
        <p class="employer-response-card__actions">
          <a class="btn btn--link" href="vacancy.html?id=${row.vacancy_id}">Открыть вакансию</a>
        </p>
      </article>`;
      })
      .join('');
  }

  function showSection(name) {
    document.querySelectorAll('.admin-nav__btn').forEach((b) => {
      b.classList.toggle('admin-nav__btn--active', b.dataset.section === name);
    });
    document.querySelectorAll('.admin-panel').forEach((p) => {
      p.hidden = p.dataset.panel !== name;
    });

    if (name === 'dashboard') void loadCounts();
    if (name === 'moderation') void loadModeration();
    if (name === 'vacancies') void loadVacancies(true);
    if (name === 'users') void loadUsers(true);
    if (name === 'responses') void loadResponses();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const deny = document.getElementById('admin-gate-deny');
    const ok = document.getElementById('admin-gate-ok');

    try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = 'cabinet.html';
      return;
    }

    currentUserId = user.id;

    const { data: profile, error } = await sb.from('profiles').select('role, full_name').eq('id', user.id).single();

    if (error || profile?.role !== 'admin') {
      if (deny) deny.hidden = false;
      return;
    }

    if (ok) ok.hidden = false;
    const label = document.getElementById('admin-user-label');
    if (label) label.textContent = profile.full_name || user.email || 'Администратор';

    document.getElementById('admin-logout')?.addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = 'cabinet.html';
    });

    document.querySelectorAll('.admin-nav__btn').forEach((btn) => {
      btn.addEventListener('click', () => showSection(btn.dataset.section || 'dashboard'));
    });

    document.getElementById('admin-vac-page-size')?.addEventListener('change', () => void loadVacancies(true));
    document.getElementById('admin-users-page-size')?.addEventListener('change', () => void loadUsers(true));

    const searchInput = document.getElementById('admin-vac-search');
    searchInput?.addEventListener('input', () => {
      clearTimeout(vacSearchDebounce);
      vacSearchDebounce = setTimeout(() => {
        vacSearch = searchInput.value.trim();
        void loadVacancies(true);
      }, 320);
    });

    document.getElementById('admin-vacancy-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const id = parseInt(form.elements.vacancy_id.value, 10);
      if (!id) return;

      const fd = new FormData(form);
      const payload = {
        employer: String(fd.get('employer') || '').trim(),
        title: String(fd.get('title') || '').trim(),
        salary: String(fd.get('salary') || '').trim(),
        employment_type: String(fd.get('employment_type') || '').trim() || 'Полная занятость',
        location: String(fd.get('location') || '').trim(),
        experience: String(fd.get('experience') || '').trim(),
        description: String(fd.get('description') || '').trim(),
        requirements: String(fd.get('requirements') || '').trim(),
        conditions: String(fd.get('conditions') || '').trim(),
        is_featured: form.elements.is_featured.checked,
        is_published: form.elements.is_published.checked
      };

      if (!payload.employer || !payload.title) {
        showToast('Укажите организацию и должность', 'error');
        return;
      }

      const { error: upErr } = await sb.from('vacancies').update(payload).eq('id', id);
      if (upErr) {
        showToast(upErr.message, 'error');
        return;
      }
      showToast('Вакансия сохранена', 'success');
      closeModal();
      void loadVacancies(true);
      void loadModeration();
      void loadCounts();
    });

    document.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.querySelectorAll('[data-close-reject-modal]').forEach((el) => {
      el.addEventListener('click', closeRejectModal);
    });

    document.getElementById('admin-reject-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitRejectVacancy(e.target);
    });

    document.getElementById('admin-reject-form')?.addEventListener('change', (e) => {
      if (e.target.name !== 'reject_preset') return;
      const wrap = document.getElementById('admin-reject-custom-wrap');
      if (wrap) wrap.hidden = e.target.value !== 'custom';
    });

    document.getElementById('admin-export-users')?.addEventListener('click', () => void exportUsersExcel());
    document.getElementById('admin-export-vacancies')?.addEventListener('click', () => void exportVacanciesExcel());

    showSection('dashboard');
    } catch (_) {
      if (deny) deny.hidden = false;
    } finally {
      hideAdminPageLoader();
    }
  });
})();
