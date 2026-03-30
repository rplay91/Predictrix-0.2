(() => {
  const apiBaseRaw = window.API_BASE_URL || "";
  const apiBase = apiBaseRaw.replace(/\/+$/, "");
  const originalFetch = window.fetch.bind(window);

  const buildUrl = (url) => {
    if (typeof url !== "string") return url;
    if (!url.startsWith("/")) return url;
    if (!apiBase) return url;
    return `${apiBase}${url}`;
  };

  const withAuth = (options = {}) => {
    const token = sessionStorage.getItem("authToken");
    if (!token) return options;
    const headers = new Headers(options.headers || {});
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return { ...options, headers };
  };

  window.fetch = (url, options = {}) => {
    return originalFetch(buildUrl(url), withAuth(options));
  };
})();
