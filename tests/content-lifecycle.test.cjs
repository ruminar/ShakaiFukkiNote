const { test } = require("node:test");
const assert = require("node:assert/strict");
const { content, mockNative, mutation, settle } = require("./helpers.cjs");

for (const kind of ["browser", "chrome"]) {
  test(`${kind}：API失効後は古い処理を復元・終了し、警告や再読込を繰り返さない`, async t => {
    const mock = mockNative(kind, true);
    const view = content(mock);
    t.after(() => view.window.close());
    await mutation();
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 2);
    let reads = 0;
    mock.state.readHook = () => { reads++; throw new Error("Extension context invalidated."); };
    mock.native.runtime.id = undefined;
    view.window.dispatchEvent(new view.window.Event("pageshow"));
    await mutation();
    assert.equal(view.document.querySelector("#tag").getAttribute("href"), "/tag/ComfyUI");
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 0);
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search-form").length, 0);
    assert.equal(mock.native.storage.onChanged.size, 0);
    for (let i = 0; i < 3; i++) {
      view.window.dispatchEvent(new view.window.Event("pageshow"));
      view.document.dispatchEvent(new view.window.Event("visibilitychange"));
    }
    await mock.native.storage.onChanged.emit({ enabled: { newValue: true } }, "local");
    await mutation();
    assert.equal(reads, 0);
    assert.deepEqual(view.warnings, []);
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 0);
  });

  test(`${kind}：API呼出中に失効エラーが返った場合も静かに終了する`, async t => {
    const mock = mockNative(kind, true);
    const view = content(mock);
    t.after(() => view.window.close());
    await mutation();
    mock.state.readHook = () => { throw new Error("Extension context invalidated."); };
    view.window.dispatchEvent(new view.window.Event("pageshow"));
    await mutation();
    assert.equal(mock.native.storage.onChanged.size, 0);
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 0);
    assert.deepEqual(view.warnings, []);
  });

  test(`${kind}：古い読込の失敗は新しいON通知を取り消さず警告も出さない`, async t => {
    const mock = mockNative(kind, false);
    const view = content(mock);
    t.after(() => view.window.close());
    await mutation();
    let rejectRead;
    mock.state.readHook = () => new Promise((resolve, reject) => { rejectRead = reject; });
    view.window.dispatchEvent(new view.window.Event("pageshow"));
    await settle();
    await mock.native.storage.onChanged.emit({ enabled: { newValue: true } }, "local");
    rejectRead(new Error("古い読込の失敗"));
    await mutation();
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 2);
    assert.deepEqual(view.warnings, []);
  });

  test(`${kind}：実際の保存領域の読込失敗は警告し、後の再試行で回復する`, async t => {
    const mock = mockNative(kind, true);
    const view = content(mock);
    t.after(() => view.window.close());
    await mutation();
    mock.state.failRead = true;
    view.window.dispatchEvent(new view.window.Event("pageshow"));
    await mutation();
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 0);
    assert.equal(view.warnings.length, 1);
    assert.match(view.warnings[0], /STORAGE_READ_FAILED/u);
    assert.equal(mock.native.storage.onChanged.size, 1);
    mock.state.failRead = false;
    view.window.dispatchEvent(new view.window.Event("pageshow"));
    await mutation();
    assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 2);
  });
}

test("DOMへの反映例外を設定読込失敗と誤表示せず、途中の変更も復元する", async t => {
  const view = content(mockNative("browser", true));
  t.after(() => view.window.close());
  const form = view.document.querySelector("form");
  form.append = () => { throw new Error("DOM操作失敗"); };
  await mutation();
  assert.equal(view.document.querySelector("#tag").getAttribute("href"), "/tag/ComfyUI");
  assert.equal(view.document.querySelectorAll(".shakaifukkinote-search-form").length, 0);
  assert.ok(view.warnings.length > 0);
  assert.ok(view.warnings.every(message => message.includes("DOM_APPLY_FAILED")));
});

test("異常な設定API応答はON扱いせず、読込失敗として安全に停止する", async t => {
  const mock = mockNative("browser", false);
  mock.state.readHook = () => undefined;
  const view = content(mock);
  t.after(() => view.window.close());
  await mutation();
  assert.equal(view.document.querySelectorAll(".shakaifukkinote-search").length, 0);
  assert.ok(view.warnings.every(message => message.includes("STORAGE_READ_FAILED")));
  assert.ok(view.warnings.length > 0);
});
