export function finishStartup() {
  document.documentElement.removeAttribute('data-c8-loading');
}

export function showStartupFailure(error: unknown) {
  for (const id of ['app', 'game-surface']) {
    const surface = document.getElementById(id);
    if (surface) { surface.hidden = true; surface.inert = true; }
  }
  finishStartup();
  const alert = document.createElement('div');
  alert.className = 'fatal';
  alert.setAttribute('role', 'alert');
  const title = document.createElement('h2');
  title.textContent = 'Не удалось открыть партию';
  const copy = document.createElement('p');
  copy.textContent = 'Попробуйте загрузить игру ещё раз. Сохранение остаётся на устройстве.';
  const retry = document.createElement('button');
  retry.id = 'startup-retry';
  retry.className = 'primary';
  retry.textContent = 'Повторить загрузку';
  retry.addEventListener('click', () => {
    retry.disabled = true;
    retry.textContent = 'Загружаем…';
    alert.setAttribute('aria-busy', 'true');
    location.reload();
  }, { once: true });
  const details = document.createElement('details'), summary = document.createElement('summary');
  summary.textContent = 'Технические сведения';
  const detail = document.createElement('p');
  detail.textContent = error instanceof Error ? error.message : String(error);
  details.append(summary, detail);
  alert.append(title, copy, retry, details);
  document.body.append(alert);
  retry.focus();
  console.error(error);
}
