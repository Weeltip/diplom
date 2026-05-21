document.addEventListener('DOMContentLoaded', async () => {
  const { count } = await sb
    .from('vacancies')
    .select('*', { count: 'exact', head: true });

  const statVacancies = document.getElementById('stat-vacancies');
  if (statVacancies && count != null) {
    statVacancies.textContent = count.toLocaleString('ru-RU');
  }

  const { data: employerRows } = await sb.from('vacancies').select('employer');
  const uniqueEmployers = new Set(
    (employerRows || []).map((r) => r.employer).filter(Boolean)
  ).size;

  const statEmployers = document.getElementById('stat-employers');
  if (statEmployers) {
    statEmployers.textContent = uniqueEmployers.toLocaleString('ru-RU');
  }

  const grid = document.getElementById('home-vacancies');
  if (!grid) return;

  const { data, error } = await sb
    .from('vacancies')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3);

  if (error || !data) return;

  grid.innerHTML = data.map((v) => {
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
  }).join('');
});
