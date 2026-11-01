/* pr-automation-menu.jsx — the Changes card's "⋮" menu: PR links, copy,
   and the tab's only Auto-fix toggle. Portaled out of the rail's scroll
   container and placed against the trigger when it opens; dismissed by an
   outside click, Escape, Tab, a window resize, or a scroll that moves the
   trigger (not the transcript following new output). */

/** Fixed-position style for the menu, flipped above the trigger when short. */
function _PAM_place(trigger) {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const position =
    below < 280 && above > below
      ? {
          bottom: window.innerHeight - rect.top + 4,
          maxHeight: Math.max(0, above),
        }
      : { top: rect.bottom + 4, maxHeight: Math.max(0, below) };
  return {
    right: Math.max(
      8,
      Math.min(window.innerWidth - rect.right, window.innerWidth - 258),
    ),
    ...position,
  };
}

function PrAutomationMenu({
  id,
  pr,
  automation,
  available,
  triggerRef,
  error,
  onOpen,
  onCopy,
  onClose,
}) {
  const [style] = React.useState(() => _PAM_place(triggerRef.current));
  const popRef = React.useRef(null);
  const rootRef = React.useRef(null);
  const descriptionId = React.useId();
  rootRef.current = {
    contains: (node) =>
      triggerRef.current?.contains(node) || popRef.current?.contains(node),
  };
  window.usePopoverDismiss(true, rootRef, () => onClose(false), onClose);
  React.useEffect(() => {
    popRef.current?.querySelector('[role="menuitem"]')?.focus();
    // Only a scroll that moves the trigger misplaces the menu; the
    // transcript scrolling under "Follow new output" must not close it.
    // A page scroll targets `document`, which contains the trigger too.
    const dismiss = (e) => {
      if (
        e.type === "resize" ||
        (e.target instanceof Node && e.target.contains(triggerRef.current))
      )
        onClose(false);
    };
    window.addEventListener("resize", dismiss);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, []);

  return ReactDOM.createPortal(
    <div
      ref={popRef}
      id={id}
      className="pr-changes-menu"
      style={style}
      role="menu"
      aria-label={`Pull request #${pr.number}`}
      onKeyDown={(e) =>
        window.menuKeyNav(e, popRef.current, '[role^="menuitem"]', onClose)
      }
    >
      <button role="menuitem" onClick={() => onOpen("")}>
        在 GitHub 上打开
      </button>
      <button role="menuitem" onClick={onCopy}>
        复制链接
      </button>
      <div className="pr-changes-separator" role="separator" />
      <button role="menuitem" onClick={() => onOpen("/files")}>
        查看改动
      </button>
      <button role="menuitem" onClick={() => onOpen("#discussion_bucket")}>
        打开审查意见
      </button>
      <div className="pr-changes-separator" role="separator" />
      <button
        className="pr-changes-autofix"
        role="menuitemcheckbox"
        aria-checked={automation.enabled}
        disabled={!available}
        aria-describedby={descriptionId}
        onClick={automation.toggle}
      >
        <span className="pr-changes-checkbox" aria-hidden="true">
          {automation.enabled && <window.Icon name="check" size={10} />}
        </span>
        自动修复
      </button>
      <p id={descriptionId} className="pr-changes-menu-note">
        修复 CI 和审查意见。可以提交、推送并关闭已处理的讨论串；工具审批仍然生效。
      </p>
      <p className="pr-changes-menu-status" role="status">
        {automation.status}
      </p>
      <p className="pr-changes-menu-note">
        仅本标签页。停止时也会关闭自动修复。
      </p>
      {error && (
        <p className="pr-changes-error" role="alert">
          {error}
        </p>
      )}
    </div>,
    document.body,
  );
}

window.PrAutomationMenu = PrAutomationMenu;
