const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mockNative, background, settle } = require("./helpers.cjs");

for (const kind of ["browser", "chrome"]) {
  test(`${kind}：同期リスナー登録、初回ON、連打を直列化`, async () => {
    const mock = mockNative(kind);
    background(mock);
    assert.equal(mock.native.action.onClicked.size, 1);
    assert.equal(mock.native.runtime.onInstalled.size, 1);
    for (let i = 0; i < 11; i++) mock.native.action.onClicked.emit();
    await settle();
    assert.deepEqual(mock.state.writes, [true, false, true, false, true, false, true, false, true, false, true, false]);
    assert.equal(mock.state.value, false);
    assert.equal(mock.state.badges.at(-1), "OFF");
    assert.equal(mock.state.titles.at(-1), "社会復帰note：OFF");
  });

  test(`${kind}：再生成・更新・起動で既存OFFを維持`, async () => {
    const mock = mockNative(kind, false);
    background(mock);
    await mock.native.runtime.onInstalled.emit();
    await mock.native.runtime.onStartup.emit();
    await settle();
    assert.deepEqual(mock.state.writes, []);
    assert.equal(mock.state.badges.at(-1), "OFF");
    // 新しい実行環境でも同じ永続ストレージを読む。
    background(mock);
    await settle();
    assert.deepEqual(mock.state.writes, []);
    assert.equal(mock.state.titles.at(-1), "社会復帰note：OFF");
  });

  test(`${kind}：保存失敗では表示を変えず、次の操作を受け付ける`, async () => {
    const mock = mockNative(kind, true);
    const { warnings } = background(mock);
    await settle();
    mock.state.failWrite = true;
    await mock.native.action.onClicked.emit();
    assert.equal(mock.state.value, true);
    assert.equal(mock.state.badges.at(-1), "ON");
    assert.equal(warnings.length, 1);
    mock.state.failWrite = false;
    await mock.native.action.onClicked.emit();
    assert.equal(mock.state.value, false);
    assert.equal(mock.state.badges.at(-1), "OFF");
  });

  test(`${kind}：読込失敗は書き込まず、表示失敗は保存を巻き戻さない`, async () => {
    const mock = mockNative(kind, false);
    mock.state.failRead = true;
    background(mock);
    await settle();
    assert.deepEqual(mock.state.writes, []);
    assert.deepEqual(mock.state.titles, []);
    mock.state.failRead = false;
    mock.state.failDisplay = true;
    await mock.native.action.onClicked.emit();
    assert.equal(mock.state.value, true);
    mock.state.failDisplay = false;
    await mock.native.runtime.onStartup.emit();
    assert.equal(mock.state.badges.at(-1), "ON");
  });
}
