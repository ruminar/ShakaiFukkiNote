const { test } = require("node:test");
const assert = require("node:assert/strict");
const { content, mockNative, mutation } = require("./helpers.cjs");

for (const kind of ["browser", "chrome"]) {
  test(`${kind}：SPAが元タグURLを使う場合も、通常クリックを検索へ遷移させる`, async t => {
    const navigations = [];
    const view = content(mockNative(kind, true), undefined, { navigate: url => navigations.push(url) });
    t.after(() => view.window.close());
    await mutation();
    const { document, window } = view;
    const link = document.querySelector("#tag");
    const written = link.href;
    let siteCalls = 0;
    // href属性を書き換えても、サイトのルーターは元のURLを保持している状況を再現する。
    document.querySelector("main").addEventListener("click", event => {
      siteCalls++;
      event.preventDefault();
      navigations.push("https://note.com/tag/ComfyUI");
    });
    link.innerHTML = '<span><svg><path></path></svg></span>';
    const click = new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    assert.equal(link.querySelector("path").dispatchEvent(click), false);
    assert.deepEqual(navigations, [written]);
    assert.equal(new URL(navigations[0]).searchParams.get("q"), "#ComfyUI");
    assert.equal(new URL(navigations[0]).searchParams.get("sort"), "new");
    assert.equal(siteCalls, 0);
    assert.equal(link.href, written);
    // Enterで実行するリンクのclickはdetail=0でも同じ検索先を使う。
    link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 0 }));
    assert.deepEqual(navigations, [written, written]);
  });
}

test("修飾キー・新規タブ・右クリック・ダウンロード等の標準操作へ介入しない", async () => {
  const cases = [
    { name: "Ctrl", init: { ctrlKey: true } },
    { name: "Meta", init: { metaKey: true } },
    { name: "Shift", init: { shiftKey: true } },
    { name: "Alt", init: { altKey: true } },
    { name: "ミドルクリック", type: "auxclick", init: { button: 1 } },
    { name: "右クリック", type: "contextmenu", init: { button: 2 } },
    { name: "別タブ指定", setup: link => link.target = "_blank" },
    { name: "別フレーム指定", setup: link => link.target = "result" },
    { name: "親フレーム指定", setup: link => link.target = "_parent" },
    { name: "ダウンロード", setup: link => link.setAttribute("download", "") },
    { name: "baseによる別タブ指定", setup: (link, document) => {
      const base = document.createElement("base");
      base.target = "_blank";
      document.head.append(base);
    } },
    { name: "サイトによるhref再設定直後", setup: link => link.setAttribute("href", "/tag/別のタグ") },
    { name: "記事リンク", selector: "#article" },
    { name: "外部リンク", selector: "#external" },
    { name: "キャンセル不能イベント", init: { cancelable: false } }
  ];
  for (const scenario of cases) {
    const navigations = [];
    const view = content(mockNative("browser", true), undefined, { navigate: url => navigations.push(url) });
    try {
      await mutation();
      const link = view.document.querySelector(scenario.selector ?? "#tag");
      scenario.setup?.(link, view.document);
      const type = scenario.type ?? "click";
      let reachedSite = false;
      let canceledByExtension;
      view.document.addEventListener(type, event => {
        reachedSite = true;
        canceledByExtension = event.defaultPrevented;
        event.preventDefault(); // JSDOMの既定ナビゲーションはこの試験では実行しない。
      });
      link.dispatchEvent(new view.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...scenario.init }));
      assert.equal(reachedSite, true, scenario.name);
      assert.equal(canceledByExtension, false, scenario.name);
      assert.deepEqual(navigations, [], scenario.name);
    } finally { view.window.close(); }
  }
});

test("OFFでクリック補助を解除し、再ONで1回だけ検索へ遷移する", async t => {
  const mock = mockNative("browser", true);
  const navigations = [];
  const view = content(mock, undefined, { navigate: url => navigations.push(url) });
  t.after(() => view.window.close());
  await mutation();
  const link = view.document.querySelector("#tag");
  let siteCalls = 0;
  view.document.addEventListener("click", event => { siteCalls++; event.preventDefault(); });
  const click = () => link.dispatchEvent(new view.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  click();
  assert.equal(navigations.length, 1);
  await mock.native.storage.onChanged.emit({ enabled: { newValue: false } }, "local");
  click();
  assert.equal(link.getAttribute("href"), "/tag/ComfyUI");
  assert.equal(navigations.length, 1);
  assert.equal(siteCalls, 1);
  await mock.native.storage.onChanged.emit({ enabled: { newValue: true } }, "local");
  click();
  assert.equal(navigations.length, 2);
  assert.equal(siteCalls, 1);
});

test("先行リスナーがキャンセルしたクリックには介入しない", async t => {
  const navigations = [];
  const view = content(mockNative("browser", true), undefined, { navigate: url => navigations.push(url) });
  t.after(() => view.window.close());
  // 設定読込が終わり、拡張の補助が登録される前にサイトの先行リスナーを登録する。
  view.window.addEventListener("click", event => event.preventDefault(), true);
  await mutation();
  let reachedSite = false;
  view.document.addEventListener("click", () => { reachedSite = true; });
  view.document.querySelector("#tag").dispatchEvent(new view.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  assert.equal(reachedSite, true);
  assert.deepEqual(navigations, []);
});

test("新規タブ表示に使うhrefとリンクコピーの値をクリック補助で変更しない", async t => {
  const navigations = [];
  const view = content(mockNative("browser", true), undefined, { navigate: url => navigations.push(url) });
  t.after(() => view.window.close());
  await mutation();
  const link = view.document.querySelector("#hashtag");
  const before = link.getAttribute("href");
  link.dispatchEvent(new view.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
  assert.equal(link.getAttribute("href"), before);
  assert.equal(new URL(link.href).searchParams.get("q"), "#推し活");
  assert.deepEqual(navigations, []);
});
