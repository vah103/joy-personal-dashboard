(() => {
  const modal = document.querySelector('[data-vocab-practice-modal="true"]');
  const panel = modal?.querySelector('.vocabulary-mobile-modal');
  const root = panel?.querySelector('[data-vocab-practice-root="mobile"]');
  const heading = panel?.querySelector('.modal-heading');
  const headingCopy = heading?.querySelector('div');
  if (!modal || !panel || !root || !heading || !headingCopy) return;

  panel.removeAttribute('aria-labelledby');
  panel.setAttribute('aria-label', 'Quick practice');
  heading.querySelector('#vocabulary-mobile-title')?.remove();

  let count = heading.querySelector('[data-vocab-practice-count]');
  if (!count) {
    count = document.createElement('p');
    count.className = 'vocabulary-practice-modal-count';
    count.dataset.vocabPracticeCount = 'true';
    headingCopy.append(count);
  }

  function syncPracticeHeader() {
    const source = root.querySelector('.vocabulary-widget-heading small');
    count.textContent = source?.textContent?.trim() || '';
  }

  const observer = new MutationObserver(syncPracticeHeader);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  syncPracticeHeader();
})();
