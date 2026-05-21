(function () {
  const PAGE_SIZE = 25;
  const RESPONSES_LIMIT = 150;

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
  let vacOffset = 0;
  let vacSearch = '';
  let vacSearchDebounce = null;
  let usersOffset = 0;

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

  async function loadCounts() {
    const [{ count: pc }, { count: vc }, { count: rc }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('vacancies').select('*', { count: 'exact', head: true }),
      sb.from('responses').select('*', { count: 'exact', head: true })
    ]);
    const elP = document.getElementById('stat-profiles');
    const elV = document.getElementById('stat-vacancies');
    const elR = document.getElementById('stat-responses');
    if (elP) elP.textContent = pc ?? '0';
    if (elV) elV.textContent = vc ?? '0';
    if (elR) elR.textContent = rc ?? '0';
  }

  async function loadVacancies(reset) {
    const wrap = document.getElementById('admin-vac-list');
    const moreBtn = document.getElementById('admin-vac-more');
    if (!wrap) return;

    if (reset) {
      vacOffset = 0;
      wrap.innerHTML = '<p class="auth-form__note">Загрузка…</p>';
    }

    let q = sb
      .from('vacancies')
      .select('*')
      .order('created_at', { ascending: false })
      .range(vacOffset, vacOffset + PAGE_SIZE - 1);

    if (vacSearch) {
      q = q.ilike('title', `%${vacSearch}%`);
    }

    const { data, error } = await q;
    if (error) {
      wrap.innerHTML = `<p class="auth-form__note">Ошибка: ${escapeHtml(error.message)}</p>`;
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    if (reset) wrap.innerHTML = '';

    if (!data.length && vacOffset === 0) {
      wrap.innerHTML = '<p class="auth-form__note">Вакансий нет.</p>';
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    if (reset && data.length) {
      wrap.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Должность</th>
              <th>Организация</th>
              <th>Дата</th>
              <th>Топ</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="admin-vac-tbody"></tbody>
        </table>`;
    }

    const tbody = document.getElementById('admin-vac-tbody');
    if (!tbody) return;

    data.forEach((v) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="vacancy.html?id=${v.id}" class="admin-table__link">${escapeHtml(v.title)}</a></td>
        <td>${escapeHtml(v.employer)}</td>
        <td>${formatDate(v.created_at)}</td>
        <td>
          <label class="admin-inline-check">
            <input type="checkbox" data-vac-feature="${v.id}" ${v.is_featured ? 'checked' : ''} />
          </label>
        </td>
        <td class="admin-table__actions">
          <button type="button" class="btn btn--outline btn--sm" data-vac-edit="${v.id}">Правка</button>
          <button type="button" class="btn btn--outline btn--sm" data-vac-del="${v.id}">Удалить</button>
        </td>`;
      tbody.appendChild(tr);

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

    vacOffset += data.length;
    if (moreBtn) moreBtn.hidden = data.length < PAGE_SIZE;
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
    openModal();
  }

  async function loadUsers(reset) {
    const wrap = document.getElementById('admin-users-list');
    const moreBtn = document.getElementById('admin-users-more');
    if (!wrap) return;

    if (reset) {
      usersOffset = 0;
      wrap.innerHTML = '<p class="auth-form__note">Загрузка…</p>';
    }

    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, role, phone, contact_email, created_at')
      .order('created_at', { ascending: false })
      .range(usersOffset, usersOffset + PAGE_SIZE - 1);

    if (error) {
      wrap.innerHTML = `<p class="auth-form__note">Ошибка: ${escapeHtml(error.message)}</p>`;
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    if (reset) wrap.innerHTML = '';

    if (!data.length && usersOffset === 0) {
      wrap.innerHTML = '<p class="auth-form__note">Профилей нет.</p>';
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    if (reset && data.length) {
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
          <tbody id="admin-users-tbody"></tbody>
        </table>`;
    }

    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    data.forEach((p) => {
      const isSelf = p.id === currentUserId;
      const isTargetAdmin = p.role === 'admin';
      const tr = document.createElement('tr');
      tr.innerHTML = `
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
        </td>`;
      tbody.appendChild(tr);

      tr.querySelector(`[data-save-role="${p.id}"]`)?.addEventListener('click', async () => {
        const sel = tr.querySelector('.admin-role-select');
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

    usersOffset += data.length;
    if (moreBtn) moreBtn.hidden = data.length < PAGE_SIZE;
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

    document.getElementById('admin-vac-more')?.addEventListener('click', () => void loadVacancies(false));
    document.getElementById('admin-users-more')?.addEventListener('click', () => void loadUsers(false));

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
        is_featured: form.elements.is_featured.checked
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
    });

    document.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    showSection('dashboard');
    } catch (_) {
      if (deny) deny.hidden = false;
    } finally {
      hideAdminPageLoader();
    }
  });
})();
