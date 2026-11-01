/* ═════════════════════════════════════════════════════════════════════
   design/settings/rows-session.jsx — Settings → Session's custom `version`
   row (window.OMP_SETTINGS_ROWS): the running app version and a link to
   this branch's releases page (ctx.updater, app/use-updater.jsx). This
   fork ships without an in-app update feed; there is no check to run.
   ═════════════════════════════════════════════════════════════════════ */

// The schema desc is search text only: the shown desc is the runtime state.
function _SRS_Version({ row, ctx, query }) {
  const { SettingsRow: Row, SettingsButton: Button, Icon } = window;
  const { updater } = ctx;
  const skipped = ctx.t.skippedUpdate ?? null;
  const desc = `OMP Desktop ${updater.version ?? "…"} · 从发行页面手动下载新版安装包`;
  return (
    <Row label={row.label} desc={desc} query={query}>
      <div className="st-btns">
        {skipped && (
          <Button onClick={updater.clearSkipped} title={`再次提示 ${skipped}`}>清除已跳过版本</Button>
        )}
        <Button onClick={updater.openRelease}>
          <Icon name="external" size={11} />打开发行页面
        </Button>
      </div>
    </Row>
  );
}

Object.assign(window.OMP_SETTINGS_ROWS = window.OMP_SETTINGS_ROWS || {}, { version: _SRS_Version });
