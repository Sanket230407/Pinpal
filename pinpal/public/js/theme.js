// PinPal theme switch: dark <-> light.
// Loaded in the <head> of every page so the saved theme is applied BEFORE the page
// paints (no flash of the wrong colours). The CSS reads the data-theme attribute
// on <html>: dark is the default, [data-theme='light'] switches the tokens.
(() => {
  const KEY = 'pinpal_theme';
  const root = document.documentElement;

  // Reading localStorage can throw in private windows, so wrap it.
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(theme) { try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ } }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    // update every toggle button on the page (label for screen readers, icon via CSS)
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      const next = theme === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', `Switch to ${next} mode`);
      btn.title = `Switch to ${next} mode`;
    });
  }

  apply(saved() === 'light' ? 'light' : 'dark');

  // Once the page exists, fill each button with a sun + moon icon and make it clickable.
  document.addEventListener('DOMContentLoaded', () => {
    const icons =
      '<svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.innerHTML = icons;
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        save(next);
        apply(next);
      });
    });
    apply(root.getAttribute('data-theme')); // set the labels now that the buttons exist
  });
})();
