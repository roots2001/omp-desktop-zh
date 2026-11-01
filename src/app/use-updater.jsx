/* app/use-updater.jsx — drives the in-app updater (issue #19): the
   app/updater.js reducer, update progress, and whether the update modal is
   open. This fork has no in-app feed, so the status-bar version label,
   `/check-updates` and the keymap open the releases page directly. The
   reducer and install path stay in place for a fork that later configures
   its own signed feed (docs/zh-branch.md). */

// Frozen and loaded before this file (index.html), so safe to read once.
const UPDATER = window.OMP_UPDATER;

function useUpdater({ bridge, autoCheck, skipped, setTweak }) {
  const [state, dispatch] = React.useReducer(UPDATER.reduce, undefined, UPDATER.initialState);
  const [open, setOpen] = React.useState(false);
  const [version, setVersion] = React.useState(null);

  // Read by the stable callbacks below, so the timer effect never has to
  // re-arm (and restart its startup delay) on every state change.
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    bridge?.appVersion().then(setVersion);
  }, [bridge]);

  // Gates the IPC call itself rather than relying on the reducer to drop
  // the transition. A check already running feeds a modal from an earlier
  // build; one during an install would race it.
  const runCheck = React.useCallback(async () => {
    if (!bridge || UPDATER.isBusy(stateRef.current)) return;
    dispatch({ type: "check-start" });
    const res = await bridge.checkForUpdate();
    dispatch(res.ok
      ? { type: "check-done", info: res.value }
      : { type: "check-failed", error: res.error });
  }, [bridge]);

  const openRelease = React.useCallback(async () => {
    // No feed means there is no update object; the release index is still
    // the manual upgrade path, so never fall through without an action.
    const url = stateRef.current.update?.releaseUrl ?? UPDATER.RELEASES_URL;
    if (!url || !bridge) return;
    const res = await bridge.openExternalUrl(url);
    if (!res.ok) console.error("[updater] opening the release page failed:", res.error);
  }, [bridge]);

  // The public entry point takes no argument, so it can be handed straight
  // to onClick / a keymap handler. Without an in-app feed it opens the
  // releases page instead of pretending a check is possible.
  const check = React.useCallback(() => {
    if (UPDATER.IN_APP_UPDATES) {
      setOpen(true);
      runCheck();
    } else {
      openRelease();
    }
  }, [openRelease, runCheck]);

  React.useEffect(() => {
    if (!UPDATER.IN_APP_UPDATES || !autoCheck || !bridge) return undefined;
    const first = setTimeout(runCheck, UPDATER.STARTUP_DELAY_MS);
    const every = setInterval(runCheck, UPDATER.CHECK_INTERVAL_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [autoCheck, bridge, runCheck]);

  const install = React.useCallback(async () => {
    if (!bridge || !UPDATER.canStartInstall(stateRef.current)) return;
    dispatch({ type: "install-start" });
    const res = await bridge.installUpdate(p =>
      dispatch({ type: "progress", downloaded: p?.downloaded, total: p?.total }));
    dispatch(res.ok ? { type: "install-done" } : { type: "install-failed", error: res.error });
  }, [bridge]);

  const skip = React.useCallback(() => {
    const v = stateRef.current.update?.version;
    if (v) setTweak("skippedUpdate", v);
    setOpen(false);
  }, [setTweak]);

  // Settings → Session → Version: forget the skipped release, so the pill
  // offers it again.
  const clearSkipped = React.useCallback(() => setTweak("skippedUpdate", null), [setTweak]);

  return {
    state,
    version,
    open,
    pillVersion: UPDATER.pillVersion(state, skipped),
    openModal: React.useCallback(() => setOpen(true), []),
    close: React.useCallback(() => setOpen(false), []),
    check,
    install,
    skip,
    clearSkipped,
    openRelease,
  };
}

Object.assign(window, { useUpdater });
