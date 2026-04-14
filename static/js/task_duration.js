(() => {
  const taskType = window.__TASK_TYPE__;
  if (!taskType) {
    return;
  }

  const getEid = () => {
    const essayDataRaw = sessionStorage.getItem("essayData");
    if (essayDataRaw) {
      try {
        const parsed = JSON.parse(essayDataRaw);
        const eid = parsed?.essay?.eid;
        if (eid !== undefined && eid !== null && eid !== "") {
          return String(eid);
        }
      } catch {
        // Ignore malformed data.
      }
    }
    const currentEid = sessionStorage.getItem("currentEid");
    if (currentEid) {
      return String(currentEid);
    }
    return "unknown";
  };

  const timerKey = `taskTimer:${taskType}:${getEid()}`;
  const loadState = () => {
    try {
      return JSON.parse(localStorage.getItem(timerKey) || "{}");
    } catch {
      return {};
    }
  };

  const saveState = (state) => {
    localStorage.setItem(timerKey, JSON.stringify(state));
  };

  const existing = loadState();
  let baseElapsed = Number(existing.elapsedSeconds || 0);
  let startTime = Date.now();
  let tickIntervalId;
  let closed = false;

  const getElapsedSeconds = () => {
    const running = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    return baseElapsed + running;
  };

  const persist = () => {
    saveState({ elapsedSeconds: getElapsedSeconds() });
  };

  const endSession = async () => {
    if (closed) return;
    closed = true;
    persist();
    if (typeof window.__AUTO_SAVE__ === "function") {
      try {
        await window.__AUTO_SAVE__();
      } catch {
        // Silent fail.
      }
    }
    clearInterval(tickIntervalId);
  };

  tickIntervalId = setInterval(persist, 5000);

  window.__TASK_TIMER__ = {
    key: timerKey,
    getElapsedSeconds,
    reset: () => {
      baseElapsed = 0;
      startTime = Date.now();
      saveState({ elapsedSeconds: 0 });
    },
  };

  window.addEventListener("pagehide", endSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      endSession();
    }
  });
})();
