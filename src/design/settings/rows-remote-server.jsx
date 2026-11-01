/* ═════════════════════════════════════════════════════════════════════
   design/settings/rows-remote-server.jsx — Server and Certificate rows of
   Settings → Remote access (window.OMP_SETTINGS_ROWS):
     remoteServer   enable, interface, port, host name, status
     remoteCert     generated or own files; fingerprint; regenerate
   Depends on `rows-remote-shared.jsx` (`_SRR_useRemote`, `_SRR_useAsync`,
   `_SRR_Field`, `_SRR_Line`).
   ═════════════════════════════════════════════════════════════════════ */

/** The port a text field holds, or `null` for anything but an integer in 1–65535. */
function _SRR_parsePort(text) {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n > 0 && n < 65536 ? n : null;
}

function _SRR_statusText(status) {
  if (!status) return "正在读取状态…";
  if (status.error) return status.error;
  if (status.listening) return `listening on ${status.url ?? status.ip ?? ""}`;
  return status.enabled ? "正在启动…" : "关闭";
}

function _SRR_Server({ row, ctx, query }) {
  const Row = window.SettingsRow, Toggle = window.SettingsToggle;
  const { status, error, apply, run } = _SRR_useRemote(ctx.bridge);
  const ifaces = _SRR_useAsync(() => ctx.bridge.remoteInterfaces(), [], [ctx.bridge]);
  const s = status?.settings;
  const known = ifaces.some(i => i.name === s?.interface);
  return (
    <Row label={row.label} desc={row.desc} query={query} stack>
      <div className="st-rem">
        <_SRR_Line label="启用">
          <Toggle value={!!s?.enabled} label="启用远程访问" onChange={v => apply({ enabled: v })} />
        </_SRR_Line>
        <_SRR_Line label="接口">
          <select className="st-rem-input" value={s?.interface ?? ""} disabled={!s} aria-label="网络接口"
            onChange={e => apply({ interface: e.target.value || null })}>
            <option value="">选择…</option>
            {s?.interface && !known && <option value={s.interface}>{s.interface} （未找到）</option>}
            {ifaces.map(i => <option key={i.name} value={i.name}>{i.name} · {i.ip}</option>)}
          </select>
        </_SRR_Line>
        <_SRR_Line label="端口">
          <_SRR_Field value={String(s?.port ?? "")} label="端口" width={90} disabled={!s}
            onCommit={text => {
              const port = _SRR_parsePort(text);
              if (port === null) return false;
              apply({ port });
            }} />
        </_SRR_Line>
        <_SRR_Line label="主机名">
          <_SRR_Field value={s?.hostName ?? ""} label="主机名" placeholder="例如 omp.home.lan" width={240} disabled={!s}
            onCommit={text => apply({ hostName: text.trim() || null })} />
        </_SRR_Line>
        <div className={`st-rem-status${status?.error ? " err" : ""}`}>{_SRR_statusText(status)}</div>
        {error && <div className="st-row-error">{error}</div>}
      </div>
    </Row>
  );
}

function _SRR_Cert({ row, ctx, query }) {
  const Row = window.SettingsRow, Btn = window.SettingsButton, Seg = window.SettingsSeg;
  const { status, error, apply, run } = _SRR_useRemote(ctx.bridge);
  const s = status?.settings;
  const saved = s?.cert?.kind === "files";
  // "own files" is only a draft until the paths are saved with the button.
  const [draftOwn, setDraftOwn] = React.useState(false);
  const own = saved || draftOwn;
  const [files, setFiles] = React.useState({ cert: "", key: "" });
  React.useEffect(() => { if (saved) setFiles({ cert: s.cert.cert, key: s.cert.key }); }, [saved, s?.cert?.cert, s?.cert?.key]);
  const saveFiles = () => apply({ cert: { kind: "files", cert: files.cert.trim(), key: files.key.trim() } });
  return (
    <Row label={row.label} desc={row.desc} query={query} stack>
      <div className="st-rem">
        <_SRR_Line label="来源">
          <Seg label="证书来源" value={own ? "files" : "generated"}
            options={[{ value: "generated", label: "自动生成" }, { value: "files", label: "自有文件" }]}
            onChange={v => { if (v === "generated") { setDraftOwn(false); apply({ cert: { kind: "generated" } }); } else setDraftOwn(true); }} />
        </_SRR_Line>
        {own && (
          <>
            <_SRR_Line label="证书（PEM）">
              <input className="st-rem-input" type="text" value={files.cert} aria-label="证书文件路径" spellCheck={false}
                style={{ width: 320 }} onChange={e => setFiles(f => ({ ...f, cert: e.target.value }))} />
            </_SRR_Line>
            <_SRR_Line label="私钥（PEM）">
              <input className="st-rem-input" type="text" value={files.key} aria-label="私钥文件路径" spellCheck={false}
                style={{ width: 320 }} onChange={e => setFiles(f => ({ ...f, key: e.target.value }))} />
            </_SRR_Line>
            <div className="st-btns"><Btn onClick={saveFiles} disabled={!files.cert.trim() || !files.key.trim()}>使用这些文件</Btn></div>
          </>
        )}
        {!own && (
          <div className="st-btns">
            <Btn onClick={() => run(() => ctx.bridge.remoteRegenerateCert())} disabled={!s}>重新生成</Btn>
          </div>
        )}
        {status?.fingerprint && <_SRR_Line label="SHA-256"><span className="st-path">{status.fingerprint}</span></_SRR_Line>}
        {error && <div className="st-row-error">{error}</div>}
      </div>
    </Row>
  );
}

Object.assign(window.OMP_SETTINGS_ROWS = window.OMP_SETTINGS_ROWS || {}, {
  remoteServer: _SRR_Server,
  remoteCert: _SRR_Cert,
});
