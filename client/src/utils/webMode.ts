export const WEB_MODE_KEY = 'qbz_web_mode';

// ?mode=web only ever appears on the first URL someone opens. Routing to /search
// or reloading drops the query string, so reading it alone turns every refresh
// and every bookmarked deep link into the desktop-only notice. Remember the
// choice instead, and let ?mode=desktop undo it.
export function resolveWebMode(): boolean {
    if (typeof window === 'undefined') return false;

    const requested = new URLSearchParams(window.location.search).get('mode');

    try {
        if (requested === 'web') {
            window.localStorage.setItem(WEB_MODE_KEY, '1');
            return true;
        }

        if (requested === 'desktop') {
            window.localStorage.removeItem(WEB_MODE_KEY);
            return false;
        }

        return window.localStorage.getItem(WEB_MODE_KEY) === '1';
    } catch {
        // Storage access throws when cookies are blocked. A fresh ?mode=web link
        // still works; it just will not be remembered.
        return requested === 'web';
    }
}
