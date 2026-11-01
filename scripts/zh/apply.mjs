/* scripts/zh/apply.mjs — 按 AST 命中的偏移把中文译文写回源码。

   用法：
     node scripts/zh/apply.mjs            # 写入
     node scripts/zh/apply.mjs --dry      # 只统计，不写

   与 extract 共用 ast.mjs 的扫描逻辑，所以"提取到的"就是"能替换的"，
   不会出现字典里有、源码里找不到对应位置的情况。
*/

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT, sourceFiles, scanFile, relPath } from "./ast.mjs";

const DICT = JSON.parse(readFileSync(join(ROOT, "localization", "zh.json"), "utf8"));

/* 这些字符串是 omp 后端 / 手机端协议的一部分，或与 Rust 端常量逐字对账，
   翻了就断功能。按"文件 + 原文"精确豁免，不影响同一句在别处显示。 */
const NEVER = new Map([
  ["src/app/approval.js", ["Allow tool: ", "Approve", "Deny"]],
  ["src/app/turn-status.js", ["Retry cancelled", "provider request failed"]],
  ["src/app/session-title.js", [
    "Session renamed to ",
    "Could not generate a session title",
    "Session name not changed",
    "Rename failed",
  ]],
  ["src/app/marked-setup.js", ["Copy code"]],
  ["src/app/subagents.js", ["tool failed"]],
  ["src/remote/client.js", ["Confirm", "Deny"]],
]);

const dry = process.argv.includes("--dry");

let filesTouched = 0;
let replaced = 0;
const used = new Set();
const missingInSource = new Set(Object.keys(DICT));

for (const file of sourceFiles()) {
  const rel = relPath(file);
  const { src, hits, error } = scanFile(file);
  if (error) {
    console.error(`! 解析失败 ${rel}: ${error}`);
    continue;
  }
  const never = new Set(NEVER.get(rel) ?? []);
  // JSX 文本节点里的 `<` `>` `{` `}` 是语法字符，必须写成实体；
  // 原文里本来就可能是 `&lt;` 这类实体，替换后仍用实体，渲染结果一致。
  const escJsx = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
     .replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
  const edits = [];
  for (const h of hits) {
    if (h.logic) continue;
    if (never.has(h.value)) continue;
    const zh = DICT[h.value];
    if (zh == null || zh === h.value) continue;
    edits.push({ ...h, zh: h.ctx === "jsx-text" ? escJsx(zh) : zh });
    used.add(h.value);
  }
  if (!edits.length) continue;

  // 偏移倒序拼接：前面的替换不会让后面的偏移失效。
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  let cursor = Infinity;
  for (const e of edits) {
    if (e.end > cursor) throw new Error(`${rel}:${e.line} 命中区间重叠，拒绝写入`);
    out = out.slice(0, e.start) + e.zh + out.slice(e.end);
    cursor = e.start;
  }
  if (!dry) writeFileSync(file, out);
  filesTouched++;
  replaced += edits.length;
}

for (const k of used) missingInSource.delete(k);

console.log(`文件 ${filesTouched} 个 | 替换 ${replaced} 处 | 字典 ${Object.keys(DICT).length} 条${dry ? "（dry run）" : ""}`);
if (missingInSource.size) {
  console.log(`字典里有 ${missingInSource.size} 条在源码中未命中：`);
  for (const k of [...missingInSource].sort()) console.log(`  ${JSON.stringify(k)}`);
}
