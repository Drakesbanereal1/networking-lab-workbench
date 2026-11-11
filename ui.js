"use strict";
/* Shared helpers: the engine bridge, DOM building, the browser practice record and navigation between items. */

/* ---------- Engine: the same Rust code as the desktop app, compiled to WebAssembly ---------- */
let wasm;

async function loadEngine() {
  const text = atob(window.ENGINE_WASM);
  const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasm = instance.exports;
}

function engine(args) {
  const input = new TextEncoder().encode(JSON.stringify(args));
  const pointer = wasm.engine_alloc(input.length);
  new Uint8Array(wasm.memory.buffer, pointer, input.length).set(input);
  const start = wasm.engine_call(pointer, input.length);
  const length = wasm.engine_result_len();
  const reply = JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, start, length)));
  if (reply.ok === "false") throw new Error(reply.data.error);
  return reply.data;
}

const contentCache = new Map();
function content(name) {
  if (!contentCache.has(name)) contentCache.set(name, engine(["content-file", name]).content);
  return contentCache.get(name);
}

/* ---------- DOM helpers. Text only ever reaches the page as text nodes. ---------- */
function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key in node && key !== "list") node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

/* Appends children, flattening nested lists and dropping empty entries. */
function put(node, ...children) {
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/* Replaces a node's children. Nested lists are flattened and empty entries dropped, so they never show as text. */
function fill(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

const commas = (digits) => String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
let fieldId = 0;

function field(labelText, value, placeholder, options = {}) {
  const id = `f${++fieldId}`;
  const input = options.area
    ? h("textarea", { id, value: value || "", placeholder: placeholder || "", spellcheck: false })
    : h("input", { id, type: "text", value: value || "", placeholder: placeholder || "", spellcheck: false, autocomplete: "off" });
  input.setAttribute("autocapitalize", "off");
  return { input, wrap: h("div", { class: options.wide ? "wide" : "" }, h("label", { htmlFor: id }, labelText), input) };
}

function selectField(labelText, items) {
  const id = `f${++fieldId}`;
  const select = h("select", { id }, h("option", { value: "" }, "Choose one"), items.map((x) => h("option", { value: x.id }, x.text)));
  return { select, wrap: h("div", { class: "wide" }, h("label", { htmlFor: id }, labelText), select) };
}

const button = (text, onclick, extra = "") => h("button", { class: `btn ${extra}`, type: "button", onclick }, text);
const kv = (rows) => h("dl", { class: "kv" }, rows.filter(Boolean).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
const lines = (area) => area.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const heading = (text, level = "h2") => h(level, { class: "title" }, text);
const pre = (text, cls = "sample") => h("pre", { class: cls }, text);
const errorBox = (e) => h("p", { class: "error", role: "alert" }, e.message || String(e));

function subnav(entries, start) {
  const bar = h("div", { class: "subnav" });
  const body = h("div", {});
  const views = new Map();
  const select = (label) => {
    for (const b of bar.children) b.setAttribute("aria-current", b.textContent === label ? "page" : "false");
    if (!views.has(label)) {
      try { views.set(label, entries[label]()); } catch (e) { views.set(label, errorBox(e)); }
    }
    body.replaceChildren(views.get(label));
  };
  for (const label of Object.keys(entries)) {
    bar.append(h("button", { class: "sub", type: "button", onclick: () => select(label) }, label));
  }
  select(start || Object.keys(entries)[0]);
  const node = h("div", {}, bar, body);
  node.select = select;
  node.view = (label) => { select(label); return views.get(label); };
  return node;
}

/* A list on the left and a panel on the right. */
function splitList(items, label, open) {
  const list = h("div", { class: "list", role: "list" });
  const panel = h("div", { class: "panel", "aria-live": "polite" });
  const buttons = new Map();
  const choose = (item) => {
    for (const [it, b] of buttons) b.setAttribute("aria-current", it === item ? "true" : "false");
    try { panel.replaceChildren(...[open(item)].flat(Infinity).filter(Boolean)); } catch (e) { panel.replaceChildren(errorBox(e)); }
    if (window.matchMedia("(max-width: 720px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  for (const item of items) {
    const b = h("button", { type: "button", onclick: () => choose(item) }, label(item));
    buttons.set(item, b);
    list.append(b);
  }
  const node = h("div", { class: "split" }, list, panel);
  node.choose = choose;
  node.chooseBy = (test) => { const item = items.find(test); if (item) choose(item); return Boolean(item); };
  if (items.length) choose(items[0]);
  return node;
}

/* ---------- The practice record in this browser ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(`workbench.${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`workbench.${key}`, JSON.stringify(value)); return true; } catch { return false; }
  },
};

const record = {
  all: () => store.get("attempts", []),
  add(entry) {
    const v = WorkbenchProgress.validate(Object.assign({ entry: "web" }, entry), APP.version);
    const list = record.all();
    list.push(v);
    if (!store.set("attempts", list)) throw new Error("This browser would not save the record (storage is full or blocked).");
    document.dispatchEvent(new Event("workbench-record"));
    return v;
  },
  replace(list) { store.set("attempts", list); document.dispatchEvent(new Event("workbench-record")); },
};

/* Records an attempt. A failure to record never interrupts practice. */
function saveAttempt(entry) {
  try { record.add(entry); return true; } catch { return false; }
}

/* ---------- Opening an item from anywhere ---------- */
const APP = { version: "", open: {} };
function openItem(kind, id) {
  const fn = APP.open[kind];
  if (fn) fn(id);
}
