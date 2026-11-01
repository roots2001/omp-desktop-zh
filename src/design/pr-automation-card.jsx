// Shows the checked-out branch's PR; Auto-fix is explicitly opt-in.
function PrAutomationCard({ automation, available = true, bridge }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState(null);
  const triggerRef = React.useRef(null);
  const menuId = React.useId();
  const pr = automation.snapshot;
  const close = (refocus = true) => {
    setMenuOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  React.useEffect(() => {
    setMenuOpen(false);
    setActionError(null);
  }, [pr?.url]);

  const openMenu = () => {
    if (menuOpen) {
      close();
      return;
    }
    setMenuOpen(true);
    setActionError(null);
  };
  /** Open `url` in the system browser; a failure shows under the card. */
  const openExternal = async (url) => {
    setActionError(null);
    try {
      const result = await bridge.openExternalUrl(url);
      if (!result?.ok) throw new Error(result?.error || "无法打开链接。");
      return true;
    } catch (error) {
      setActionError(error?.message || String(error));
      return false;
    }
  };
  const openUrl = async (suffix) => {
    if (await openExternal(pr.url + suffix)) close();
  };
  const copyLink = async () => {
    if (await window.copyText(pr.url)) close();
    else setActionError("无法复制 PR 链接。");
  };
  const error = automation.error || automation.discoveryError;
  const summary = !available
    ? "打开一个已连接的项目标签页以查看它的 PR。"
    : automation.loading
      ? "正在更新当前分支的 PR…"
      : error
        ? "无法更新 PR。"
        : "当前分支没有打开的 PR。";

  return (
    <section className="rail-card glass pr-changes" aria-label="改动">
      <div className="pr-changes-head">
        <button
          className="pr-changes-heading"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          改动 <window.Icon name={collapsed ? "chevR" : "chev"} size={11} />
        </button>
      </div>
      {!collapsed &&
        (pr ? (
          <div className="pr-changes-row">
            <span
              className={`pr-changes-icon${pr.isDraft ? " draft" : ""}`}
              role="img"
              aria-label={
                pr.isDraft ? "草稿 PR" : "打开的 PR"
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <circle cx="4" cy="3" r="1.5" />
                <circle cx="4" cy="13" r="1.5" />
                <circle cx="12" cy="13" r="1.5" />
                <path d="M4 4.5v7M12 11.5V6a3 3 0 0 0-3-3H8m2-2L8 3l2 2" />
              </svg>
            </span>
            <button
              className="pr-changes-title"
              title={pr.title}
              onClick={() => openExternal(pr.url)}
            >
              {pr.title}
            </button>
            <button
              ref={triggerRef}
              className={`pr-changes-more${menuOpen ? " active" : ""}`}
              onClick={openMenu}
              aria-label={`Actions for pull request #${pr.number}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="7" cy="3" r="1" />
                <circle cx="7" cy="7" r="1" />
                <circle cx="7" cy="11" r="1" />
              </svg>
            </button>
            <div className="pr-changes-meta">
              <span className="pr-changes-repo" title={pr.repository}>
                {pr.repository?.split("/").at(-1)} #{pr.number}
              </span>
              <span className="pr-changes-added">+{pr.additions}</span>
              <span className="pr-changes-deleted">−{pr.deletions}</span>
            </div>
            {automation.enabled && (
              <span
                className={`pr-changes-dot${error ? " error" : ""}`}
                role="status"
                aria-label={error || automation.status}
                title={`Auto-fix · ${error || automation.status}`}
              />
            )}
            {pr.checks.length > 0 && (
              <div className="pr-changes-ci">
                <window.PrChecks checks={pr.checks} onOpen={openExternal} />
              </div>
            )}
          </div>
        ) : (
          <p
            className="pr-changes-empty"
            role="status"
            title={error || undefined}
          >
            {summary}
          </p>
        ))}
      {!collapsed && error && (
        <p className="pr-changes-error" role="alert">
          {error}
        </p>
      )}
      {!collapsed && !pr && automation.enabled && (
        <button className="pr-changes-disable" onClick={automation.toggle}>
          关闭自动修复
        </button>
      )}
      {actionError && !menuOpen && (
        <p className="pr-changes-error" role="alert">
          {actionError}
        </p>
      )}
      {menuOpen && pr && (
        <window.PrAutomationMenu
          id={menuId}
          pr={pr}
          automation={automation}
          available={available}
          triggerRef={triggerRef}
          error={actionError}
          onOpen={openUrl}
          onCopy={copyLink}
          onClose={close}
        />
      )}
    </section>
  );
}
window.PrAutomationCard = PrAutomationCard;
