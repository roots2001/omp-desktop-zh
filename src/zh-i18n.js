/* ═════════════════════════════════════════════════════════════════════
   zh-i18n.js — OMP Desktop Simplified Chinese layer.

   The desktop copy is translated in place. This file serves two jobs:
     - the phone remote page is built at runtime, so it translates its
       static UI text on the way out; and
     - after an upstream sync, new English strings come back in the
       source. They remain visible until the normal translation pass
       updates them: no user data, command names, tool output or MCP
       descriptions are guessed at runtime.

   Trusted release copy only. The input is never parsed as HTML and the
   environment never contains secrets: this is UI chrome, not a security
   boundary. English is the fallback, as upstream intends.
   ═════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  const dictionary = Object.freeze({
    "A question is waiting": "有提问在等待",
    "A turn finished": "一个回合已结束",
    "Agent": "智能体",
    "Agents spawned by": "由以下调用派生",
    "Apply": "应用",
    "Back": "返回",
    "Cancel": "取消",
    "Check for updates": "检查更新",
    "Close": "关闭",
    "Connect": "连接",
    "Connected": "已连接",
    "Copy": "复制",
    "Disable notifications": "关闭通知",
    "Dismiss": "忽略",
    "Enable notifications": "开启通知",
    "Error": "错误",
    "Loading…": "加载中…",
    "Messages": "消息",
    "Next": "下一个",
    "No saved sessions": "没有已保存的会话",
    "OMP Remote": "OMP 远程控制",
    "OMP Remote connects to a desktop tab over your local network. Load a session in that tab first.": "OMP 远程控制会通过本地网络连接桌面标签页。请先在桌面打开一个会话。",
    "Open": "打开",
    "Pair": "配对",
    "Previous": "上一个",
    "Read and control your OMP Desktop sessions from your phone.": "在手机上查看并控制 OMP Desktop 会话。",
    "Refresh": "刷新",
    "Reject": "拒绝",
    "Retry": "重试",
    "Save": "保存",
    "Scan a pairing code": "扫描配对码",
    "Send": "发送",
    "Sessions": "会话",
    "Settings": "设置",
    "Stop": "停止",
    "Submit": "提交",
    "Switch session": "切换会话",
    "Switch tab": "切换标签页",
    "This connection is not secure. Use HTTPS.": "此连接不安全，请使用 HTTPS。",
    "Waiting for you": "等待你的回应"
  });

  function translate(text) {
    if (typeof text !== "string") return text;
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    if (!match) return text;
    const translated = dictionary[match[2]];
    return translated === undefined ? text : match[1] + translated + match[3];
  }

  /** Translate static UI text without rewriting user/agent content. */
  function translateDom(scope, skipSelector) {
    const doc = scope && scope.ownerDocument || root.document;
    if (!doc) return;
    const skip = skipSelector || ".chat-markdown, .md-content, .transcript, .ass-text, .user-text, .ask-question, .ask-confirm-message, .ask-row-text, .ask-row-desc, .tool-title, .tool-bash, pre, code, textarea, input, script, style";
    const textNodes = [];
    const walker = doc.createTreeWalker(scope, 4);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement && !n.parentElement.closest(skip)) textNodes.push(n);
    }
    for (const n of textNodes) {
      const next = translate(n.nodeValue);
      if (next !== n.nodeValue) n.nodeValue = next;
    }
    const elements = scope.matches?.(`*`) ? [scope, ...scope.querySelectorAll("*")] : [...scope.querySelectorAll("*")];
    for (const el of elements) {
      if (el.closest(skip)) continue;
      for (const attr of ["aria-label", "placeholder", "title"]) {
        if (!el.hasAttribute(attr)) continue;
        const old = el.getAttribute(attr);
        const next = translate(old);
        if (next !== old) el.setAttribute(attr, next);
      }
    }
  }

  root.OMP_I18N = Object.freeze({ dictionary, translate, translateDom });
})(window);




