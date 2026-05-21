(function () {
  let editingId = null;
  let navigateEmployerTo = null;

  function getForm() {
    return document.getElementById('employer-vacancy-form');
  }

  async function refreshIncomingResponses() {
    const user = await getCurrentUser();
    const host = document.getElementById('employer-incoming-responses');
    if (!user || !host) return;

    const { data, error } = await sb
      .from('responses')
      .select(`
        id,
        created_at,
        vacancy_id,
        profiles (full_name, phone, contact_email),
        vacancies!inner (title, id, created_by)
      `)
      .eq('vacancies.created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      host.innerHTML = `<p class="auth-form__note">Не удалось загрузить отклики: ${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data.length) {
      host.innerHTML = '<p class="auth-form__note">Пока нет откликов на ваши вакансии.</p>';
      return;
    }

    host.innerHTML = data
      .map((row) => {
        const p = row.profiles || {};
        const name = p.full_name || 'Имя не указано';
        const phone = (p.phone || '').trim();
        const mail = (p.contact_email || '').trim();
        const phoneHtml = phone
          ? `<a class="employer-response__link" href="tel:${escapeHtml(phone.replace(/\s/g, ''))}">${escapeHtml(phone)}</a>`
          : '—';
        const mailHtml = mail
          ? `<a class="employer-response__link" href="mailto:${escapeHtml(mail)}">${escapeHtml(mail)}</a>`
          : '—';

        return `
      <article class="employer-response-card">
        <header class="employer-response-card__head">
          <span class="employer-response-card__vacancy">${escapeHtml(row.vacancies.title)}</span>
          <time class="employer-response-card__date" datetime="${row.created_at}">${formatDate(row.created_at)}</time>
        </header>
        <p class="employer-response-card__name">${escapeHtml(name)}</p>
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

  async function refreshList() {
    const user = await getCurrentUser();
    if (!user) return;

    const { data, error } = await sb
      .from('vacancies')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    const wrap = document.getElementById('employer-vacancies-list');
    if (!wrap) return;

    if (error) {
      wrap.innerHTML = '<p class="auth-form__note">Не удалось загрузить вакансии.</p>';
      return;
    }

    if (!data.length) {
      wrap.innerHTML = '<p class="auth-form__note">Вы ещё не разместили вакансий.</p>';
      return;
    }

    wrap.innerHTML = data.map((v) => `
      <div class="employer-vacancy-row" data-id="${v.id}">
        <div class="employer-vacancy-row__main">
          <a href="vacancy.html?id=${v.id}" class="employer-vacancy-row__title">${escapeHtml(v.title)}</a>
          <span class="employer-vacancy-row__meta">${escapeHtml(v.employer)} · ${formatDate(v.created_at)}</span>
        </div>
        <div class="employer-vacancy-row__actions">
          <button type="button" class="btn btn--outline btn--sm employer-edit" data-id="${v.id}">Изменить</button>
          <button type="button" class="btn btn--outline btn--sm employer-del" data-id="${v.id}">Удалить</button>
        </div>
      </div>
    `).join('');

    wrap.querySelectorAll('.employer-edit').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(parseInt(btn.dataset.id, 10)));
    });
    wrap.querySelectorAll('.employer-del').forEach((btn) => {
      btn.addEventListener('click', () => removeVacancy(parseInt(btn.dataset.id, 10)));
    });
  }

  async function startEdit(id) {
    const user = await getCurrentUser();
    const { data: v, error } = await sb
      .from('vacancies')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error || !v) {
      showToast('Вакансия не найдена', 'error');
      return;
    }

    if (navigateEmployerTo) {
      await navigateEmployerTo('create');
    }

    editingId = id;
    const f = getForm();
    f.querySelector('[name="employer"]').value = v.employer;
    f.querySelector('[name="title"]').value = v.title;
    f.querySelector('[name="salary"]').value = v.salary || '';
    f.querySelector('[name="employment_type"]').value = v.employment_type || 'Полная занятость';
    f.querySelector('[name="location"]').value = v.location || '';
    f.querySelector('[name="experience"]').value = v.experience || '';
    f.querySelector('[name="description"]').value = v.description || '';
    f.querySelector('[name="requirements"]').value = v.requirements || '';
    f.querySelector('[name="conditions"]').value = v.conditions || '';

    const heading = document.getElementById('employer-create-heading');
    if (heading) heading.textContent = 'Редактирование вакансии';
    document.getElementById('employer-form-submit').textContent = 'Сохранить изменения';
    document.getElementById('employer-form-cancel').hidden = false;
    document.getElementById('employer-screen-create')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    editingId = null;
    const f = getForm();
    f.reset();
    const heading = document.getElementById('employer-create-heading');
    if (heading) heading.textContent = 'Новая вакансия';
    document.getElementById('employer-form-submit').textContent = 'Опубликовать';
    document.getElementById('employer-form-cancel').hidden = true;
  }

  function initEmployerNav() {
    const home = document.getElementById('employer-home');
    const resp = document.getElementById('employer-screen-responses');
    const vac = document.getElementById('employer-screen-vacancies');
    const create = document.getElementById('employer-screen-create');
    if (!home || !resp || !vac || !create) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panels = { hub: home, responses: resp, vacancies: vac, create };

    async function go(key) {
      const toEl = panels[key];
      if (!toEl) return;

      const fromEl = Object.values(panels).find((el) => el && !el.hidden);
      if (!fromEl || fromEl === toEl) return;

      if (reduceMotion || typeof fromEl.animate !== 'function') {
        Object.values(panels).forEach((el) => {
          if (el) el.hidden = el !== toEl;
        });
        if (key === 'responses') void refreshIncomingResponses();
        if (key === 'vacancies') void refreshList();
        if (key === 'create') create.scrollTop = 0;
        return;
      }

      try {
        await fromEl.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 200, easing: 'ease-in' }
        ).finished;
      } catch (_) {
        /* прервана анимация */
      }

      fromEl.hidden = true;
      toEl.hidden = false;

      try {
        await toEl.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          { duration: 300, easing: 'ease-out' }
        ).finished;
      } catch (_) {
        /* прервана анимация */
      }

      if (key === 'responses') void refreshIncomingResponses();
      if (key === 'vacancies') void refreshList();
      if (key === 'create') create.scrollTop = 0;
    }

    navigateEmployerTo = go;

    document.getElementById('employer-open-responses')?.addEventListener('click', () => go('responses'));
    document.getElementById('employer-open-vacancies')?.addEventListener('click', () => go('vacancies'));
    document.getElementById('employer-open-create')?.addEventListener('click', () => {
      resetForm();
      void go('create');
    });
    document.getElementById('employer-back-create')?.addEventListener('click', () => go('hub'));
    document.getElementById('employer-back-responses')?.addEventListener('click', () => go('hub'));
    document.getElementById('employer-back-vacancies')?.addEventListener('click', () => go('hub'));

    home.hidden = false;
    resp.hidden = true;
    vac.hidden = true;
    create.hidden = true;
  }

  async function removeVacancy(id) {
    if (!confirm('Удалить эту вакансию из каталога?')) return;

    const { error } = await sb.from('vacancies').delete().eq('id', id);
    if (error) {
      showToast('Не удалось удалить', 'error');
      return;
    }
    showToast('Вакансия удалена', 'success');
    await refreshList();
    await refreshIncomingResponses();
  }

  window.initEmployerPanel = async function initEmployerPanel() {
    const employerBlock = document.getElementById('dash-employer-block');
    if (employerBlock && employerBlock.dataset.employerNav !== '1') {
      employerBlock.dataset.employerNav = '1';
      initEmployerNav();
    }

    const form = getForm();
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    await refreshList();
    await refreshIncomingResponses();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = await getCurrentUser();
      if (!user) return;

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
        is_featured: false,
        created_by: user.id
      };

      if (!payload.employer || !payload.title) {
        showToast('Укажите название организации и должность', 'error');
        return;
      }

      if (editingId) {
        const { error } = await sb
          .from('vacancies')
          .update({
            employer: payload.employer,
            title: payload.title,
            salary: payload.salary,
            employment_type: payload.employment_type,
            location: payload.location,
            experience: payload.experience,
            description: payload.description,
            requirements: payload.requirements,
            conditions: payload.conditions
          })
          .eq('id', editingId)
          .eq('created_by', user.id);

        if (error) {
          showToast(error.message, 'error');
          return;
        }
        showToast('Вакансия обновлена', 'success');
        resetForm();
      } else {
        const { error } = await sb.from('vacancies').insert(payload);
        if (error) {
          showToast(error.message, 'error');
          return;
        }
        showToast('Вакансия опубликована', 'success');
        form.reset();
      }

      await refreshList();
      await refreshIncomingResponses();
    });

    const cancelBtn = document.getElementById('employer-form-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => resetForm());
    }
  };
})();
