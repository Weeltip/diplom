// Статусы откликов и трудоустройство

const RESPONSE_STATUSES = [
  { id: 'pending', label: 'Отправлен', css: 'response-status--pending' },
  { id: 'viewed', label: 'Просмотрен', css: 'response-status--viewed' },
  { id: 'invited', label: 'Приглашён', css: 'response-status--invited' },
  { id: 'hired', label: 'Трудоустроен', css: 'response-status--hired' },
  { id: 'rejected', label: 'Отказ', css: 'response-status--rejected' }
];

function responseStatusById(id) {
  const key = String(id || 'pending').trim() || 'pending';
  return RESPONSE_STATUSES.find((s) => s.id === key) || RESPONSE_STATUSES[0];
}

function responseStatusBadgeHtml(status, opts = {}) {
  const s = responseStatusById(status);
  const title = opts.title ? ` title="${escapeHtml(opts.title)}"` : '';
  return `<span class="response-status ${s.css}"${title}>${escapeHtml(s.label)}</span>`;
}

function responseMessageHtml(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  const body = escapeHtml(text).replace(/\n/g, '<br>');
  return `
    <div class="response-message">
      <p class="response-message__label">Сообщение соискателя</p>
      <p class="response-message__text">${body}</p>
    </div>`;
}

function responseStatusEmployerActionsHtml(responseId, currentStatus) {
  const st = responseStatusById(currentStatus).id;
  const id = Number(responseId);
  if (!id) return '';

  const items = [];

  if (st === 'pending') {
    items.push({ status: 'viewed', label: 'Просмотрен', className: 'btn btn--sm btn--ghost' });
  }
  if (st !== 'invited' && st !== 'hired' && st !== 'rejected') {
    items.push({ status: 'invited', label: 'Пригласить', className: 'btn btn--sm btn--outline' });
  }
  if (st !== 'hired' && st !== 'rejected') {
    items.push({ status: 'hired', label: 'Трудоустроен', className: 'btn btn--sm btn--primary' });
  }
  if (st !== 'rejected') {
    items.push({ status: 'rejected', label: 'Отказ', className: 'btn btn--sm btn--danger' });
  }

  if (!items.length) {
    return '<p class="employer-response-card__status-note">Статус зафиксирован.</p>';
  }

  return `
    <div class="employer-response-card__status-actions" role="group" aria-label="Статус отклика">
      ${items
        .map(
          (item) =>
            `<button type="button" class="${item.className}" data-response-status="${item.status}" data-response-id="${id}">${escapeHtml(item.label)}</button>`
        )
        .join('')}
    </div>`;
}

async function updateResponseStatus(responseId, status) {
  const { error } = await sb
    .from('responses')
    .update({ status })
    .eq('id', responseId);

  if (error) throw error;
}

function bindResponseStatusActions(host, onUpdated) {
  if (!host || host.dataset.statusBound === '1') return;
  host.dataset.statusBound = '1';

  host.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-response-status]');
    if (!btn || !host.contains(btn)) return;

    const responseId = Number(btn.dataset.responseId);
    const status = btn.dataset.responseStatus;
    if (!responseId || !status) return;

    if (status === 'hired') {
      if (!confirm('Отметить соискателя как трудоустроенного по этой вакансии?')) return;
    }
    if (status === 'rejected') {
      if (!confirm('Отказать соискателю по этому отклику?')) return;
    }

    btn.disabled = true;
    try {
      await updateResponseStatus(responseId, status);
      showToast(responseStatusById(status).label, 'success');
      if (typeof onUpdated === 'function') await onUpdated();
    } catch (err) {
      console.error(err);
      showToast(formatSupabaseError(err), 'error');
      btn.disabled = false;
    }
  });
}
