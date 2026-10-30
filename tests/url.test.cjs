const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { source } = require("./helpers.cjs");
const context = vm.createContext({ URL, URLSearchParams });
vm.runInContext(source("tag-url.js"), context);
const { rewriteURL, searchURL } = context.ShakaiFukkiNote.tagURL;

for (const [href, tag] of [
  ["/tag/AI", "AI"], ["/hashtag/AI/", "AI"],
  ["https://note.com/tag/ComfyUI?f=popular#top", "ComfyUI"],
  ["/tag/日本語", "日本語"], ["/tag/%E6%8E%A8%E3%81%97%E6%B4%BB", "推し活"],
  ["/tag/C%2B%2B", "C++"], ["/tag/%23%EF%BC%83AI", "AI"],
  ["/tag/100%25", "100%"], ["/tag/a%2Fb", "a/b"]
]) test(`タグURL変換：${href}`, () => {
  const result = new URL(rewriteURL(href));
  assert.equal(result.origin + result.pathname, "https://note.com/search");
  assert.equal(result.searchParams.get("q"), `#${tag}`);
  assert.equal(result.searchParams.get("sort"), "new");
  assert.equal(result.searchParams.get("context"), "note");
  assert.equal(result.searchParams.get("mode"), "search");
  assert.equal(result.searchParams.has("f"), false);
  assert.equal(result.hash, "");
});

test("タグURL以外・壊れたURL・不正オリジンを除外", () => {
  for (const href of [null, "", "/tag/", "/hashtag", "/tag/a/b", "/creator/n/article", "/search?q=AI", "/contest/AI", "https://example.com/tag/AI", "https://note.com.evil.example/tag/AI", "http://note.com/tag/AI", "https://note.com:444/tag/AI", "https://user:secret@note.com/tag/AI", "javascript:alert(1)", "/tag/%ZZ", "/tag/%E3", "/tag/%23", "#tag/AI"]) {
    assert.equal(rewriteURL(href), null, String(href));
  }
});

test("相対URLは文書のbaseを尊重し、外部baseなら処理しない", () => {
  assert.equal(rewriteURL("tag/AI", "https://example.com/"), null);
  assert.equal(rewriteURL("../tag/AI", "https://note.com/user/"), searchURL("AI"));
});

test("入力の#を正規化し、空の検索をしない", () => {
  for (const value of ["AI", "#AI", "＃AI", " ##＃AI  "]) assert.equal(searchURL(value), searchURL("AI"));
  for (const value of ["", " ", "#", "＃＃", null]) assert.equal(searchURL(value), null);
  assert.equal(new URL(searchURL("%23AI")).searchParams.get("q"), "#%23AI");
});
