document.addEventListener('DOMContentLoaded', async () => {
  const { count, error: countError } = await sb
    .from('vacancies')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  if (countError) {
    console.error(countError);
    showToast('Не удалось загрузить статистику вакансий', 'error');
  }

  const statVacancies = document.getElementById('stat-vacancies');
  if (statVacancies && count != null) {
    statVacancies.textContent = count.toLocaleString('ru-RU');
  }

  const { data: employerRows, error: employersError } = await sb
    .from('vacancies')
    .select('employer')
    .eq('is_published', true);

  if (employersError) console.error(employersError);
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
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error(error);
    showToast('Не удалось загрузить вакансии на главную', 'error');
    return;
  }
  if (!data?.length) return;

  grid.innerHTML = data.map((v) => renderVacancyCardHtml(v, 'tile')).join('');
});
