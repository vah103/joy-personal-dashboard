(() => {
  const DESKTOP_ROOT_SELECTOR = '[data-vocab-practice-root="desktop"]';
  let scheduled = false;

  function scheduleCompactRender() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      compactDesktopRoot();
    });
  }

  function compactDesktopRoot() {
    const root = document.querySelector(DESKTOP_ROOT_SELECTOR);
    if (!root || root.querySelector('.vocabulary-compact-card')) return;

    const heading = root.querySelector('.vocabulary-widget-heading');
    if (!heading) return;

    const prompt = cleanText(root.querySelector('.vocabulary-prompt')?.textContent);
    const direction = cleanText(root.querySelector('.vocabulary-direction')?.textContent);
    const countText = cleanText(heading.querySelector('small')?.textContent);
    const countMatch = countText.match(/\d+/);
    const count = countMatch ? countMatch[0] : root.querySelector('.vocabulary-empty') ? '0' : '…';
    const route = /→\s*English word/i.test(direction)
      ? 'VI → EN'
      : /→\s*Vietnamese word/i.test(direction)
        ? 'EN → VI'
        : '';
    const hasWords = Boolean(prompt);

    root.innerHTML = `
      <section class="vocabulary-compact-card" aria-label="Vocabulary">
        <div class="vocabulary-compact-topline" role="button" tabindex="0">
          <div class="vocabulary-compact-title">
            <strong>Words</strong>
            <span aria-label="${escapeHtml(count)} saved words">${escapeHtml(count)}</span>
          </div>
        </div>
        ${hasWords ? `
          <button class="vocabulary-compact-preview" type="button" data-vocab-open-practice aria-label="Practice vocabulary and enter an answer">
            <span class="vocabulary-compact-meta">
              <small>${escapeHtml(route)}</small>
              <em>Practice</em>
            </span>
            <strong>${escapeHtml(prompt)}</strong>
            <span class="vocabulary-compact-arrow" aria-hidden="true">→</span>
          </button>
        ` : `
          <div class="vocabulary-compact-empty">
            <span aria-hidden="true">Aa</span>
            <small>Add a word</small>
          </div>
        `}
      </section>
    `;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  const widget = document.querySelector('.vocabulary-widget');
  if (!widget) return;

  const observer = new MutationObserver(scheduleCompactRender);
  observer.observe(widget, { childList: true, subtree: true });
  compactDesktopRoot();
})();
