document.addEventListener('DOMContentLoaded', () => {
  function hideCabinetPageLoader() {
    const el = document.getElementById('cabinet-page-loader');
    if (!el || el.dataset.done === '1') return;
    el.dataset.done = '1';
    el.classList.add('page-loader--hide');
    el.setAttribute('aria-busy', 'false');
    setTimeout(() => {
      el.hidden = true;
    }, 420);
  }

  const tabBtns      = document.querySelectorAll('.tabs__btn');
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const dashboard    = document.getElementById('dashboard');
  const authPanel    = document.getElementById('auth-panel');
  const authForms    = document.querySelector('.auth-forms');
  const authIntro    = document.querySelector('#auth-panel .auth-card__intro');
  const logoutBtn    = document.getElementById('logout-btn');
  const roleSelect   = document.getElementById('dash-role-select');
  const roleSaveBtn  = document.getElementById('dash-role-save');

  tabBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => { b.classList.remove('tabs__btn--active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('tabs__btn--active');
      btn.setAttribute('aria-selected', 'true');
      loginForm.hidden    = i !== 0;
      registerForm.hidden = i !== 1;
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = loginForm.querySelector('[name="email"]').value.trim();
    const password = loginForm.querySelector('[name="password"]').value;

    if (!email || !password) { showToast('Заполните все поля', 'error'); return; }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { showToast(error.message, 'error'); return; }

    showToast('Вы вошли в систему', 'success');
    await renderDashboard();
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = registerForm.querySelector('[name="full_name"]').value.trim();
    const email    = registerForm.querySelector('[name="email"]').value.trim();
    const password = registerForm.querySelector('[name="password"]').value;
    const role     = registerForm.querySelector('input[name="role"]:checked')?.value || 'seeker';

    if (!fullName || !email || !password) { showToast('Заполните все поля', 'error'); return; }
    if (password.length < 6) { showToast('Пароль минимум 6 символов', 'error'); return; }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    });

    if (error) { showToast(error.message, 'error'); return; }

    if (data.session) {
      showToast('Регистрация успешна!', 'success');
      await renderDashboard();
    } else {
      showToast('Проверьте почту для подтверждения или отключите подтверждение в Supabase (Authentication → Providers → Email).', 'info');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
    showToast('Вы вышли из системы', 'info');
    location.reload();
  });

  if (roleSaveBtn && roleSelect) {
    roleSaveBtn.addEventListener('click', async () => {
      const user = await getCurrentUser();
      if (!user) return;

      const role = roleSelect.value;
      if (role !== 'seeker' && role !== 'employer') return;

      const { error } = await sb.from('profiles').update({ role }).eq('id', user.id);
      if (error) {
        showToast(error.message, 'error');
        return;
      }
      showToast('Роль сохранена', 'success');
      location.reload();
    });
  }

  const dashProfileSave = document.getElementById('dash-profile-save');
  if (dashProfileSave) {
    dashProfileSave.addEventListener('click', async () => {
      const user = await getCurrentUser();
      if (!user) return;

      const phoneInput = document.getElementById('dash-profile-phone');
      const emailInput = document.getElementById('dash-profile-contact-email');
      const phone = String(phoneInput?.value || '').trim();
      const contact_email = String(emailInput?.value || '').trim();

      const { error } = await sb
        .from('profiles')
        .update({ phone, contact_email })
        .eq('id', user.id);

      if (error) {
        showToast(error.message, 'error');
        return;
      }
      showToast('Контакты сохранены', 'success');
    });
  }

  async function renderDashboard() {
    const user = await getCurrentUser();
    if (!user) return;

    if (authPanel) authPanel.hidden = true;
    authForms.hidden = true;
    if (authIntro) authIntro.hidden = true;
    dashboard.hidden = false;

    const dashboardEl = document.getElementById('dashboard');
    const dashMainEl = document.querySelector('#dashboard .dash__main');
    dashboardEl?.classList.remove('dashboard--admin');
    if (dashMainEl) dashMainEl.hidden = false;

    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    document.getElementById('dash-name').textContent = profile?.full_name || 'Не указано';
    const loginEmailEl = document.getElementById('dash-login-email');
    if (loginEmailEl) loginEmailEl.textContent = user.email || '—';
    const roleLabel =
      profile?.role === 'employer' ? 'Работодатель' : profile?.role === 'admin' ? 'Администратор' : 'Соискатель';
    document.getElementById('dash-role').textContent = roleLabel;

    const phoneInput = document.getElementById('dash-profile-phone');
    const emailInput = document.getElementById('dash-profile-contact-email');
    if (phoneInput) phoneInput.value = profile?.phone || '';
    if (emailInput) {
      const saved = String(profile?.contact_email || '').trim();
      emailInput.value = saved || user.email || '';
    }

    if (roleSelect) {
      roleSelect.value = profile?.role === 'employer' ? 'employer' : 'seeker';
    }

    const roleChangeBlock = document.querySelector('.dash__role-change');
    const isAdmin = profile?.role === 'admin';
    if (roleChangeBlock) roleChangeBlock.hidden = isAdmin;

    const seekerBlock = document.getElementById('dash-seeker-block');
    const employerBlock = document.getElementById('dash-employer-block');
    const adminBlock = document.getElementById('dash-admin-block');

    if (isAdmin) {
      if (seekerBlock) seekerBlock.hidden = true;
      if (employerBlock) employerBlock.hidden = true;
      if (adminBlock) adminBlock.hidden = false;
      dashboardEl?.classList.add('dashboard--admin');
      if (dashMainEl) dashMainEl.hidden = true;
      if (location.hash === '#profile-contacts') {
        document.getElementById('profile-contacts')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    if (adminBlock) adminBlock.hidden = true;

    const isEmployer = profile?.role === 'employer';

    if (seekerBlock) seekerBlock.hidden = isEmployer;
    if (employerBlock) employerBlock.hidden = !isEmployer;

    if (isEmployer) {
      await window.initEmployerPanel?.();
      if (location.hash === '#profile-contacts') {
        document.getElementById('profile-contacts')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    const { data: responses } = await sb
      .from('responses')
      .select('*, vacancies(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const list = document.getElementById('dash-responses');
    if (!list) return;

    if (!responses || responses.length === 0) {
      list.innerHTML = '<p class="auth-form__note">У вас пока нет откликов.</p>';
    } else {
      list.innerHTML = responses.map(r => `
      <div class="dash-response">
        <a href="vacancy.html?id=${r.vacancy_id}" class="dash-response__title">${escapeHtml(r.vacancies.title)}</a>
        <span class="dash-response__employer">${escapeHtml(r.vacancies.employer)}</span>
        <time class="dash-response__date">${formatDate(r.created_at)}</time>
      </div>
    `).join('');
    }

    if (location.hash === '#profile-contacts') {
      document.getElementById('profile-contacts')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  (async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        await renderDashboard();
      } else {
        if (authPanel) authPanel.hidden = false;
        dashboard.hidden = true;
      }
    } catch (_) {
      if (authPanel) authPanel.hidden = false;
      dashboard.hidden = true;
    } finally {
      hideCabinetPageLoader();
    }
  })();
});
