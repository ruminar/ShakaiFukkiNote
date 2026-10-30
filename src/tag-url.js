(() => {
  "use strict";
  const app = globalThis.ShakaiFukkiNote ??= {};

  function searchURL(value) {
    if (typeof value !== "string") return null;
    const tag = value.trim().replace(/^[#＃]+/u, "").trim();
    if (!tag) return null;
    const url = new URL("https://note.com/search");
    url.search = new URLSearchParams({ q: `#${tag}`, context: "note", mode: "search", sort: "new" }).toString();
    return url.href;
  }

  function rewriteURL(href, base = "https://note.com/") {
    if (typeof href !== "string" || !href.trim()) return null;
    try {
      const url = new URL(href, base);
      if (url.origin !== "https://note.com" || url.username || url.password) return null;
      const match = /^\/(?:tag|hashtag)\/([^/]+)\/?$/u.exec(url.pathname);
      if (!match) return null;
      return searchURL(decodeURIComponent(match[1]));
    } catch {
      return null;
    }
  }

  app.tagURL = Object.freeze({ searchURL, rewriteURL });
})();
