/**
 * SSR-safe localStorage wrapper
 * typeof window === 'undefined' のサーバー環境では何もしない
 * --localstorage-file フラグによる壊れた localStorage オブジェクトにも対応
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.localStorage === 'undefined' || window.localStorage === null) return false;
  if (typeof window.localStorage.getItem !== 'function') return false;
  if (typeof window.localStorage.setItem !== 'function') return false;
  return true;
}

const storage = {
  get(key: string): string | null {
    if (!isLocalStorageAvailable()) return null;
    try { return window.localStorage.getItem(key); }
    catch { return null; }
  },
  set(key: string, value: string): void {
    if (!isLocalStorageAvailable()) return;
    try { window.localStorage.setItem(key, value); }
    catch { /* quota exceeded などを無視 */ }
  },
};

export default storage;
