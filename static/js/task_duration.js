(() => {
  const taskType = window.__TASK_TYPE__;
  if (!taskType) {
    return;
  }

  const sid = sessionStorage.getItem("sid");
  if (!sid) {
    return;
  }

  const getEid = () => {
    const essayDataRaw = sessionStorage.getItem("essayData");
    if (essayDataRaw) {
      try {
        const parsed = JSON.parse(essayDataRaw);
        const eid = parsed?.essay?.eid;
        if (eid !== undefined && eid !== null && eid !== "") {
          return Number(eid);
        }
      } catch {
        // Ignore malformed data.
      }
    }
    const currentEid = sessionStorage.getItem("currentEid");
    if (currentEid) {
      return Number(currentEid);
    }
    return null;
  };

  const sessionKey = `taskSessionId:${taskType}`;
  let sessionId = sessionStorage.getItem(sessionKey);
  let closed = false;

  const startSession = async () => {
    try {
      const response = await fetch("/track_task_session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sid,
          eid: getEid(),
          task_type: taskType,
          page_url: window.location.pathname,
          user_agent: navigator.userAgent,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.session_id) {
        sessionId = String(data.session_id);
        sessionStorage.setItem(sessionKey, sessionId);
      }
    } catch {
      // Silent fail.
    }
  };

  const endSession = () => {
    if (closed) return;
    closed = true;
    if (!sessionId) return;

    const payload = JSON.stringify({ session_id: Number(sessionId) });
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/track_task_session/end", blob);
    sessionStorage.removeItem(sessionKey);
  };

  startSession();

  window.addEventListener("pagehide", endSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      endSession();
    }
  });
})();
