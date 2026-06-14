document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) { window.location.href = 'vacancies.html'; return; }

  const { data: v, error } = await sb
    .from('vacancies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !v) {
    showToast('Вакансия не найдена', 'error');
    setTimeout(() => window.location.href = 'vacancies.html', 1500);
    return;
  }

  const user = await getCurrentUser();
  let isOwner = false;
  if (user && v.created_by === user.id) isOwner = true;

  if (!v.is_published && !isOwner) {
    const { data: prof } = user
      ? await sb.from('profiles').select('role').eq('id', user.id).single()
      : { data: null };
    if (prof?.role !== 'admin') {
      showToast('Вакансия ещё не опубликована', 'error');
      setTimeout(() => window.location.href = 'vacancies.html', 1500);
      return;
    }
  }

  document.title = `${v.title} — вакансия`;

  document.querySelector('.detail__employer').textContent = v.employer;
  document.querySelector('.detail__title').textContent    = v.title;
  document.querySelector('.detail__salary').textContent   = v.salary || 'По договорённости';

  const metaUl = document.querySelector('.detail__meta');
  const experienceText = (v.experience && String(v.experience).trim())
    ? escapeHtml(v.experience.trim())
    : 'Не указан';
  metaUl.innerHTML = `
    <li>Опубликовано <time datetime="${v.created_at}">${formatDate(v.created_at)}</time></li>
    <li>${escapeHtml(v.location || 'Не указан')}</li>
    <li>${escapeHtml(v.employment_type || '')}</li>
    <li>Опыт: ${experienceText}</li>
  `;

  if (!v.is_published && isOwner) {
    const notice = document.createElement('div');
    notice.className = 'vacancy-moderation-notice';
    if (v.rejection_reason) {
      notice.innerHTML = `
        <p class="vacancy-moderation-notice__title">Вакансия отклонена</p>
        <p><strong>Причина:</strong> ${escapeHtml(v.rejection_reason)}</p>
        <p>Исправьте замечания в личном кабинете и отправьте на проверку снова.</p>`;
    } else {
      notice.textContent = 'Вакансия на проверке у администратора. После одобрения она появится в каталоге.';
    }
    document.querySelector('.detail__header')?.appendChild(notice);
  }

  const prose = document.querySelector('.prose');
  const reqList = v.requirements
    ? v.requirements.split(';').map(r => `<li>${escapeHtml(r.trim())}</li>`).join('')
    : '<li>Не указаны</li>';
  const condList = v.conditions
    ? v.conditions.split(';').map(c => `<li>${escapeHtml(c.trim())}</li>`).join('')
    : '<li>Не указаны</li>';

  prose.innerHTML = `
    <h2>Описание</h2>
    <p>${escapeHtml(v.description || 'Описание отсутствует')}</p>
    <h2>Требования</h2>
    <ul class="prose-list">${reqList}</ul>
    <h2>Условия</h2>
    <ul class="prose-list">${condList}</ul>
  `;

  const employerInfo = document.querySelector('.aside-card--muted .aside-card__text');
  if (employerInfo) employerInfo.textContent = v.employer;

  const respondBtn = document.getElementById('respond-btn');
  const respondFields = document.getElementById('respond-fields');
  const respondMessage = document.getElementById('respond-message');
  const respondHint = document.getElementById('respond-hint');

  function setRespondFieldsVisible(visible) {
    if (respondFields) respondFields.hidden = !visible;
  }

  function lockRespondMessage() {
    if (respondMessage) respondMessage.readOnly = true;
    setRespondFieldsVisible(false);
  }

  async function seekerAlreadyResponded(userId) {
    const { data, error } = await sb
      .from('responses')
      .select('id')
      .eq('user_id', userId)
      .eq('vacancy_id', v.id)
      .maybeSingle();
    if (error) return false;
    return !!data;
  }

  function markRespondButtonAlreadySent() {
    if (!respondBtn) return;
    respondBtn.disabled = true;
    respondBtn.textContent = 'Вы уже откликались';
    respondBtn.classList.add('btn--ghost');
    respondBtn.dataset.responded = '1';
    lockRespondMessage();
    if (respondHint) {
      respondHint.textContent = 'Отклик отправлен. Статус можно посмотреть в личном кабинете.';
    }
  }

  if (respondBtn) {
    if (!v.is_published) {
      respondBtn.disabled = true;
      respondBtn.textContent = 'Отклик после публикации';
      respondBtn.classList.add('btn--ghost');
      setRespondFieldsVisible(false);
    } else if (user) {
      const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
      if (prof?.role === 'employer' || prof?.role === 'admin') {
        respondBtn.disabled = true;
        respondBtn.textContent = 'Отклик доступен соискателям';
        respondBtn.classList.add('btn--ghost');
        setRespondFieldsVisible(false);
      } else if (prof?.role === 'seeker' && (await seekerAlreadyResponded(user.id))) {
        markRespondButtonAlreadySent();
      } else {
        setRespondFieldsVisible(true);
        if (respondHint) {
          respondHint.textContent = 'Можно кратко описать опыт и навыки — это необязательно, но поможет работодателю.';
        }
      }
    } else {
      setRespondFieldsVisible(true);
      if (respondHint) {
        respondHint.textContent = 'Войдите в личный кабинет, чтобы отправить отклик. Сообщение о себе — по желанию.';
      }
    }

    respondBtn.addEventListener('click', async () => {
      if (respondBtn.dataset.responded === '1') {
        showToast('Вы уже откликались на эту вакансию', 'info');
        return;
      }
      const u = await getCurrentUser();
      if (!u) {
        showToast('Войдите в личный кабинет, чтобы откликнуться', 'error');
        setTimeout(() => window.location.href = 'cabinet.html', 1200);
        return;
      }

      const { data: prof } = await sb
        .from('profiles')
        .select('role, phone, contact_email')
        .eq('id', u.id)
        .single();
      if (prof?.role === 'employer' || prof?.role === 'admin') {
        showToast('Работодатели не откликаются на вакансии', 'info');
        return;
      }

      if (!profileHasRespondContacts(prof)) {
        showToast('Укажите в профиле телефон или e-mail для связи, затем откликнитесь снова', 'error');
        setTimeout(() => { window.location.href = 'cabinet.html#profile-contacts'; }, 1400);
        return;
      }

      if (await seekerAlreadyResponded(u.id)) {
        markRespondButtonAlreadySent();
        showToast('Вы уже откликались на эту вакансию', 'info');
        return;
      }

      respondBtn.disabled = true;

      const message = String(respondMessage?.value || '').trim().slice(0, 2000);
      const payload = { user_id: u.id, vacancy_id: v.id };
      if (message) payload.message = message;

      const { error: respError } = await sb
        .from('responses')
        .insert(payload);

      if (respError) {
        respondBtn.disabled = false;
        const dup = respError.code === '23505'
          || /duplicate|unique|уже существует/i.test(respError.message || '');
        if (dup) {
          markRespondButtonAlreadySent();
          showToast('Вы уже откликались на эту вакансию', 'info');
        } else {
          showToast('Ошибка при отклике', 'error');
        }
        return;
      }
      showToast('Отклик отправлен!', 'success');
      respondBtn.textContent = 'Отклик отправлен';
      respondBtn.disabled = true;
      respondBtn.dataset.responded = '1';
      lockRespondMessage();
      if (respondHint) {
        respondHint.textContent = 'Отклик отправлен. Статус можно посмотреть в личном кабинете.';
      }
    });
  }
});
