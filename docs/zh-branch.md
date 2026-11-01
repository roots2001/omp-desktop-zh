# 中文分支维护说明

本文只约束 OMP Desktop 的简体中文分支。上游功能的协议、状态机和安全边界仍以 [`docs/architecture/`](architecture/) 为准。

## 分支目标与边界

- 这是社区维护的**非官方中文分支**，上游是 [`apoc/omp-desktop`](https://github.com/apoc/omp-desktop)。
- 优先保留上游完整功能，只改变界面文案、中文版发行信息和必要的升级入口。
- 不翻译 `omp` 返回的知识库、智能体回复、工具输出和用户输入。界面可以中文化，但底层数据不能被改坏。
- 中文分支仓库是 [`roots2001/omp-desktop-zh`](https://github.com/roots2001/omp-desktop-zh)。正式发布前仍必须补齐提交历史、remote、版本规则、版权归属和上游同步记录，不能用本目录的临时状态直接对外发布。

## 翻译分工

### 源码内静态翻译

React 界面直接写在 `src/app/` 和 `src/design/` 的 JSX/JS 中。已有文案优先直接改成中文，并遵守原文件风格。这样不依赖运行时替换，性能更稳定，也更容易审阅。

需要批量处理上游同步后的文案时，使用：

```powershell
node scripts/zh/extract.mjs --stats
node scripts/zh/extract.mjs --json > .tmp-zh-extract.json
# 人工审阅提取结果，更新 localization/zh.json
node scripts/zh/apply.mjs --dry
node scripts/zh/apply.mjs
```

`apply.mjs` 用 AST 找到源码里的字符串位置，不会因为字典里有某句话就误替换到别的上下文。不要跳过 `--dry` 审阅直接批量写入。

### 手机远程页面

手机页面的 DOM 由 `src/remote/` 的脚本动态创建，部分静态文案无法在源码里一次性写出。`src/zh-i18n.js` 只做**完整字符串精确匹配**：

- `translate(text)` 用于动态构造的文案。
- `translateDom(scope, skipSelector)` 用于页面内已有的静态文本及 `aria-label`、`placeholder`、`title`。
- 未命中时原样返回英文，不猜测、不模糊匹配。
- 默认可跳过对话正文、用户/智能体内容、工具输出、输入框、`pre` 和 `code`。

手机页面由 Rust 内嵌。只要新增或改名了 `src/remote/` 下的资源，就必须同步修改 `src-tauri/src/remote/assets.rs` 的路径映射，否则桌面端可用、手机端会 404。回归测试 `tests/test-remote-client.mjs` 会检查这部分。

### 术语约定

- *turn* 译为“回合”，*session* 译为“会话”，*tab* 译为“标签页”。
- *profile* 译为“配置”，*approval* 译为“审批”，*retry* 译为“重试”。
- *agent* 在界面中可用“智能体”；工具名、命令名、模型名和协议字段保持原文。
- `Settings → Session` 一类路径按界面实际中文名称写，例如“设置 → 会话”。如果以后中文化了分区名，要同步更新文档和测试。

## 不可翻译的协议常量

下列字符串参与 RPC、后端常量比对或审批协议，必须保留原文。`scripts/zh/apply.mjs` 中的 `NEVER` 列表已经按文件精确豁免；不要为了“界面统一”而删除这些豁免。

| 文件 | 必须保留的原文 |
|---|---|
| `src/app/approval.js` | `Allow tool: `、`Approve`、`Deny` |
| `src/app/turn-status.js` | `Retry cancelled`、`provider request failed` |
| `src/app/session-title.js` | `Session renamed to `、`Could not generate a session title`、`Session name not changed`、`Rename failed` |
| `src/app/marked-setup.js` | `Copy code` |
| `src/app/subagents.js` | `tool failed` |
| `src/remote/client.js` | `Confirm`、`Deny` |

**显示值和协议值要分开。** 手机页远端按钮可以显示“确认/拒绝”，但发送给桌面的布尔字段仍然必须是 `confirm: true/false` 或协议规定的值；不能把显示字符串直接塞回协议。

新增任何参与协议判断的字符串时，先把“仅用于显示”和“会回传或比对”分开，再把前者加入可翻译范围，后者加入 `NEVER` 与对应测试。

## 上游同步流程

1. 先在独立分支保存当前中文改动，记录合并的上游提交范围。
2. 合并上游后先运行 `node scripts/zh/extract.mjs --stats`，看新增字符串数量和解析错误；解析失败必须为 0。
3. 审阅新增的英文文案，更新 `localization/zh.json`，再按上文的 AST 流程应用。
4. 重点复查动态文案、手机页、Rust 命令返回值、错误提示和协议常量；不要只按字符串数量判断同步完成。
5. 运行 `node tests/test-zh-i18n.mjs`、`node tests/test-remote-client.mjs`、`node tests/test-remote-view.mjs` 和 `npm test`。
6. 有 Rust 工具链时再运行 `cargo test --locked`、`cargo check` 和发布构建。
7. 在真实应用窗口和手机上各走一遍关键路径：开项目、提问、审批、远程配对、远程回答、版本入口。自动测试不能代替实机验证。

上游更新可能同时改动 Rust 资源路径、协议字段、CSP、构建配置和脚本加载顺序。遇到这些变化时，先阅读相关的 `docs/architecture/` 文件，只合入本分支需要保留的差异，不要机械覆盖。

## 更新与发布策略

### 当前决策

- 中文分支 **不连接上游应用内更新源**。`src-tauri/tauri.conf.json` 中的 `plugins.updater.endpoints` 为空，避免中文版被替换回英文版。
- 前端 `IN_APP_UPDATES` 为 `false`。版本号、`/check-updates` 和快捷键直接打开本分支发行页面，不发起更新检查。
- 升级方式是手动下载中文分支的新版安装包并覆盖安装。
- `.github/workflows/release.yml` 目前只构建 Windows x64 的 `.msi` 和 NSIS `.exe`，且先运行测试，再生成草稿 Release。不要宣称已有 macOS/Linux 安装包。
- 桌面窗口标题在 `src/index.html` 和 `src-tauri/tauri.conf.json`；原生文件选择器在 `src-tauri/src/lib.rs`；Windows 安装器语言在 `tauri.conf.json`，右键菜单在 `src-tauri/packaging/windows-folder-verb.nsh` / `.wxs`；macOS 权限说明在 `src-tauri/packaging/Info.plist`。手机后台通知正文在 `src-tauri/src/remote/push.rs`。`tests/test-zh-packaging.mjs` 会检查这些系统层字符串，但真实安装后的显示仍需实机验收。

### 启用应用内更新前必须完成

应用内更新涉及安装器替换，不是改一个按钮。启用前至少要完成：

1. 确认 `src-tauri/Cargo.toml` 的 `repository`、`src/app/updater.js` 的 `RELEASES_URL` 和所有发行链接都指向 `roots2001/omp-desktop-zh`。
2. 生成中文分支**自己的** updater 签名密钥。`tauri.conf.json` 当前的 `pubkey` 仍是上游公钥，不能与自己的私钥混用。私钥只能放仓库 Secrets，绝不能提交。
3. 配置中文分支自己的 `latest.json` 更新源，明确版本高于比较规则、灰度/回滚方式和各平台产物是否齐全。
4. 让 `IN_APP_UPDATES`、自动检查设置和更新源配置保持一致，并补测试覆盖“不会从中文版升级回上游”。
5. 实际测试 Windows/macOS/Linux 的可自更新和 notify-only 路径；签名错误、网络失败、断点中断都不能留下坏安装。

警告：启用新密钥会改变更新链。已经安装的旧版如果没有对应私钥，就无法通过应用内更新收到新版本；必须先确定迁移策略。

## 发布前清单

- [ ] 独立仓库、许可证和上游归属说明已经确认
- [ ] 版本号、标签格式（例如 `v0.13.2-zh.1`）、`Cargo.toml` 和 `tauri.conf.json` 一致
- [ ] `npm test` 全部通过；Windows 符号链接权限导致的测试跳过必须明确记录
- [ ] `cargo test --locked`、clippy 和发布构建通过
- [ ] `src-tauri/tauri.conf.json` 的 updater endpoints、签名公钥和启用策略一致
- [ ] 安装器名称、应用显示名、包标识、Windows“用 OMP Desktop 打开”、macOS/Linux 桌面文件都逐项检查
- [ ] 用最新中文界面重新截取 README 截图，不沿用英文旧图
- [ ] Windows/macOS/Linux 各自有实际构建记录；不能构建的平台不写进下载表
- [ ] 检查 SmartScreen、代码签名、macOS 公证和 Linux 包依赖说明
- [ ] 在实机验证开项目、工具审批、终端、浏览器、远程访问和升级入口
- [ ] Release 仍是草稿，人工检查产物和发布说明后再发布
