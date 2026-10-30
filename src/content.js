(() => {
  "use strict";
  const app = globalThis.ShakaiFukkiNote;
  if (app.contentStarted) return;
  app.contentStarted = true;
  const { api, tagURL } = app;
  const links = new Map();
  const buttons = new Map();
  const pending = new Set();
  const inputSelector = 'input[type="search"][name="q"], input[aria-label="キーワードやクリエイターで検索"]';
  let enabled = false;
  let timer = null;
  let revision = 0;
  let readSequence = 0;

  function restoreLink(link, record) {
    if (link.getAttribute("href") === record.written) link.setAttribute("href", record.original);
  }

  function rewriteLink(link) {
    if (!link.isConnected) return;
    const original = link.getAttribute("href");
    const previous = links.get(link);
    if (previous?.written === original) return;
    links.delete(link);
    const written = tagURL.rewriteURL(original, document.baseURI);
    if (!written) return;
    links.set(link, { original, written });
    link.setAttribute("href", written);
  }

  function eligibleInput(form) {
    if (!form.matches('form[role="search"]')) return null;
    // DOM確認済みの検索フォームだけに限定する。非表示フォームは親の表示に従う。
    const action = form.getAttribute("action");
    if (action !== null && action !== "/search") return null;
    return form.querySelector(inputSelector);
  }

  function removeButton(form, record) {
    record.button.remove();
    if (!record.hadLayoutClass) form.classList.remove("shakaifukkinote-search-form");
    buttons.delete(form);
  }

  function addButton(form) {
    if (!form.isConnected) return;
    const input = eligibleInput(form);
    const previous = buttons.get(form);
    if (!input) {
      if (previous) removeButton(form, previous);
      return;
    }
    if (previous?.button.parentElement === form && previous.input === input) return;
    if (previous) removeButton(form, previous);
    // SPAがフォームごと複製した場合、イベントを持たない旧ボタンも引き継がれる。
    const inheritedButtons = form.querySelectorAll(":scope > button.shakaifukkinote-search");
    const hadLayoutClass = form.classList.contains("shakaifukkinote-search-form") && inheritedButtons.length === 0;
    inheritedButtons.forEach(button => button.remove());
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shakaifukkinote-search";
    button.setAttribute("aria-label", "タグを新着検索");
    button.title = "タグを新着検索";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", "M4 7a9.2 9.2 0 0 0 13 13L4 7Zm6 7 4-4M9 19l-2 3H4m3 0h6M14 2a8 8 0 0 1 8 8M14 6a4 4 0 0 1 4 4");
    svg.append(path);
    button.append(svg);
    button.addEventListener("click", () => {
      if (!enabled || !form.isConnected || !input.isConnected) return;
      const url = tagURL.searchURL(input.value);
      if (url) location.assign(url);
    });
    // 既存の検索欄を動かさず、フォーム内の右端へ独立したbuttonを追加する。
    form.classList.add("shakaifukkinote-search-form");
    form.append(button);
    buttons.set(form, { button, input, hadLayoutClass });
  }

  function scan(root) {
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches("a[href]")) rewriteLink(root);
      if (root.matches("form")) addButton(root);
      const form = root.closest("form");
      if (form) addButton(form);
    }
    root.querySelectorAll?.("a[href]").forEach(rewriteLink);
    root.querySelectorAll?.('form[role="search"]').forEach(addButton);
  }

  function flush() {
    timer = null;
    if (!enabled) return;
    // 移動した要素は維持し、切り離されたものは復元して参照を解放する。
    for (const [link, record] of links) {
      if (!link.isConnected) {
        restoreLink(link, record);
        links.delete(link);
      }
    }
    for (const [form, record] of buttons) {
      if (!form.isConnected || !record.button.isConnected || !form.contains(record.input)) {
        removeButton(form, record);
        if (form.isConnected) pending.add(form);
      }
    }
    const roots = [...pending];
    pending.clear();
    for (const root of roots) {
      if (root.isConnected) scan(root);
    }
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") pending.add(record.target);
      else {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains("shakaifukkinote-search")) pending.add(node);
        }
        // 検索フォーム内の入力差し替え・削除も再判定する。
        const form = record.target.closest?.("form");
        if (form) pending.add(form);
      }
    }
    if (timer === null) timer = setTimeout(flush, 0);
  });

  function apply(nextEnabled) {
    if (enabled === nextEnabled) return;
    enabled = nextEnabled;
    if (enabled) {
      scan(document);
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["href", "role", "action", "type", "name", "aria-label"] });
    } else {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
      for (const [link, record] of links) restoreLink(link, record);
      links.clear();
      for (const [form, record] of buttons) removeButton(form, record);
    }
  }

  async function refresh() {
    const startRevision = revision;
    const sequence = ++readSequence;
    try {
      const stored = await api.getEnabled();
      if (startRevision === revision && sequence === readSequence) apply(typeof stored.enabled === "boolean" ? stored.enabled : true);
    } catch {
      if (startRevision === revision && sequence === readSequence) apply(false);
      console.warn("社会復帰note：設定を読み込めませんでした。ページの変更を停止します。");
    }
  }

  // 初期読込中の通知を取りこぼさないよう先に購読する。
  api.onStorageChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.hasOwn(changes, "enabled")) return;
    revision++;
    const value = changes.enabled.newValue;
    apply(typeof value === "boolean" ? value : true);
  });
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  refresh();
})();
