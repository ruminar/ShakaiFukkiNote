/* ブラウザ差分はこのファイル内に閉じ込める。 */
(() => {
  "use strict";
  const app = globalThis.ShakaiFukkiNote ??= {};
  if (app.api) return;
  const native = globalThis.browser ?? globalThis.chrome;
  if (!native?.storage?.local) throw new Error("拡張APIを利用できません。");
  const promiseAPI = Boolean(globalThis.browser);

  function isAvailable() {
    try { return Boolean(native.runtime?.id); }
    catch { return false; }
  }

  function isContextInvalidated(error) {
    return !isAvailable() || error?.code === "EXTENSION_CONTEXT_INVALIDATED" ||
      /^(?:Extension context invalidated\.?|WebExtension context not found!?)$/iu.test(error?.message ?? "");
  }

  function call(owner, name, value) {
    if (!isAvailable()) {
      const error = new Error("拡張の実行環境が終了しています。");
      error.code = "EXTENSION_CONTEXT_INVALIDATED";
      return Promise.reject(error);
    }
    if (promiseAPI) {
      return Promise.resolve().then(() => owner[name](value));
    }
    return new Promise((resolve, reject) => {
      owner[name](value, result => {
        const error = native.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  app.api = Object.freeze({
    isAvailable,
    isContextInvalidated,
    getEnabled: () => call(native.storage.local, "get", "enabled"),
    setEnabled: enabled => call(native.storage.local, "set", { enabled }),
    onStorageChanged: native.storage.onChanged,
    onClicked: native.action?.onClicked,
    onInstalled: native.runtime.onInstalled,
    onStartup: native.runtime.onStartup,
    setBadge: text => call(native.action, "setBadgeText", { text }),
    setTitle: title => call(native.action, "setTitle", { title })
  });
})();
