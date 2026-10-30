const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { root } = require("./helpers.cjs");
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

test("Manifestは最小権限・共通コンテンツ・MV3を維持", () => {
  const common = json("manifests/common.json");
  assert.equal(common.version, json("package.json").version);
  assert.equal(common.manifest_version, 3);
  assert.deepEqual(common.permissions, ["storage"]);
  assert.deepEqual(common.content_scripts[0].matches, ["https://note.com/*"]);
  assert.deepEqual(common.content_scripts[0].js, ["src/api.js", "src/tag-url.js", "src/content.js"]);
  for (const key of ["host_permissions", "options_ui", "options_page"]) assert.equal(common[key], undefined);
  assert.equal(common.action.default_popup, undefined);
  for (const file of [...common.content_scripts[0].js, ...common.content_scripts[0].css, ...Object.values(common.icons)]) assert.equal(fs.existsSync(path.join(root, file)), true, file);
});

test("対象別backgroundとFirefoxの署名・Android・収集なし宣言", () => {
  const chromium = json("manifests/chromium.json");
  const firefox = json("manifests/firefox.json");
  assert.equal(chromium.background.service_worker, "src/background-chromium.js");
  assert.equal(chromium.background.scripts, undefined);
  assert.equal(firefox.background.service_worker, undefined);
  assert.equal(firefox.background.persistent, false);
  assert.deepEqual(firefox.background.scripts, ["src/api.js", "src/background.js"]);
  const settings = firefox.browser_specific_settings;
  assert.equal(settings.gecko.id, "shakaifukkinote@ruminar");
  assert.deepEqual(settings.gecko.data_collection_permissions.required, ["none"]);
  assert.equal(settings.gecko.strict_min_version, "140.0");
  assert.equal(settings.gecko_android.strict_min_version, "142.0");
});
