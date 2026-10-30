const { test } = require("node:test");
const assert = require("node:assert/strict");
const { content, mockNative, mutation, settle, source } = require("./helpers.cjs");
const buttonSelector = ".shakaifukkinote-search";

for (const kind of ["browser", "chrome"]) {
  test(`${kind}：初期適用、全タブOFF復元、再ON、重複注入を防止`, async t => {
    const mock = mockNative(kind, true);
    const first = content(mock);
    const second = content(mock);
    t.after(() => { first.window.close(); second.window.close(); });
    await mutation();
    for (const { document, window } of [first, second]) {
      assert.equal(new URL(document.querySelector("#tag").href).searchParams.get("q"), "#ComfyUI");
      assert.equal(new URL(document.querySelector("#hashtag").href).searchParams.get("q"), "#推し活");
      assert.equal(document.querySelector("#article").getAttribute("href"), "/creator/n/article");
      assert.equal(document.querySelector("#contest").getAttribute("href"), "/contest/AI");
      assert.equal(document.querySelectorAll(buttonSelector).length, 2);
      window.eval(source("content.js"));
      assert.equal(document.querySelectorAll(buttonSelector).length, 2);
    }
    await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
    for (const { document } of [first, second]) {
      assert.equal(document.querySelector("#tag").getAttribute("href"), "/tag/ComfyUI");
      assert.equal(document.querySelectorAll(buttonSelector).length, 0);
      assert.equal(document.querySelectorAll(".shakaifukkinote-search-form").length, 0);
    }
    await mock.native.storage.onChanged.emit({ enabled: { newValue: true } }, "local");
    await mutation();
    assert.equal(first.document.querySelectorAll(buttonSelector).length, 2);
    assert.equal(second.document.querySelectorAll(buttonSelector).length, 2);
  });

  test(`${kind}：初期OFFではDOMを変更しない`, async t => {
    const view = content(mockNative(kind, false));
    t.after(() => view.window.close());
    await mutation();
    assert.equal(view.document.querySelector("#tag").getAttribute("href"), "/tag/ComfyUI");
    assert.equal(view.document.querySelectorAll(buttonSelector).length, 0);
  });

  test(`${kind}：初期読込中の新しい変更通知が古い結果に負けない`, async t => {
    const mock = mockNative(kind, true);
    let finish;
    mock.state.readHook = () => new Promise(resolve => { finish = resolve; });
    const view = content(mock);
    t.after(() => view.window.close());
    await settle();
    await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
    finish({ enabled: true });
    await mutation();
    assert.equal(view.document.querySelector("#tag").getAttribute("href"), "/tag/ComfyUI");
  });

  test(`${kind}：サイトが変更したhrefをOFFで古いURLへ戻さない`, async t => {
    const mock = mockNative(kind, true);
    const view = content(mock);
    t.after(() => view.window.close());
    await mutation();
    const tag = view.document.querySelector("#tag");
    tag.setAttribute("href", "/creator/n/new");
    // MutationObserverの処理前にOFFが届く競合も確認する。
    await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
    assert.equal(tag.getAttribute("href"), "/creator/n/new");
  });
}

test("SPAの追加・要素再利用・遅延描画と原状復帰", async t => {
  const mock = mockNative("browser", true);
  const view = content(mock);
  t.after(() => view.window.close());
  await mutation();
  const { document } = view;
  const tag = document.querySelector("#tag");
  tag.setAttribute("href", "/hashtag/新しいタグ");
  const section = document.createElement("section");
  section.innerHTML = '<a href="/tag/追加タグ">追加</a>';
  document.querySelector("main").append(section);
  view.window.history.pushState({}, "", "/search?q=test");
  await mutation();
  assert.equal(new URL(tag.href).searchParams.get("q"), "#新しいタグ");
  assert.equal(new URL(section.firstChild.href).searchParams.get("q"), "#追加タグ");
  await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
  assert.equal(tag.getAttribute("href"), "/hashtag/新しいタグ");
  assert.equal(section.firstChild.getAttribute("href"), "/tag/追加タグ");
  section.firstChild.setAttribute("href", "/tag/OFF中");
  await mutation();
  assert.equal(section.firstChild.getAttribute("href"), "/tag/OFF中");
});

