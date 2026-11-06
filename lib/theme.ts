/**
 * Dark mode lives as a `dark` class on <html>. With no saved choice the page
 * follows the system setting; the toggle saves an explicit choice.
 */
const STORAGE_KEY = 'theme';
const SYSTEM_DARK = '(prefers-color-scheme: dark)';

/** Runs in <head> before first paint, so dark pages never flash light. */
export const THEME_INIT_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem('${STORAGE_KEY}')}catch(e){}var d=t==='dark'||(t!=='light'&&matchMedia('${SYSTEM_DARK}').matches);document.documentElement.classList.toggle('dark',d)})()`;

function readSavedTheme(): string | null {
  // Storage can throw in private windows or with site data blocked.
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyTheme() {
  const saved = readSavedTheme();
  const dark =
    saved === 'dark' ||
    (saved !== 'light' && window.matchMedia(SYSTEM_DARK).matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function isDarkTheme() {
  return document.documentElement.classList.contains('dark');
}

export function setDarkTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch {
    // The choice still applies to this page; it just won't be remembered.
  }
}

/** Watches the <html> class, and keeps it current with the OS and other tabs. */
export function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  const system = window.matchMedia(SYSTEM_DARK);
  system.addEventListener('change', applyTheme);
  window.addEventListener('storage', applyTheme);
  return () => {
    observer.disconnect();
    system.removeEventListener('change', applyTheme);
    window.removeEventListener('storage', applyTheme);
  };
}
