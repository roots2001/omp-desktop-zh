/* design/conversation-tree.jsx — the conversation-tree pane: the active tab's
   conversation as a git-style graph, one row per prompt, each with its
   prompt-cache state (src/app/conversation-tree.js builds the rows; the data
   flow is app/use-conversation-tree.jsx). It replaces the ambient rail while
   open (`.stage.with-tree`, layout/tree.css). Props mirror the hook's result;
   `onBranch`/`onFork`/`onOpenFile` are its actions. */

const {
  TreeFmt: _CT_Fmt, TreeRow: _CT_Row,
  TreeCompaction: _CT_Compaction, TreeDetail: _CT_Detail,
} = window;

const TREE_NO_FILE = "还没有对话。标签页产生会话文件后，这里会显示对话树。";

const treeTtlLabel = ttlMs => (ttlMs == null ? "缓存有效期未知" : `缓存 · ${_CT_Fmt.dur(ttlMs)}`);

function TreeSummary({ model }) {
  const c = model.counts;
  const unknown = c.total > 0 && c.unknown === c.total;
  return (
    <div className="tree-summary">
      {unknown ? (
        <div>提供商未报告缓存有效期，因此缓存状态和价格未知。</div>
      ) : (<>
        <div>
          <b className="lime">{c.warm + c.expiring}</b> / {c.total} 条提示词可按缓存读取价重新提问
          {c.partial > 0 && <>, <b className="cyan">{c.partial}</b> 部分缓存</>}.
        </div>
        <div className="tree-legend mono">
          <span><i className="lg warm" />已缓存</span>
          <span><i className="lg expiring" />&lt; 10 分钟</span>
          <span><i className="lg partial" />部分缓存</span>
          <span><i className="lg cold" />冷缓存</span>
          <span className="muted">代价 = 现在重新提问</span>
        </div>
      </>)}
    </div>
  );
}

function ConversationTree({
  model, currentFile, error, loading, treeKey, now, since, streaming,
  onBranch, onFork, onOpenFile,
}) {
  const [selectedId, setSelectedId] = React.useState(null);
  React.useEffect(() => { setSelectedId(null); }, [treeKey]);

  const listRef = React.useRef(null);
  const scrolledFor = React.useRef("");
  // First load of a conversation: show the end (newest prompts).
  React.useLayoutEffect(() => {
    if (!model || model.rows.length === 0 || scrolledFor.current === treeKey) return;
    scrolledFor.current = treeKey;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [model, treeKey]);

  const prompts = React.useMemo(() => (model ? model.rows.filter(r => r.kind === "prompt") : []), [model]);
  const fallback = prompts.findLast(r => r.onCurrentPath) ?? prompts[prompts.length - 1] ?? null;
  const selected = prompts.find(r => r.id === selectedId) ?? fallback;
  // A tip tag has no inline error slot: the bridge files a failed open as a note.
  // Stable, so the memoized rows skip the re-renders every bridge update causes.
  const openTip = React.useCallback(
    path => onOpenFile(path).catch(err => console.error("[tree] open failed:", err)),
    [onOpenFile],
  );
  const branches = model?.tips.length ?? 0;
  const compactions = model ? model.rows.length - prompts.length : 0;

  let empty = null;
  if (error) empty = error;
  else if (!model) empty = treeKey && loading ? "加载中…" : TREE_NO_FILE;
  else if (prompts.length === 0) empty = "这段对话还没有提示。";

  return (
    <aside className="tree-drawer">
      <div className="tree-head">
        <span className="tree-title">对话树</span>
        {model && (
          <span className="chip muted mono">
            {model.counts.total} 提示词
            {branches > 1 ? ` · ${branches} branches` : ""}
            {compactions > 0 ? ` · ${compactions} compactions` : ""}
          </span>
        )}
        {model && <span className="chip muted mono">{treeTtlLabel(model.ttlMs)}</span>}
      </div>
      {model && prompts.length > 0 && <TreeSummary model={model} />}
      <div className="tree-list" ref={listRef}>
        {empty && <div className="tree-empty">{empty}</div>}
        {model && model.rows.map(row => row.kind === "compaction"
          ? <_CT_Compaction key={row.id} row={row} now={now} />
          : <_CT_Row key={row.id} row={row} model={model} now={now} since={since}
              selected={selected?.id === row.id} currentFile={currentFile}
              onSelect={setSelectedId} onOpenTip={openTip} />)}
      </div>
      {model && selected && (
        <_CT_Detail key={selected.id} row={selected} tips={model.tips} now={now} since={since}
          streaming={streaming} onBranch={onBranch} onFork={onFork} onOpenFile={onOpenFile} />
      )}
    </aside>
  );
}

Object.assign(window, { ConversationTree });
