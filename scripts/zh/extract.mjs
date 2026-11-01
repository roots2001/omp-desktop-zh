/* scripts/zh/extract.mjs — 列出源码里所有可能展示给用户的字符串。

   用法：
     node scripts/zh/extract.mjs            每行一条 JSON
     node scripts/zh/extract.mjs --json     单个 JSON 数组
     node scripts/zh/extract.mjs --stats    只打印统计
     node scripts/zh/extract.mjs --values   只打印去重后的字符串（每行一条）
*/

import { scanFile, sourceFiles, relPath } from "./ast.mjs";

const files = sourceFiles();
const rows = [];
const errors = [];

for (const file of files) {
  const { hits, error } = scanFile(file);
  if (error) errors.push(`${relPath(file)}: ${error}`);
  for (const h of hits) rows.push({ file: relPath(file), ...h });
}

const translatable = rows.filter((r) => !r.logic);
const values = [...new Set(translatable.map((r) => r.value))];

const mode = process.argv[2];
if (mode === "--stats") {
  const byCtx = {};
  for (const r of translatable) byCtx[r.ctx] = (byCtx[r.ctx] ?? 0) + 1;
  console.log(`文件 ${files.length} | 候选 ${rows.length} 处 | 可译 ${translatable.length} 处 | 去重 ${values.length} 条 | 解析失败 ${errors.length}`);
  for (const [k, v] of Object.entries(byCtx).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  const logic = rows.filter((r) => r.logic);
  if (logic.length) {
    console.log(`\n跳过（参与逻辑判断）${logic.length} 处：`);
    for (const r of logic.slice(0, 40)) console.log(`  ${r.file}:${r.line} ${JSON.stringify(r.value)} ${r.logic}`);
    if (logic.length > 40) console.log(`  … 还有 ${logic.length - 40} 处`);
  }
  if (errors.length) console.log(`\n解析失败：\n  ${errors.join("\n  ")}`);
} else if (mode === "--values") {
  console.log(values.join("\n"));
} else if (mode === "--json") {
  console.log(JSON.stringify(rows, null, 1));
} else {
  for (const r of rows) console.log(JSON.stringify(r));
}
