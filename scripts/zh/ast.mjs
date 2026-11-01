/* scripts/zh/ast.mjs — 共用的 AST 扫描器（extract / apply 都用它）。

   用仓库自带的 src/babel.min.js 解析源文件（和正式构建同一套语法支持），
   把"可能展示给用户的字符串"逐条报出来，附带：
     - value  字符串内容
     - ctx    语法位置（jsx-text / prop:label / arg:tweak[2] / opt-label …）
     - start/end  只覆盖内容本身的源码偏移（不含引号与缩进）
     - logic  非空表示这个字符串参与逻辑判断，不该译
   提取和替换共用同一套判定，所以两边永远不会错位。
*/

import { createRequire } from "module";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { fileURLToPath } from "url";

export const ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));
const require = createRequire(import.meta.url);
const Babel = require(join(ROOT, "src", "babel.min.js"));

// 第三方库、构建产物、原型 mock 数据：不扫、不译。
export const SKIP_FILES = new Set([
  "src/babel.min.js",
  "src/react.development.js",
  "src/react-dom.development.js",
  "src/react.production.js",
  "src/react-dom.production.js",
  "src/xterm.js",
  "src/xterm-addon-fit.js",
  "src/marked.min.js",
  "src/highlight.min.js",
  "src/jsQR.js",
  "src/remote/jsQR.js",
  "src/design/data.js", // 只在演示模式用；真机由 live.js 覆写 window.OMP_DATA
]);

// 这些属性名下的字符串才会出现在界面上。
export const DISPLAY_PROPS = new Set([
  "label", "title", "text", "hint", "description", "desc", "body", "message",
  "summary", "note", "placeholder", "group", "caption", "empty", "tooltip",
  "subtitle", "blurb", "aria-label", "aria-description", "labelText", "emptyText",
  "verb", "statusText", "detail", "head",
]);

// JSX 上会渲染成文字的属性。
const JSX_TEXT_PROPS = new Set(["title", "aria-label", "placeholder", "alt", "label"]);

// tweak(key, type, label, desc, kw) / custom(type, label, desc, kw) 的位置参数。
export const POSITIONAL = { tweak: [2, 3], custom: [1, 2], opts: [] };

/* 参与逻辑判断的字符串一律不译。判定只看直接父节点，
   这样"写在返回对象里的展示文案"不会被误判成逻辑常量：
     - 比较/逻辑运算的操作数          `x === "running"`
     - switch 的 case 值              `case "set":`
     - 字符串方法实参                 `s.startsWith("Allow tool: ")`
     - Set / 数组字面量的成员          `new Set(["running", "idle"])`
     - 一元运算 / 条件判断的操作数     `if (!"x")`
*/
const LOGIC_CALLEES = new Set([
  "startsWith", "endsWith", "includes", "indexOf", "lastIndexOf", "match", "test",
  "split", "replace", "replaceAll", "parse", "Number", "get", "has", "querySelector",
  "getElementById", "closest", "matches",
]);
const CMP = new Set(["==", "===", "!=", "!==", ">", "<", ">=", "<="]);

/* 从"字符串值"节点往上跳过纯粹的包装节点（对象属性的值、JSX 属性的值、
   函数调用的实参），再看它真正参与的是什么表达式。 */
const isWrapper = (childPath) => {
  const parent = childPath.parentPath?.node;
  if (!parent) return false;
  if (parent.type === "ObjectProperty" && childPath.node === parent.value) return true;
  if (parent.type === "JSXAttribute" && childPath.node === parent.value) return true;
  if (parent.type === "CallExpression" && parent.arguments.includes(childPath.node)) {
    // 逻辑方法的实参不是包装：`s.startsWith("Allow tool: ")` 里的字符串要拦下。
    const c = parent.callee;
    const nm = c.type === "Identifier" ? c.name
      : c.type === "MemberExpression" && c.property.type === "Identifier" ? c.property.name : null;
    return !(nm && LOGIC_CALLEES.has(nm));
  }
  if (parent.type === "ArrayExpression") return false;
  return false;
};

const logicOf = (valuePath) => {
  let p = valuePath;
  while (p.parentPath && isWrapper(p)) p = p.parentPath;
  const parent = p.parentPath?.node;
  if (!parent) return null;
  if (parent.type === "BinaryExpression" && CMP.has(parent.operator)) return "logic:compare";
  if (parent.type === "LogicalExpression") return "logic:logical";
  if (parent.type === "UnaryExpression") return "logic:unary";
  if (parent.type === "SwitchCase" && p.node === parent.test) return "logic:switch-case";
  // 只把"常量数组"（const X = ["a","b"]，典型是 Set 的输入）当作逻辑值；
  // settings-schema 那种数组里套 tweak(...) 的是配置声明，不是逻辑。
  if (parent.type === "ArrayExpression" && p.parentPath.parentPath?.node?.type === "VariableDeclarator") {
    return "logic:const-array";
  }
  if (parent.type === "CallExpression") {
    const c = parent.callee;
    const nm = c.type === "Identifier" ? c.name
      : c.type === "MemberExpression" && c.property.type === "Identifier" ? c.property.name : null;
    if (nm && LOGIC_CALLEES.has(nm)) return `logic:${nm}()`;
  }
  return null;
};

