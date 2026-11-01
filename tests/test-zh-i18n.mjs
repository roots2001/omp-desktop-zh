// Regression script for src/zh-i18n.js — the narrow runtime layer used by
// the dynamically built phone page. Static UI chrome may be translated only
// by an exact dictionary hit; user, agent, tool and MCP text must pass through.
// Run: node tests/test-zh-i18n.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const load = path => readFileSync(root + path, "utf8");

let passed = 0;
function check(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`FAILED: ${label}`);
    throw err;
  }
  passed++;
}

class TextNode {
  constructor(text) { this.nodeType = 3; this.nodeValue = text; this.parentElement = null; }
}
class Element {
  constructor(tag, text = "") {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.classList = { contains: () => false };
    this.style = {};
    const textNode = new TextNode(text);
    textNode.parentElement = this;
    if (text !== "") this.children.push(textNode);
  }
  get textContent() {
    return this.children.map(child => child.nodeValue ?? child.textContent).join("");
  }
  set textContent(value) {
    const textNode = new TextNode(String(value));
    textNode.parentElement = this;
    this.children = value === "" ? [] : [textNode];
  }
  append(...nodes) {
    for (const child of nodes) {
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  matches(selector) { return matches(this, selector); }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (matches(node, selector)) return node;
    }
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (!(child instanceof Element)) continue;
      if (matches(child, selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

function descendants(element) {
  const found = [];
  const visit = node => {
    for (const child of node.children) {
      if (!(child instanceof Element)) continue;
      found.push(child);
      visit(child);
    }
  };
  visit(element);
  return found;
}

function matches(node, selector) {
  return selector.split(",").map(part => part.trim()).some(part => {
    if (part === "*") return true;
    if (part.startsWith(".")) return node.classList.contains(part.slice(1)) || node.classList[part.slice(1)] === true;
    return node.tagName === part.toUpperCase();
  });
}

class TreeWalker {
  constructor(scope) { this.nodes = descendants(scope).flatMap(el => el.children.filter(n => n instanceof TextNode)); this.index = 0; }
  nextNode() { return this.nodes[this.index++] ?? null; }
}

const source = load("src/zh-i18n.js");
function loadI18n() {
  const document = { createTreeWalker: root => new TreeWalker(root) };
  const window = { document };
  vm.runInNewContext(source, { window });
  return window.OMP_I18N;
}

check("only an exact dictionary entry is translated; surroundings are preserved", () => {
  const i18n = loadI18n();
  assert.equal(i18n.translate("  OMP Remote\n"), "  OMP 远程控制\n");
  assert.equal(i18n.translate("Sessions"), "会话");
  assert.equal(i18n.translate("Switch session"), "切换会话");
  for (const text of ["Switch", "Sessions list", "OMP Remote!", "", "<Question>"])
    assert.equal(i18n.translate(text), text);
});

check("protocol constants and arbitrary data are not dictionary keys", () => {
  const i18n = loadI18n();
  for (const text of [
    "Allow tool: bash", "Approve", "Deny", "Confirm", "Retry cancelled",
    "Provider request failed", "Session renamed to X", "Copy code",
    "mcp__ida_pro_decompile", "read", "bash", "/rename Fix login",
  ]) assert.equal(i18n.translate(text), text, text);
});

check("DOM translation changes static text and accessibility labels", () => {
  const i18n = loadI18n();
  const scope = new Element("main");
  const title = new Element("h1", "OMP Remote");
  const label = new Element("button", "Sessions");
  label.setAttribute("title", "Switch tab");
  scope.append(title, label);
  i18n.translateDom(scope);
  assert.equal(title.textContent, "OMP 远程控制");
  assert.equal(label.textContent, "会话");
  assert.equal(label.getAttribute("title"), "切换标签页");
});

check("DOM translation never rewrites conversation, tool or form-content text", () => {
  const i18n = loadI18n();
  const scope = new Element("main");
  const protectedClasses = [
    "chat-markdown", "md-content", "transcript", "ass-text selectable", "user-text selectable",
    "ask-question", "ask-confirm-message selectable", "ask-row-text", "ask-row-desc",
    "tool-title", "tool-bash mono selectable",
  ];
  for (const className of protectedClasses) {
    const element = new Element("div", "OMP Remote");
    for (const name of className.split(/\s+/)) element.classList[name] = true;
    element.classList.contains = name => Object.hasOwn(element.classList, name);
    scope.append(element);
  }
  const editable = new Element("textarea", "OMP Remote");
  const pre = new Element("pre", "OMP Remote");
  const code = new Element("code", "OMP Remote");
  scope.append(editable, pre, code);
  i18n.translateDom(scope);
  for (const element of descendants(scope)) assert.equal(element.textContent, "OMP Remote", element.tagName);
});
console.log(`zh-i18n: ${passed} checks passed`);





