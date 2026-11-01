/* ═════════════════════════════════════════════════════════════════════
   approval-mode-section.jsx — the tool approval mode editor (#57), one
   component shown in both the approvals panel (approval-rules-panel.jsx)
   and Settings → Approvals (settings/rows-approvals.jsx): omp's
   `--approval-mode` default for every project, one row per project (the
   active tab's folder first, then every other override, each with
   inherit/always ask/write/yolo and a remove button), the mode the active
   tab resolves to with its description, and what the last change did to
   the open tabs. Backed by OMP_BRIDGE.setApprovalModeProject /
   setApprovalModeDefault (Rust `approval_mode.rs` stores the choice;
   live.js restarts the tabs it changes with `--resume`, idle ones at once
   and busy ones when their turn ends). Pure helpers: app/approval-mode.js
   (read late-bound).
   ═════════════════════════════════════════════════════════════════════ */

const { Icon: _AMS_Icon } = window;

// One segmented radio group. `options`: [{ value, label }]; the literal
// "default" value renders as the muted `inherit` segment.
function ApprovalModeSeg({ label, options, value, disabled, onPick }) {
  return (
    <div className="mode-seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          data-mode={o.value === "default" ? "inherit" : o.value}
          disabled={disabled}
          onClick={() => { if (o.value !== value) onPick(o.value); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// What the last change did: `result` is a set's `{ ok, error?, restarted,
// deferred }`, null before any change in this editor.
function ApprovalModeApplyLine({ result, busy, hasProject, sessions }) {
  if (busy) return <div className="mode-apply"><span className="spin">⟳</span> 正在重启…</div>;
  if (!result) {
    return (
      <div className="mode-apply">
        {hasProject
          ? "修改会重启该项目下打开的标签页中的 omp，对话会继续。智能体正在工作的标签页会在本轮结束时切换。"
          : "作用于新标签页，以及没有单独设置的项目下已打开的标签页。"}
      </div>
    );
  }
  if (!result.ok) return <div className="mode-apply error">{result.error || "改动未能保存"}</div>;
  const n = result.restarted.length;
  const names = result.deferred
    .map(id => sessions.find(s => s.id === id)?.name)
    .filter(Boolean);
  return (
    <div className="mode-apply">
      {n > 0 && <><span className="spin">⟳</span>{n} 个标签页已按新模式重启。</>}
      {n === 0 && names.length === 0 && "已保存。没有标签页需要重启。"}
      {names.length > 0 && (
        <>
          {n > 0 && " "}
          <b>{names.join(", ")}</b>
          {" 正在工作，会在本轮结束时切换。"}
        </>
      )}
    </div>
  );
}

/** `view` is the bridge snapshot's `approvalModes`, `activeProject` the
 *  rendered tab's entry (null with no tab), `query` the Settings search
 *  (highlights project paths; absent in the panel). */
function ApprovalModeSection({ view, activeProject, sessions, query }) {
  const bridge = window.OMP_BRIDGE;
  const AM = window.OMP_APPROVAL_MODE;
  const Mark = window.SettingsMark;
  const [busy, setBusy]     = React.useState(false);
  const [result, setResult] = React.useState(null);

  const path = activeProject?.path || null;
  const projects = AM.projectRows(view, path);
  const fallback = AM.effectiveFor(view, null); // the global default
  const effective = AM.effectiveFor(view, path);
  const shown = AM.MODES.find(m => m.value === effective);
  const modeOptions = AM.MODES.map(m => ({ value: m.value, label: m.label }));
  const projectOptions = [{ value: "default", label: "继承" }, ...modeOptions];
  const disabled = busy || !view;

  const apply = async call => {
    if (!bridge || busy) return;
    setBusy(true);
    try {
      setResult(await call());
    } finally {
      setBusy(false);
    }
  };
  const setProject = (p, v) => apply(() => bridge.setApprovalModeProject(p, v === "default" ? null : v));
  const pathText = p => (Mark && query ? <Mark text={p} query={query} /> : p);

  return (
    <div className="mode-sect">
      <div className="mode-row">
        <div className="mode-lbl"><span>所有项目的默认值</span></div>
        <ApprovalModeSeg
          label="所有项目的默认值"
          options={modeOptions}
          value={fallback}
          disabled={disabled}
          onPick={v => apply(() => bridge.setApprovalModeDefault(v))}
        />
        <span className="mode-rm" aria-hidden="true" />
      </div>
      {projects.map(p => (
        <div className="mode-row" key={p.path}>
          <div className="mode-lbl">
            <span>{p.active ? "当前项目" : "项目"}</span>
            <span className="mode-path mono" title={p.path}>{pathText(p.path)}</span>
          </div>
          <ApprovalModeSeg
            label={p.path}
            options={projectOptions}
            value={p.value}
            disabled={disabled}
            onPick={v => setProject(p.path, v)}
          />
          {p.value === "default"
            ? <span className="mode-rm" aria-hidden="true" />
            : (
              <button className="btn icon ghost mode-rm" disabled={disabled}
                title="移除覆盖（继承默认值）" aria-label={`remove the override of ${p.path}`}
                onClick={() => setProject(p.path, "default")}>
                <_AMS_Icon name="close" size={10} />
              </button>
            )}
        </div>
      ))}
      {shown && (
        <div className={`mode-note${shown.warn ? " warn" : ""}`}>
          {path ? "本项目：" : "新标签页："}<b>{shown.label}</b> — {shown.blurb}
        </div>
      )}
      <ApprovalModeApplyLine result={result} busy={busy} hasProject={projects.length > 0} sessions={sessions ?? []} />
    </div>
  );
}

window.ApprovalModeSection = ApprovalModeSection;