export const walkSrc = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkSrc(p, out);
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
};

export const relPath = (p) => relative(ROOT, p).split(sep).join("/");

export const strValue = (node) => {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
};

const fnName = (call) => {
  const c = call?.callee;
  if (!c) return null;
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression" && c.property.type === "Identifier") return c.property.name;
  return null;
};

/* 扫一个文件，返回 { src, hits, error }。
   start/end 精确指向字符串内容本身，apply 可以原地切片替换。 */
export function scanFile(file) {
  const src = readFileSync(file, "utf8");
  const hits = [];
  const emit = (value, ctx, node, innerStart, innerEnd, logic) => {
    if (value == null) return;
    hits.push({ value, ctx, start: innerStart, end: innerEnd, line: node.loc?.start.line ?? 0, logic });
  };

  const plugin = () => ({
    visitor: {
      JSXText(path) {
        // JSX 渲染时会把跨行缩进折叠成一个空格，所以字典里存"渲染出来的样子"；
        // 替换时只换掉首尾空白之间的部分，缩进和换行保持原样。
        // 注意：node.value 是解码过实体的文本（`&lt;` → `<`），长度和源码不一致，
        // 偏移必须从源码切片算，不能从 value 算。
        const rawSrc = src.slice(path.node.start, path.node.end);
        const lead = rawSrc.length - rawSrc.trimStart().length;
        const tail = rawSrc.length - rawSrc.trimEnd().length;
        const t = path.node.value.replace(/\s+/g, " ").trim();
        if (!t) return;
        emit(t, "jsx-text", path.node, path.node.start + lead, path.node.end - tail, null);
      },
      JSXAttribute(path) {
        const name = path.node.name?.name;
        if (!JSX_TEXT_PROPS.has(name)) return;
        const v = path.node.value;
        if (v?.type !== "StringLiteral") return;
        emit(v.value, `jsx-attr:${name}`, v, v.start + 1, v.end - 1, logicOf(path.get("value")));
      },
      ObjectProperty(path) {
        const key = path.node.key;
        const name = key.type === "Identifier" ? key.name : key.value;
        const v = path.node.value;
        if (v?.type !== "StringLiteral") return;
        const obj = path.parentPath?.node;
        const call = path.parentPath?.parentPath?.node;
        if (obj?.type === "ObjectExpression" && call?.type === "CallExpression" && fnName(call) === "opts") {
          emit(v.value, "opt-label", v, v.start + 1, v.end - 1, logicOf(path.get("value")));
          return;
        }
        // `name` 只有出现在"设置分组"（带 rows）或"项目条目"（带 path）里才是显示名，
        // 其余地方是图标名 / 命令 id，不能动。
        if (name === "name") {
          const keys = (obj?.properties ?? []).map((k) => k.key?.name ?? k.key?.value);
          if (!keys.includes("rows") && !keys.includes("path")) return;
        }
        if (!DISPLAY_PROPS.has(name) && name !== "name") return;
        emit(v.value, `prop:${name}`, v, v.start + 1, v.end - 1, logicOf(path.get("value")));
      },
      CallExpression(path) {
        const name = fnName(path.node);
        if (!name || !Object.hasOwn(POSITIONAL, name)) return;
        for (const i of POSITIONAL[name]) {
          const arg = path.node.arguments[i];
          if (arg?.type !== "StringLiteral") continue;
          emit(arg.value, `arg:${name}[${i}]`, arg, arg.start + 1, arg.end - 1, logicOf(path.get(`arguments.${i}`)));
        }
      },
    },
  });

  try {
    Babel.transform(src, {
      presets: ["react"],
      plugins: [plugin],
      filename: file,
      babelrc: false,
      configFile: false,
      sourceType: "script",
    });
  } catch (err) {
    return { src, hits: [], error: String(err.message).split("\n")[0] };
  }
  // Babel 会为每个文件跑多趟遍历，同一个节点可能被报多次；按偏移去重。
  const seen = new Set();
  const uniq = hits.filter((h) => {
    const k = `${h.start}:${h.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { src, hits: uniq, error: null };
}

export const sourceFiles = () =>
  walkSrc(join(ROOT, "src")).filter((f) => !SKIP_FILES.has(relPath(f)));
