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
  if (respondBtn) {
    const user = await getCurrentUser();
    if (user) {
      const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
      if (prof?.role === 'employer' || prof?.role === 'admin') {
        respondBtn.disabled = true;
        respondBtn.textContent = 'Отклик доступен соискателям';
        respondBtn.classList.add('btn--ghost');
      }
    }

    respondBtn.addEventListener('click', async () => {
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

      const { error: respError } = await sb
        .from('responses')
        .insert({ user_id: u.id, vacancy_id: v.id });

      if (respError) {
        if (respError.code === '23505') {
          showToast('Вы уже откликались на эту вакансию', 'info');
        } else {
          showToast('Ошибка при отклике', 'error');
        }
        return;
      }
      showToast('Отклик отправлен!', 'success');
      respondBtn.textContent = 'Отклик отправлен';
      respondBtn.disabled = true;
    });
  }
});
