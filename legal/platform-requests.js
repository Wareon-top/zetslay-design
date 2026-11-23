(() => {
  const form = document.querySelector('[data-platform-request-form]');
  const draft = document.querySelector('[data-platform-request-draft]');
  if (!form || !draft) return;

  const message = draft.querySelector('textarea');
  const draftTitle = draft.querySelector('h3');
  const open = draft.querySelector('[data-platform-request-open]');
  const copy = draft.querySelector('[data-platform-request-copy]');
  const status = draft.querySelector('[role="status"]');
  const subject = 'Запрос торговой площадки — ZetSlay';
  const fields = [
    ['platform', 'Площадка'],
    ['representative', 'Организация и роль'],
    ['contact', 'Служебный email'],
    ['action', 'Запрашиваемое действие'],
    ['target', 'Интеграция или проект'],
    ['reason', 'Основание запроса'],
  ];

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    for (const [name] of fields) {
      const input = form.elements.namedItem(name);
      if (!values.get(name).trim()) {
        input.setCustomValidity('Заполните это поле.');
        input.reportValidity();
        return;
      }
    }

    message.value = fields.map(([name, label]) =>
      `${label}\n${values.get(name).trim()}`
    ).join('\n\n');
    const body = message.value.replace(/\r?\n/g, '\r\n');
    open.href = `mailto:${form.dataset.platformEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    draft.hidden = false;
    status.textContent = '';
    draftTitle.focus();
  });

  form.addEventListener('input', (event) => {
    event.target.setCustomValidity('');
    draft.hidden = true;
  });

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Текст обращения скопирован.';
    } catch {
      message.focus();
      message.select();
      status.textContent = 'Текст выделен. Скопируйте его в письмо.';
    }
  });

  form.hidden = false;
})();
