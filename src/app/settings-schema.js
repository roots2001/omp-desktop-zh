// Settings page (#37): sections, groups and rows, plus the pure helpers the
// page, its tab chip and the tests share.
//
// Exposes `window.OMP_SETTINGS`; wrapped as an IIFE per the project rule for
// plain <script> tags (see AGENTS.md "IIFE rule").
//
// Two row kinds:
//   - `tweak`: one key of TWEAK_DEFAULTS (app/constants.js), rendered by the
//     page itself; `type` is toggle | seg | slider | themes | swatches | screens.
//   - `custom`: rendered by `window.OMP_SETTINGS_ROWS[type]`
//     (design/settings/rows-*.jsx). `keys` / `keyPrefix` name the tweak keys
//     the row owns, so its changes count in the badges and the section
//     reset; Rust-backed rows (shell, chromium, profiles, approvals,
//     keybindings) own none and never count.
// `desc` is schema-authored text; `backtick` segments render as code.
// Bounds of collapseAfter / promptHistoryLimit / pasteCollapseLines and the
// fold modes come from OMP_COLLAPSE / OMP_PROMPT_HISTORY / OMP_SESSION_UI,
// the start screens from OMP_BACKDROPS, read late (getters), as are
// OMP_ACCENT (accent comparison), OMP_KEYMAP (shortcut keywords) and
// TWEAK_DEFAULTS, so load order among the plain app/*.js modules does not
// matter.
(function () {
  const THEMES = Object.freeze([
    { id: "aurora", tone: "dark", accent: "#8AF0C8" },
    { id: "phosphor", tone: "dark", accent: "#C4FF3F" },
    { id: "daylight", tone: "light", accent: "#1F8A5B" },
  ]);
  const ACCENTS = Object.freeze(["#8AF0C8", "#6EE7FF", "#FF7AC6", "#FFC56E", "#B59BFF", "#C4FF3F"]);
  /** The accent a theme ships with; picking the theme resets to it. */
  const themeAccent = (theme) => (THEMES.find(t => t.id === theme) ?? THEMES[0]).accent;

  const defaults = () => window.TWEAK_DEFAULTS ?? {};
  const collapse = () => window.OMP_COLLAPSE;
  const history = () => window.OMP_PROMPT_HISTORY;
  const sessionUi = () => window.OMP_SESSION_UI;
  const opts = (values, labels = {}) => values.map(v => ({ value: v, label: labels[v] ?? String(v) }));
  const foldOptions = () => opts(collapse()?.MODES ?? ["auto", "open", "folded"]);
  const screenOptions = () => (window.OMP_BACKDROPS?.SCREENS ?? [{ id: "matrix", label: "矩阵雨", blurb: "" }])
    .map(s => ({ value: s.id, label: s.label, blurb: s.blurb }));

  // Descriptors, not spread: spread would read the bound getters once, now.
  const withExtra = (base, extra) => Object.defineProperties(base, Object.getOwnPropertyDescriptors(extra ?? {}));
  const tweak = (key, type, label, desc, kw, extra) => withExtra({ kind: "tweak", id: key, key, type, label, desc, kw }, extra);
  const custom = (type, label, desc, kw, extra) => withExtra({ kind: "custom", id: `custom:${type}`, type, label, desc, kw }, extra);

  const SECTIONS = [
    { id: "appearance", icon: "sparkle", title: "外观", blurb: "整个窗口的配色主题、强调色、启动画面、密度和字号。", groups: [
      { name: "主题", rows: [
        tweak("theme", "themes", "主题", "切换主题会同时把强调色重置为该主题自带的颜色。", "dark light colour color aurora phosphor daylight theme"),
        tweak("accent", "swatches", "强调色", "焦点框、当前标签页、链接和助手标记的颜色。", "color colour highlight accent"),
        tweak("startScreen", "screens", "启动画面", "没有打开标签页时，标志背后的动画画面。跟随主题和强调色。", "welcome backdrop empty animation matrix latent embedding next token sampling agent loop orbit forward pass neural attention transformer self-attention start screen",
          { get options() { return screenOptions(); } }),
      ] },
      { name: "文本", rows: [
        tweak("density", "seg", "密度", "行高、内边距和基础字号。", "spacing compact density",
          { options: opts(["cozy", "compact", "dense"]) }),
        tweak("fontSize", "slider", "字号", "缩放所有文字和图标，终端字体也在内。", "zoom scale text font size",
          { min: 75, max: 150, step: 5, unit: "%" }),
        tweak("monoChat", "toggle", "等宽字体对话", "消息使用等宽字体，而不是界面字体。", "font monospace chat"),
      ] },
    ] },
    { id: "layout", icon: "grid", title: "布局", blurb: "对话旁边放什么，以及每一列有多宽。", groups: [
      { name: "分栏", rows: [
        tweak("layout", "seg", "侧栏", "`rail` 显示小部件侧栏，`split` 在对话旁展开子智能体，`focus` 只显示对话。", "layout rail split focus side column",
          { options: opts(["rail", "split", "focus"]) }),
        tweak("defaultSide", "seg", "新标签页默认显示", "新打开的标签页侧栏初始显示什么。工具栏仍可按标签页切换。", "conversation tree default browser new tabs show",
          { options: opts(["rail", "tree", "browser"]) }),
        tweak("sidebar", "toggle", "项目侧边栏", "左侧的项目及其标签页列表。`Ctrl+B` 可切换显示。", "projects project sidebar"),
        custom("widths", "列宽", "拖动列边缘调整宽度，双击边缘恢复该列默认宽度。", "width resize pane sidebar rail tree split browser",
          { keys: ["sidebarWidth", "railWidth", "treeWidth", "splitWidth", "browserWidth"] }),
      ] },
    ] },
    { id: "chat", icon: "thinking", title: "对话", blurb: "工具调用和思考过程在记录里的呈现方式。", groups: [
      { name: "折叠", rows: [
        tweak("foldThinking", "seg", "思考", "`auto` 在有更新的回合后折叠，`open` 和 `folded` 则固定状态。", "collapse reasoning thinking",
          { fold: "thinking", get options() { return foldOptions(); } }),
        tweak("foldTools", "seg", "工具输出", "工具卡片采用同样的设置。你手动展开或折叠过的卡片会保持该状态。", "collapse cards tool output",
          { fold: "tool", get options() { return foldOptions(); } }),
        tweak("collapseAfter", "slider", "折叠时机", "使用 `auto` 时，出现多少个更新的回合后折叠该条目。", "auto fold collapse after", {
          step: 1, unit: " newer",
          // Only matters while a fold mode is auto.
          visibleIf: (values) => {
            const m = collapse()?.foldModes(values) ?? { thinking: values?.foldThinking ?? "auto", tool: values?.foldTools ?? "auto" };
            return m.thinking === "auto" || m.tool === "auto";
          },
          get min() { return collapse()?.MIN_AFTER ?? 1; },
          get max() { return collapse()?.MAX_AFTER ?? 30; },
        }),
      ] },
      { name: "滚动", rows: [
        tweak("followOutput", "toggle", "跟随新输出", "智能体工作时让记录始终停在最新消息。向上滚动会暂停跟随。", "auto scroll bottom pin follow new output"),
      ] },
    ] },
    { id: "composer", icon: "edit", title: "输入框", blurb: "发送、语音输入、粘贴和历史提示词调取。", groups: [
      { name: "发送", rows: [
        tweak("submitKey", "seg", "发送键", "在输入框、提问的作答框和子智能体的指令框里生效；另一个组合键则插入换行。单行输入框始终用 Enter 发送。", "submit newline shift enter send with",
          { options: opts(["enter", "ctrl+enter"]) }),
      ] },
      { name: "语音", rows: [
        tweak("dictationSend", "toggle", "停止时发送语音转写", "由你主动停止语音转写（点麦克风、面板上的停止或下方停顿触发）会像按 Enter 一样把转写文字随草稿发出。关闭后只写入草稿。因切换标签页或打开设置而停止的从不发送。", "dictation speech microphone voice auto send submit send voice to text on stop"),
        tweak("dictationAutoStop", "seg", "停顿后停止语音转写", "多久没有新词就停止录音；在你开口之前会一直等待。被 omp 识别成词的背景噪声会让它继续录。", "dictation speech microphone voice silence auto stop hands-free stop voice to text after a pause",
          { options: opts([0, 1.5, 2, 3, 5], { 0: "关闭", 1.5: "1.5 s", 2: "2 s", 3: "3 s", 5: "5 s" }) }),
        tweak("voiceSpectrumBands", "seg", "频谱条数", "语音转写或实时对话录音时，输入框上方的麦克风频谱显示多少根柱子。", "voice microphone equalizer spectrum fft bands bars spectrum bars",
          { options: opts([16, 32, 48, 64, 96, 128]) }),
      ] },
      { name: "粘贴", rows: [
        tweak("pasteCollapseLines", "slider", "折叠超长粘贴", "较长的粘贴会显示成 `[paste #1 +40 lines]` 小标签；智能体收到的仍是完整文本。", "paste chip collapse pastes longer than",
          { step: 1, unit: " lines",
            get min() { return sessionUi()?.PASTE_LINES_MIN ?? 2; },
            get max() { return sessionUi()?.PASTE_LINES_MAX ?? 50; } }),
      ] },
      { name: "历史", rows: [
        tweak("promptHistoryLimit", "slider", "提示词历史", "输入框里按 `↑` 能调回多少条历史提示词，按标签页各自计算。", "recall up arrow prompt history", {
          step: 10, unit: " prompts",
          get min() { return history()?.MIN_LIMIT ?? 10; },
          get max() { return history()?.MAX_LIMIT ?? 1000; },
        }),
      ] },
    ] },
    { id: "rail", icon: "radar", title: "侧栏卡片", blurb: "对话旁边侧栏里的卡片，包括插件小部件和扩展小部件。", groups: [
      { name: "内置卡片", rows: [
        tweak("showContext", "toggle", "上下文指示", "模型上下文窗口的占用程度。", "tokens context gauge"),
        tweak("showRadar", "toggle", "智能体雷达", "智能体此刻在做什么。", "activity agent radar"),
        tweak("showSubagents", "toggle", "子智能体", "本标签页正在运行和已完成的子智能体。", "tasks subagents"),
        tweak("showChanges", "toggle", "改动", "显示本项目当前分支的 PR。需要 GitHub CLI（`gh`），并用 `gh auth login` 登录；未安装 `gh` 时卡片保持隐藏。关闭它也会停止 PR 监控并关掉自动修复；开启本卡片不会同时开启自动修复。", "github pull request pr auto fix ci checks review gh cli changes"),
        tweak("showMinimap", "toggle", "缩略图", "对话记录的全局概览，可用来快速跳转。", "overview minimap"),
      ] },
      { name: "小部件", src: "widgets.json", rows: [
        custom("widgets", "插件配置", "插件及其触发方式。脚本改动后，再次运行前会重新请求审批。", "widget plugins plugin widgets.json extension status reload",
          { keyPrefix: "widget:", prefixDefault: true }),
      ] },
    ] },
    { id: "terminal", icon: "terminal", title: "终端", blurb: "对话下方的命令行面板。每个标签页都有自己的 shell，在标签页所属项目目录里启动。", groups: [
      { name: "命令行", src: "terminal.json", rows: [
        custom("shell", "命令行", "新终端启动什么。已在运行的保持原 shell。“默认”使用你的默认 shell。", "powershell pwsh bash cmd"),
      ] },
      { name: "面板", rows: [
        tweak("terminalAutoOpen", "toggle", "新标签页打开", "打开标签页时显示终端面板。", "auto open with new tab"),
        tweak("terminalScrollback", "seg", "回滚行数", "每个终端可回滚的行数。数值越大，每个已打开 shell 占用的内存越多。", "history lines buffer scrollback",
          { options: opts([1000, 5000, 10000, 50000]) }),
        custom("terminalHeight", "高度", "所有标签页共用。拖动面板上边缘可改变高度。", "size", { keys: ["terminalHeight"] }),
      ] },
    ] },
    { id: "browser", icon: "web", title: "浏览器", blurb: "每个标签页里你和智能体共用的 Chromium 面板。", groups: [
      { name: "Chromium", src: "browser.json", rows: [
        custom("chromium", "浏览器", "面板使用哪个 Chromium；之后启动的面板才会采用。“自动”会查找本机已安装的。", "chrome edge chromium"),
      ] },
      { name: "链接", rows: [
        tweak("browserLocalhostInPanel", "toggle", "在面板里打开 localhost 链接", "在对话里点击 `localhost` 链接时，改在面板里打开，而不是系统浏览器。", "dev server url open localhost links in the panel"),
      ] },
    ] },
    { id: "agent", icon: "agent", title: "智能体", blurb: "新标签页使用哪个 omp 配置档，以及 omp 在其中如何运作。", groups: [
      { name: "配置档", src: "profiles.json", rows: [
        custom("startupProfile", "启动配置档", "启动时打开的标签页和新标签页使用的配置档。配置档在配置档菜单里创建和重命名。", "profile account"),
      ] },
      { name: "目标", src: "omp config", rows: [
        custom("goalContinue", "持续执行目标", "omp 在每回合结束后自行继续当前目标，而不是等你发话。无人看管时会持续消耗 token。", "goal auto continue"),
      ] },
      { name: "omp 行为", rows: [
        tweak("autoCompaction", "toggle", "自动压缩上下文", "上下文将满时，omp 会自动摘要较早的回合。关闭后需自己运行 `/compact`。", "compaction context window auto-compact context"),
        tweak("autoRetry", "toggle", "重试失败的请求", "提供商拒绝或中断请求时 omp 会自动重试，并显示一行可随时中止的重试记录。", "retry error rate limit retry failed requests"),
      ] },
    ] },
    { id: "session", icon: "clock", title: "会话", blurb: "重启、关闭、命名标签页，以及查看版本和升级信息。", groups: [
      { name: "标签页", rows: [
        tweak("restoreTabs", "toggle", "启动时恢复标签页", "启动时打开退出前的标签页和对话。", "restore session startup reopen tabs on launch"),
        tweak("confirmBusyClose", "toggle", "关闭工作中的标签页前询问", "关闭智能体正在执行的标签页会中断它。关闭前先询问，退出应用时也一样。", "confirm quit close ask before closing a working tab"),
        tweak("autoName", "toggle", "自动命名标签页", "omp 会依据开头几回合给新对话起标题（一次小模型调用）。`/rename` 指定的名字始终优先。", "rename title name tabs automatically"),
      ] },
      { name: "更新", rows: [
        custom("version", "版本", "安装包升级请从发行页面下载。中文分支尚未配置独立的应用内更新源。", "version release download update"),

      ] },
    ] },
    { id: "remote", icon: "live", title: "远程访问", blurb: "在局域网里用手机查看会话、回答问题、指挥智能体。默认关闭；开启前不会有任何监听。", groups: [
      { name: "服务器", src: "remote.json", rows: [
        custom("remoteServer", "服务器", "手机连接用的网卡、端口和名称。服务器只监听选定的网卡。", "remote phone mobile server interface port host name https lan vpn"),
        custom("remoteCert", "证书", "自动生成的证书是自签名的；用自己的证书文件（例如为 `omp.home.lan` 签发的）才能让手机信任该页面。", "tls https certificate fingerprint pem key"),
      ] },
      { name: "手机", rows: [
        custom("remotePair", "配对手机", "显示一次性二维码，扫码即可绑定该手机。", "qr code pairing link"),
        custom("remoteDevices", "已配对手机", "重命名手机或吊销其访问权限。", "devices revoke rename"),
      ] },
      { name: "通知", rows: [
        custom("remotePush", "推送通知", "有提问等待或回合结束时通知手机，即使页面已关闭。", "web push vapid notification contact locked lock away screen"),
      ] },
    ] },
    { id: "approvals", icon: "check", title: "审批", sep: true, blurb: "智能体运行工具前是否先征求同意。", groups: [
      { name: "审批模式", src: "approval-mode.json", rows: [
        custom("approvalMode", "工具审批模式", "智能体运行工具前是否征求同意：为所有项目设默认值，也可按项目覆盖。修改后会在受影响的标签页里重启 omp，对话继续。", "yolo write always ask permission project override default"),
      ] },
      { name: "常驻规则", rows: [
        custom("approvalRules", "始终允许规则", "规则只能从审批提示中授予；在这里查看和吊销。", "rules always allow revoke saved answers"),
      ] },
    ] },
    { id: "shortcuts", icon: "command", title: "快捷键", blurb: "所有应用操作及其组合键。改动 omp 自带的绑定会存为桌面端覆盖项。", groups: [
      { name: "键盘快捷键", src: "keybindings.json", rows: [
        custom("shortcuts", "按键绑定", "重新绑定某个操作、添加第二个组合键，或恢复默认。", "keys hotkeys keybindings chord rebind shortcut",
          { moreKw: () => (window.OMP_KEYMAP?.KEYMAP_ACTIONS ?? []).map(a => `${a.label} ${a.id}`).join(" ") }),
      ] },
    ] },
  ];

  const sectionById = (id) => SECTIONS.find(s => s.id === id);
  const sectionRows = (s) => s.groups.flatMap(g => g.rows);
  const ROWS = SECTIONS.flatMap(sectionRows);

  /** Every row, in page order. */
  const rows = () => ROWS;

  /** The value a tweak row's control shows: fold modes resolved, numbers clamped. */
  function value(row, values) {
    const v = values?.[row.key];
    if (row.fold) return collapse()?.foldModes(values)[row.fold] ?? v ?? "auto";
    return clamp(row, v === undefined ? defaults()[row.key] : v);
  }

  /** `v` made valid for the row: sliders rounded to their step within bounds,
   *  segments one of their options, toggles a boolean; else the default. */
  function clamp(row, v) {
    const fallback = defaults()[row.key];
    if (row.type === "slider") {
      const n = Number(v);
      if (v === null || v === "" || !Number.isFinite(n)) return fallback;
      const stepped = row.min + Math.round((n - row.min) / row.step) * row.step;
      return Math.min(row.max, Math.max(row.min, stepped));
    }
    if (row.options) return row.options.some(o => o.value === v) ? v : fallback;
    if (row.type === "toggle") return typeof v === "boolean" ? v : fallback;
    return v ?? fallback;
  }

  /** Shown now: a row with `visibleIf` asks it (collapseAfter). */
  const visible = (row, values) => row.visibleIf?.(values) ?? true;

  // Tweak keys a custom row owns that differ from their defaults. A
  // `keyPrefix` row counts only `opts.prefixKeys` when given: the keys it
  // renders a control for (a stored key of a removed plugin has no row).
  function ownedChanged(row, values, opts) {
    const d = defaults();
    const changed = (row.keys ?? []).filter(k => k in (values ?? {}) && values[k] !== d[k]);
    if (row.keyPrefix) {
      for (const k of opts?.prefixKeys ?? Object.keys(values ?? {})) {
        if (k.startsWith(row.keyPrefix) && k in (values ?? {}) && values[k] !== row.prefixDefault) changed.push(k);
      }
    }
    return changed;
  }

  /** Changed from its default. Accent compares with the current theme's
   *  own accent (a theme pick resets it); fold modes compare resolved.
   *  `opts.prefixKeys`: see ownedChanged. */
  function isModified(row, values, opts) {
    if (row.kind === "custom") return ownedChanged(row, values, opts).length > 0;
    if (row.key === "accent") return !window.OMP_ACCENT.sameColor(values?.accent, themeAccent(values?.theme));
    return value(row, values) !== value(row, defaults());
  }

  /** Edits for setTweak that put one row back to its default. */
  function resetRow(row, values, opts) {
    const d = defaults();
    if (row.kind === "custom") {
      const edits = {};
      for (const k of ownedChanged(row, values, opts)) edits[k] = row.keyPrefix && k.startsWith(row.keyPrefix) ? row.prefixDefault : d[k];
      return edits;
    }
    if (row.key === "theme") return { theme: d.theme, accent: themeAccent(d.theme) };
    if (row.key === "accent") return { accent: themeAccent(values?.theme) };
    return { [row.key]: d[row.key] };
  }

  const scope = (sectionId) => (sectionId && sectionId !== "all" ? [sectionById(sectionId)].filter(Boolean) : SECTIONS);

  /** Changed visible rows of a section (or of all, for `"all"`/nothing). */
  const modifiedCount = (sectionId, values, opts) =>
    scope(sectionId).flatMap(sectionRows).filter(r => visible(r, values) && isModified(r, values, opts)).length;

  /** Edits for setTweak that reset every changed row of `rows`.
   *  Rows see the edits before them, so a theme reset settles the accent. */
  function resetRows(rows, values, opts) {
    const edits = {};
    for (const r of rows) {
      const next = { ...values, ...edits };
      if (isModified(r, next, opts)) Object.assign(edits, resetRow(r, next, opts));
    }
    return edits;
  }

  /** resetRows over a section (or all). */
  const resetEdits = (sectionId, values, opts) => resetRows(scope(sectionId).flatMap(sectionRows), values, opts);

  // `moreKw`: keywords known only at runtime (the shortcut action names).
  // Custom rows show `label` and `desc` too, plus runtime text of their own;
  // `version` shows runtime text as its desc, `shortcuts` only its editor.
  const searchText = (row) =>
    `${row.label} ${(row.desc ?? "").replace(/`/g, "")} ${row.kw ?? ""} ${row.moreKw?.() ?? ""}`.toLowerCase();

  /** Visible rows whose label, desc or keywords contain the query,
   *  case-insensitive, grouped by section › group in page order. */
  function search(query, values) {
    const q = String(query ?? "").trim().toLowerCase();
    const bySection = Object.fromEntries(SECTIONS.map(s => [s.id, 0]));
    const groups = [];
    let total = 0;
    if (!q) return { total, bySection, groups };
    for (const s of SECTIONS) {
      for (const g of s.groups) {
        const hits = g.rows.filter(r => visible(r, values) && searchText(r).includes(q));
        if (!hits.length) continue;
        groups.push({ sectionId: s.id, sectionTitle: s.title, groupName: g.name, src: g.src, rows: hits });
        bySection[s.id] += hits.length;
        total += hits.length;
      }
    }
    return { total, bySection, groups };
  }

  window.OMP_SETTINGS = Object.freeze({
    SECTIONS, THEMES, ACCENTS, themeAccent,
    rows, value, clamp, visible, isModified, resetRow, modifiedCount, resetRows, resetEdits, search,
  });
})();
