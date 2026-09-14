(() => {
  'use strict';

  const system = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme() {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', system.matches ? '#101b1d' : '#f5f7f8');
  }

  // Keep the browser chrome aligned with the system-driven CSS palette.
  applyTheme();
  system.addEventListener('change', applyTheme);
})();
