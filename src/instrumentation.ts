/**
 * Next.js instrumentation hook
 * サーバー起動時に一度だけ実行される
 * Turbopack の --localstorage-file フラグが Node.js に壊れた localStorage を
 * 注入する問題をパッチする
 */
export async function register() {
  if (typeof globalThis.localStorage !== 'undefined') {
    // localStorage オブジェクトが存在するが getItem が関数でない場合（Turbopack の副作用）
    // 安全な no-op 実装に置き換える
    if (typeof (globalThis.localStorage as Storage).getItem !== 'function') {
      const noop = {
        getItem: (_key: string): null => null,
        setItem: (_key: string, _value: string): void => {},
        removeItem: (_key: string): void => {},
        clear: (): void => {},
        key: (_index: number): null => null,
        length: 0,
      };
      // 読み取り専用プロパティの場合も強制的に上書き
      try {
        Object.defineProperty(globalThis, 'localStorage', {
          value: noop,
          writable: true,
          configurable: true,
        });
      } catch {
        // 上書きできない場合は何もしない
      }
    }
  }
}
