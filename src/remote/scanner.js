// Phone camera QR scanner for pairing in the home-screen app.
// Exposes window.OMP_REMOTE_SCANNER = { createScanner({ onPair, installed }) }.
(function () {
  const C = window.OMP_REMOTE_CLIENT;

  function text(text) {
    return window.OMP_I18N?.translate(text) ?? text;
  }

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(label, click) {
    const element = node("button", label);
    element.type = "button";
    element.addEventListener("click", click);
    return element;
  }

  function createScanner({ onPair, installed }) {
    const scan = node("section", undefined, "scan");
    scan.setAttribute("aria-label", "用摄像头配对");
    const scanButton = button("与桌面端配对", startScan);
    const cancelScan = button("取消", () => { stopScan(); scanHint.textContent = ""; });
    cancelScan.hidden = true;
    const video = node("video");
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.hidden = true;
    const canvas = document.createElement("canvas");
    const scanHint = node("p", "", "scan-hint");
    scan.append(scanButton, cancelScan, video, scanHint);

    // Every stopScan bumps the generation; an await that resumes under an older
    // one belongs to a cancelled scan and must release what it got and stop.
    let scanStream = null, scanTimer = null, scanGen = 0;

    function stopScan() {
      scanGen++;
      if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
      if (scanStream) { for (const track of scanStream.getTracks()) track.stop(); scanStream = null; }
      video.pause(); video.srcObject = null; video.hidden = true;
      cancelScan.hidden = true;
      scanButton.hidden = scan.hidden;
    }

    document.addEventListener("visibilitychange", () => { if (document.hidden) stopScan(); });
    window.addEventListener("pagehide", stopScan);

    async function startScan() {
      if (!navigator.mediaDevices?.getUserMedia) {
        scanHint.textContent = "这台设备无法使用摄像头。";
        return;
      }
      stopScan(); // a second tap replaces the running scan instead of leaking it
      const gen = scanGen;
      scanButton.hidden = true; cancelScan.hidden = false; video.hidden = false; scanHint.textContent = "把摄像头对准配对二维码…";
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (gen !== scanGen) { for (const track of stream.getTracks()) track.stop(); return; }
        scanStream = stream;
        video.srcObject = stream;
        await video.play();
        if (gen !== scanGen) return; // stopScan already released the stream
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        scanTimer = setInterval(() => {
          if (video.readyState !== video.HAVE_ENOUGH_DATA || !window.jsQR) return;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = window.jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (!result?.data) return;
          const parsed = C.pairCodeFromScan(result.data, location.origin);
          if (parsed?.code) {
            stopScan();
            onPair(parsed.code);
          } else if (parsed?.other) {
            scanHint.textContent = "这个二维码属于另一台服务器。";
          }
        }, 125);
      } catch (err) {
        if (gen !== scanGen) return; // cancelled: not a denial
        stopScan();
        scanHint.textContent = installed()
          ? "摄像头访问被拒绝。请在 iOS 设置中允许本应用使用摄像头，然后重试。"
          : "摄像头访问被拒绝。请在浏览器设置里允许本网站使用摄像头，然后重试。";
      }
    }

    function sync(canPair) {
      scan.hidden = !canPair;
      scanButton.hidden = !canPair || !video.hidden;
      if (!canPair) { stopScan(); scanHint.textContent = ""; }
    }

    function setHint(text) {
      scanHint.textContent = text;
    }

    return { root: scan, sync, setHint };
  }

  window.OMP_REMOTE_SCANNER = { createScanner };
})();
