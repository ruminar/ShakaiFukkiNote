const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.resolve(__dirname, "..");
const source = name => fs.readFileSync(path.join(root, "src", name), "utf8");

function event() {
  const listeners = new Set();
  return {
    addListener: fn => listeners.add(fn),
    removeListener: fn => listeners.delete(fn),
    emit: (...args) => Promise.all([...listeners].map(fn => fn(...args))),
    get size() { return listeners.size; }
  };
}

function mockNative(kind = "browser", initial) {
  const state = { value: initial, writes: [], badges: [], titles: [], failRead: false, failWrite: false, failDisplay: false, readHook: null };
  const runtime = { onInstalled: event(), onStartup: event(), lastError: undefined };
  const changed = event();
  function method(operation) {
    if (kind === "browser") return (...args) => Promise.resolve().then(() => operation(...args));
    return (arg, callback) => {
      Promise.resolve().then(() => operation(arg)).then(result => callback(result), error => {
        runtime.lastError = { message: error.message };
        callback();
        runtime.lastError = undefined;
      });
    };
  }
  const native = {
    runtime,
    storage: {
      local: {
        get: method(async () => {
          if (state.failRead) throw new Error("読込失敗");
          if (state.readHook) return state.readHook();
          return { enabled: state.value };
        }),
        set: method(async ({ enabled }) => {
          if (state.failWrite) throw new Error("保存失敗");
          const oldValue = state.value;
          state.value = enabled;
          state.writes.push(enabled);
          await changed.emit({ enabled: { oldValue, newValue: enabled } }, "local");
        })
      },
      onChanged: changed
    },
    action: {
      onClicked: event(),
      setBadgeText: method(({ text }) => {
        if (state.failDisplay) throw new Error("表示失敗");
        state.badges.push(text);
      }),
      setTitle: method(({ title }) => {
        if (state.failDisplay) throw new Error("表示失敗");
        state.titles.push(title);
      })
    }
  };
  return { native, state, kind };
}

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
};

function background(mock) {
  const warnings = [];
  const context = vm.createContext({ [mock.kind]: mock.native, console: { warn: message => warnings.push(message) } });
  vm.runInContext(source("api.js"), context);
  vm.runInContext(source("background.js"), context);
  return { context, warnings };
}

function content(mock, html) {
  const console = new VirtualConsole();
  const errors = [];
  console.on("jsdomError", error => errors.push(error));
  const dom = new JSDOM(html ?? fs.readFileSync(path.join(__dirname, "fixtures/note.html"), "utf8"), {
    url: "https://note.com/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: console
  });
  dom.window[mock.kind] = mock.native;
  for (const name of ["api.js", "tag-url.js", "content.js"]) dom.window.eval(source(name));
  return { dom, window: dom.window, document: dom.window.document, errors };
}

async function mutation() {
  await settle();
  await new Promise(resolve => setTimeout(resolve, 15));
  await settle();
}

module.exports = { root, source, event, mockNative, background, content, settle, mutation };
