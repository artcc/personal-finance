(() => {
  'use strict';

  const storageKey = 'personal-finance.website-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'auto';

  try {
    preference = window.localStorage.getItem(storageKey) === 'light' ? 'light' : 'auto';
  } catch {
    // Automatic mode also works when browser storage is unavailable.
  }

  function applyTheme() {
    root.dataset.theme = preference;
    const dark = preference === 'auto' && system.matches;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#101b1d' : '#f5f7f8');
    const control = document.getElementById('theme-mode');
    if (control) control.value = preference;
  }

  // Set the stored preference before the stylesheet is loaded to avoid a theme flash.
  applyTheme();
  system.addEventListener('change', applyTheme);

  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = event.newValue === 'light' ? 'light' : 'auto';
    applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const control = document.getElementById('theme-mode');
    if (!control) return;
    control.disabled = false;
    control.value = preference;
    control.addEventListener('change', () => {
      preference = control.value === 'light' ? 'light' : 'auto';
      try {
        window.localStorage.setItem(storageKey, preference);
      } catch {
        // Keep the selection for this visit even if it cannot be persisted.
      }
      applyTheme();
    });
  });
})();
