/* git/file-tree.jsx — the git browser's files pane: Rust's tree with git
   status marks, a changed-only filter and a name filter. While a commit is
   browsed the tree is the files it touched: changed-only is forced on, its
   toggle hidden and the head names the commit. Changed-only shows every
   directory open, so a directory row is inert there (the shared expansion
   set is the full tree's). Row logic is app/git-browser.js
   (OMP_GIT_BROWSER). */

const { Icon: _GT_Icon } = window;
const { flatten: _GT_flatten, filterFiles: _GT_filterFiles } = window.OMP_GIT_BROWSER;

const GIT_STATUS_META = {
  Modified:  { label: "M", color: "var(--amber)",  title: "已修改" },
  Added:     { label: "A", color: "var(--accent)", title: "新增" },
  Deleted:   { label: "D", color: "var(--rose)",   title: "删除" },
  Renamed:   { label: "R", color: "var(--cyan)",   title: "重命名" },
  Untracked: { label: "U", color: "var(--fg-3)",   title: "未跟踪" },
};

function GitFileTree({
  root, error, expanded, onToggle, selected, onSelect, changedOnly, onChangedOnly,
  filter, onFilter, changedCount, commit, truncated,
}) {
  const rows = React.useMemo(() => {
    // A name filter lists matching files flat: the tree would need every
    // ancestor expanded to show them, and the match is on the whole path.
    if (filter.trim()) return _GT_filterFiles(root, filter, changedOnly).map(node => ({ node, depth: 0, flat: true }));
    return _GT_flatten(root, expanded, changedOnly);
  }, [root, expanded, changedOnly, filter]);

  let empty = null;
  if (error) empty = error;
  // A failed status replaces the whole browser, so no root and no error
  // means still loading.
  else if (!root) empty = "加载中…";
  else if (rows.length === 0) empty = filter.trim() ? "没有匹配项" : changedOnly && !commit ? "没有改动" : "没有文件";

  return (
    <div className="gitb-pane gitb-files">
      <div className="gitb-pane-head">
        <span className="gitb-pane-title">文件</span>
        {commit && (
          <span className="gitb-pane-sub mono" title={commit.id}>{commit.short} · {commit.files} 文件{commit.files === 1 ? "" : "s"}</span>
        )}
        {onChangedOnly && (
          <button type="button" className={`btn ghost gitb-toggle ${changedOnly ? "on" : ""}`}
            onClick={() => onChangedOnly(!changedOnly)} title={changedOnly ? "显示所有文件" : "只显示改动的文件"}
            aria-pressed={changedOnly}>
            <_GT_Icon name="diff2" size={11} />
            <span>{changedCount} 修改</span>
          </button>
        )}
      </div>
      <div className="gitb-filter">
        <_GT_Icon name="search" size={11} color="var(--fg-4)" />
        <input className="gitb-filter-input mono" value={filter} onChange={e => onFilter(e.target.value)}
          placeholder="筛选文件" spellCheck={false} />
        {filter && <button type="button" className="btn ghost icon" onClick={() => onFilter("")} aria-label="清除筛选"><_GT_Icon name="close" size={10} /></button>}
      </div>
      <div className="gitb-tree" role="tree">
        {empty && <div className={`gitb-empty ${error ? "gitb-error" : ""}`}>{empty}</div>}
        {!error && rows.map(({ node, depth, flat }) => {
          const meta = node.status ? GIT_STATUS_META[node.status] : null;
          const active = !node.dir && node.path === selected;
          // A file and a dir can share a path ("x" deleted, "x/a" added).
          return (
            <div key={`${node.dir ? "d" : "f"}:${node.path}`} role="treeitem" aria-selected={active}
              aria-expanded={node.dir ? changedOnly || expanded.has(node.path) : undefined}
              className={`gitb-row ${node.dir ? "dir" : "file"} ${node.dir && changedOnly ? "inert" : ""} ${active ? "active" : ""} ${node.status === "Deleted" ? "deleted" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                if (!node.dir) onSelect(node.path);
                else if (!changedOnly) onToggle(node.path);
              }}>
              {node.dir
                ? <_GT_Icon name={changedOnly || expanded.has(node.path) ? "chev" : "chevR"} size={11} color="var(--fg-4)" />
                : <span className="gitb-row-pad" />}
              <span className="gitb-row-name" style={meta ? { color: meta.color } : undefined}>
                {flat ? node.path : node.name}
              </span>
              {node.dir && node.changed > 0 && !changedOnly && <span className="gitb-dot" title={`${node.changed} changed`} />}
              {meta && <span className="gitb-mark mono" style={{ color: meta.color }} title={meta.title}>{meta.label}</span>}
            </div>
          );
        })}
        {!error && root && truncated && <div className="gitb-empty">列表已截断——文件太多无法全部显示</div>}
      </div>
    </div>
  );
}

window.GitFileTree = GitFileTree;
window.GIT_STATUS_META = GIT_STATUS_META;
