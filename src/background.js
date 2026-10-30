(() => {
  "use strict";
  const api = globalThis.ShakaiFukkiNote.api;
  let queue = Promise.resolve();

  async function updateDisplay(enabled) {
    const results = await Promise.allSettled([
      api.setBadge(enabled ? "ON" : "OFF"),
      api.setTitle(`社会復帰note：${enabled ? "ON" : "OFF"}`)
    ]);
    if (results.some(result => result.status === "rejected")) {
      console.warn("社会復帰note：状態表示を更新できませんでした。次回の操作で再試行します。");
    }
  }

  function enqueue(toggle = false) {
    const operation = queue.then(async () => {
      const stored = await api.getEnabled();
      const existing = typeof stored.enabled === "boolean";
      let enabled = existing ? stored.enabled : true;
      if (toggle) enabled = !enabled;
      if (!existing || toggle) await api.setEnabled(enabled);
      await updateDisplay(enabled);
    });
    // 失敗した処理で後続の操作まで停止させない。ページや入力内容はログへ出さない。
    queue = operation.catch(() => {
      console.warn("社会復帰note：設定を保存できませんでした。もう一度操作してください。");
    });
    return queue;
  }

  // 非永続バックグラウンドでもイベントで起動できるよう、同期登録する。
  api.onClicked.addListener(() => enqueue(true));
  api.onInstalled.addListener(() => enqueue());
  api.onStartup.addListener(() => enqueue());
  enqueue();
})();
