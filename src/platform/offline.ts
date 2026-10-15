/** Install the production bundle for reopening offline; development stays uncached. */
export function registerOffline(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  const register = () => {
    const base = new URL(import.meta.env.BASE_URL, window.location.href);
    void navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' }).catch(() => {
      // Storage restrictions or unavailable service workers do not stop the game.
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