test("切り離されたリンクは復元して解放し、再挿入時に改めて処理する", async t => {
  const mock = mockNative("browser", true);
  const view = content(mock);
  t.after(() => view.window.close());
  await mutation();
  const tag = view.document.querySelector("#tag");
  tag.remove();
  await mutation();
  assert.equal(tag.getAttribute("href"), "/tag/ComfyUI");
  view.document.body.append(tag);
  await mutation();
  assert.equal(new URL(tag.href).searchParams.get("q"), "#ComfyUI");
  await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
  assert.equal(tag.getAttribute("href"), "/tag/ComfyUI");
});

test("検索フォーム・入力欄・追加ボタンの再描画で重複しない", async t => {
  const mock = mockNative("browser", true);
  const view = content(mock);
  t.after(() => view.window.close());
  await mutation();
  const { document } = view;
  const form = document.querySelector("form");
  const input = form.querySelector("input");
  input.replaceWith(input.cloneNode());
  await mutation();
  assert.equal(document.querySelectorAll(buttonSelector).length, 2);
  document.querySelector(buttonSelector).remove();
  await mutation();
  assert.equal(document.querySelectorAll(buttonSelector).length, 2);
  form.replaceWith(form.cloneNode(true));
  await mutation();
  assert.equal(document.querySelectorAll(buttonSelector).length, 2);
  document.querySelector("form").setAttribute("action", "/post");
  await mutation();
  assert.equal(document.querySelectorAll(buttonSelector).length, 1);
  await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
  assert.equal(document.querySelectorAll(".shakaifukkinote-search-form").length, 0);
});

test("公式フォーム送信や修飾クリックを捕捉せず、追加ボタンは独立する", async t => {
  const view = content(mockNative("browser", true));
  t.after(() => view.window.close());
  await mutation();
  const { document, window } = view;
  const form = document.querySelector("form");
  assert.equal(document.querySelector(buttonSelector).type, "button");
  const button = document.querySelector(buttonSelector);
  assert.equal(button.parentElement, form);
  assert.equal(form.lastElementChild, button);
  assert.equal(button.getAttribute("aria-label"), "タグを新着検索");
  assert.equal(button.title, "タグを新着検索");
  assert.equal(button.textContent, "");
  assert.equal(button.querySelector("svg").getAttribute("aria-hidden"), "true");
  assert.equal(button.querySelector("svg").namespaceURI, "http://www.w3.org/2000/svg");
  const submit = new window.Event("submit", { bubbles: true, cancelable: true });
  assert.equal(form.dispatchEvent(submit), true);
  const click = new window.MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  assert.equal(document.querySelector("#tag").dispatchEvent(click), true);
  await mutation();
  const before = view.errors.filter(error => /navigation/i.test(error.message)).length;
  // 空欄・#のみはlocation.assignを呼ばない。
  form.querySelector("input").value = "＃";
  document.querySelector(buttonSelector).click();
  await mutation();
  assert.equal(view.errors.filter(error => /navigation/i.test(error.message)).length, before);
});

test("pageshowで休止中の設定変更を読み直し、他領域の通知を無視する", async t => {
  const mock = mockNative("browser", true);
  const view = content(mock);
  t.after(() => view.window.close());
  await mutation();
  await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "sync");
  assert.equal(view.document.querySelectorAll(buttonSelector).length, 2);
  mock.state.value = false;
  view.window.dispatchEvent(new view.window.Event("pageshow"));
  await mutation();
  assert.equal(view.document.querySelectorAll(buttonSelector).length, 0);
});

test("設定読込失敗では変更せず、後の復帰時に再試行する", async t => {
  const mock = mockNative("browser", true);
  mock.state.failRead = true;
  const view = content(mock);
  t.after(() => view.window.close());
  await mutation();
  assert.equal(view.document.querySelectorAll(buttonSelector).length, 0);
  mock.state.failRead = false;
  view.window.dispatchEvent(new view.window.Event("pageshow"));
  await mutation();
  assert.equal(view.document.querySelectorAll(buttonSelector).length, 2);
});

test("自分自身のMutationで無限更新しない", async t => {
  const view = content(mockNative("browser", true));
  t.after(() => view.window.close());
  await mutation();
  let changes = 0;
  const observer = new view.window.MutationObserver(records => { changes += records.length; });
  observer.observe(view.document.body, { subtree: true, childList: true, attributes: true });
  view.document.querySelector("#tag").setAttribute("href", "/tag/変更");
  await mutation();
  assert.equal(changes, 2);
  await mutation();
  assert.equal(changes, 2);
  observer.disconnect();
});
