#!/usr/bin/env node
// Release-facing Chinese strings live outside the React source: the desktop
// HTML title and native packaging defaults. Keep the brand name, but do not
// silently regress the translated shell surfaces to English.
// Run: node tests/test-zh-packaging.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = path => readFileSync(join(root, path), "utf8");

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

check("release links and Cargo metadata point at the Chinese fork", () => {
  const own = "https://github.com/roots2001/omp-desktop-zh";
  assert.match(load("src/app/updater.js"), new RegExp(`RELEASES_URL: "${own}/releases"`));
  assert.match(load("src-tauri/Cargo.toml"), new RegExp(`repository = "${own}"`));
  assert.ok(load("README.md").includes(own + "/releases"));
  assert.doesNotMatch(load("src/app/updater.js"), /github\.com\/apoc\/omp-desktop\/releases/);
  assert.doesNotMatch(load("src-tauri/Cargo.toml"), /github\.com\/apoc\/omp-desktop/);
});

check("desktop document and native window use the Chinese product title", () => {
  assert.match(load("src/index.html"), /<title>OMP Desktop 中文版<\/title>/);
  const config = JSON.parse(load("src-tauri/tauri.conf.json"));
  assert.equal(config.app.windows[0].title, "OMP Desktop 中文版");
  assert.deepEqual(config.bundle.windows.nsis.languages, ["SimpChinese"]);
  assert.equal(config.bundle.windows.wix.language, "zh-CN");
});

check("both Windows installer formats register a Chinese folder verb", () => {
  const nsis = load("src-tauri/packaging/windows-folder-verb.nsh");
  assert.equal(nsis.match(/"用 \$\{PRODUCTNAME\} 打开"/g)?.length, 2);
  assert.doesNotMatch(nsis, /"Open with \$\{PRODUCTNAME\}"/);

  const wix = load("src-tauri/packaging/windows-folder-verb.wxs");
  assert.equal(wix.match(/Value="用 OMP Desktop 打开"/g)?.length, 2);
  assert.doesNotMatch(wix, /Value="Open with OMP Desktop"/);
});

check("native file pickers use Chinese titles and filters", () => {
  const rust = load("src-tauri/src/lib.rs");
  for (const text of ['"打开项目文件夹"', '"选择 Shell"', '"选择浏览器"', '.add_filter("程序", &["exe"])'])
    assert.ok(rust.includes(text), text);
  for (const text of ['"Open Project Folder"', '"Choose a Shell"', '"Choose a Browser"', '.add_filter("Programs"'])
    assert.ok(!rust.includes(text), text);
});

check("phone push notifications use Chinese user-facing copy", () => {
  const push = load("src-tauri/src/remote/push.rs");
  for (const text of ['"有提问等待回答"', '"已完成"', '"测试通知"']) assert.ok(push.includes(text), text);
  for (const text of ['"Question waiting"', '"Test notification"', 'Self::Finished => "Finished"'])
    assert.ok(!push.includes(text), text);
});

check("macOS privacy prompts explain network and microphone access in Chinese", () => {
  const plist = load("src-tauri/packaging/Info.plist");
  assert.match(plist, /<key>NSLocalNetworkUsageDescription<\/key>\s*<string>[^<]*本地网络[^<]*<\/string>/);
  assert.match(plist, /<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]*麦克风[^<]*<\/string>/);
  assert.doesNotMatch(plist, /OMP Desktop (?:and the agents|uses your microphone)/);
});

console.log(`zh-packaging: ${passed} checks passed`);
