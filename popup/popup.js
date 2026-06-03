(function managePopup() {
  const elements = {
    badge: document.getElementById("status-badge"),
    statusText: document.getElementById("status-text"),
    domain: document.getElementById("domain"),
    toggleEnabled: document.getElementById("toggle-enabled"),
    toggleDomain: document.getElementById("toggle-domain"),
    message: document.getElementById("message"),
    openOptions: document.getElementById("open-options")
  };

  let activeTab = null;
  let currentState = null;

  function canUseChromeApi() {
    return typeof chrome !== "undefined"
      && chrome.runtime
      && chrome.tabs;
  }

  function setMessage(message, isError) {
    elements.message.textContent = message || "";
    elements.message.classList.toggle("error", Boolean(isError));
  }

  function setBusy(isBusy) {
    elements.toggleEnabled.disabled = isBusy;
    elements.toggleDomain.disabled = isBusy || !currentState || !currentState.supported;
  }

  function send(type, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, ...(payload || {}) }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        resolve(response || { ok: false, error: "后台无响应" });
      });
    });
  }

  function queryActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve((tabs || [])[0] || null);
      });
    });
  }

  function isValidIpv4(hostname) {
    const parts = hostname.split(".");

    if (parts.length !== 4) {
      return false;
    }

    return parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }

      const value = Number(part);
      return value >= 0 && value <= 255 && String(value) === part.replace(/^0+(?=\d)/, "");
    });
  }

  function isValidDomain(hostname) {
    if (hostname === "localhost") {
      return true;
    }

    if (/^\d/.test(hostname)) {
      return isValidIpv4(hostname);
    }

    const labels = hostname.split(".");

    if (labels.length < 2) {
      return false;
    }

    return labels.every((label) => (
      label.length > 0
      && label.length <= 63
      && /^[a-z0-9-]+$/.test(label)
      && !label.startsWith("-")
      && !label.endsWith("-")
    ));
  }

  function normalizeDomain(value) {
    const input = String(value || "").trim().toLowerCase();
    let hostname = null;

    if (!input) {
      return null;
    }

    try {
      const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }

      hostname = url.hostname;
    } catch (_error) {
      hostname = input
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
        .split(":")[0];
    }

    if (!hostname || hostname.includes(":")) {
      return null;
    }

    hostname = hostname.replace(/\.$/, "");

    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    return isValidDomain(hostname) ? hostname : null;
  }

  function normalizeWhitelist(whitelist) {
    const seen = new Set();
    const normalized = [];

    for (const entry of Array.isArray(whitelist) ? whitelist : []) {
      const domain = normalizeDomain(entry);

      if (domain && !seen.has(domain)) {
        seen.add(domain);
        normalized.push(domain);
      }
    }

    return normalized;
  }

  function isWhitelisted(hostname, whitelist) {
    return normalizeWhitelist(whitelist).some((entry) => (
      hostname === entry || hostname.endsWith(`.${entry}`)
    ));
  }

  function buildFallbackState(settings, url) {
    const currentSettings = settings || {};
    const hostname = normalizeDomain(url);
    const supported = Boolean(hostname);
    const whitelisted = supported ? isWhitelisted(hostname, currentSettings.whitelist) : false;
    const enabled = currentSettings.enabled !== false;

    return {
      ok: true,
      enabled,
      domain: hostname,
      supported,
      whitelisted,
      protect: Boolean(enabled && supported && !whitelisted),
      settings: currentSettings
    };
  }

  async function loadPopupState() {
    const response = await send("getPopupState", {
      url: activeTab && activeTab.url
    });

    if (response.ok || response.error !== "Unknown request") {
      return response;
    }

    const settingsResponse = await send("getSettings");

    if (!settingsResponse.ok) {
      return settingsResponse;
    }

    return buildFallbackState(settingsResponse.settings, activeTab && activeTab.url);
  }

  function render(state, pageReadable) {
    currentState = state;

    elements.badge.textContent = state.enabled ? "ON" : "OFF";
    elements.badge.classList.toggle("on", state.enabled);
    elements.badge.classList.toggle("off", !state.enabled);
    elements.statusText.textContent = state.enabled
      ? "WebRTC Control 已开启"
      : "WebRTC Control 已关闭";
    elements.toggleEnabled.textContent = state.enabled ? "关闭保护" : "开启保护";
    elements.toggleEnabled.setAttribute("aria-pressed", String(state.enabled));

    if (!pageReadable) {
      elements.domain.textContent = "无法读取当前页面";
    } else if (!state.supported) {
      elements.domain.textContent = "当前页面不支持域名规则";
    } else {
      elements.domain.textContent = state.domain;
    }

    elements.toggleDomain.disabled = !state.supported;
    elements.toggleDomain.textContent = state.whitelisted ? "移出白名单" : "加入白名单";
  }

  async function loadState(message) {
    if (!canUseChromeApi()) {
      elements.badge.textContent = "OFF";
      elements.badge.classList.add("off");
      elements.statusText.textContent = "请在 Chrome 扩展中打开";
      elements.domain.textContent = "当前页面不支持域名规则";
      elements.toggleEnabled.disabled = true;
      elements.toggleDomain.disabled = true;
      setMessage("此页面需要作为 Chrome 扩展运行", true);
      return;
    }

    setBusy(true);
    activeTab = await queryActiveTab();

    const response = await loadPopupState();

    if (!response.ok) {
      setMessage(response.error || "无法读取当前状态", true);
      setBusy(false);
      return;
    }

    render(response, Boolean(activeTab && activeTab.url));
    setMessage(message || "");
    setBusy(false);
  }

  async function toggleEnabled() {
    if (!currentState) {
      return;
    }

    setBusy(true);
    const response = await send("updateSettings", {
      settings: { enabled: !currentState.enabled }
    });

    if (!response.ok) {
      setMessage(response.error || "无法更新保护开关", true);
      setBusy(false);
      return;
    }

    await loadState(response.settings.enabled ? "保护已开启" : "保护已关闭");
  }

  async function toggleDomain() {
    if (!currentState || !currentState.supported) {
      return;
    }

    setBusy(true);
    const type = currentState.whitelisted ? "removeDomain" : "addDomain";
    const response = await send(type, { domain: currentState.domain });

    if (!response.ok) {
      setMessage(response.error || "无法更新白名单", true);
      setBusy(false);
      return;
    }

    await loadState(currentState.whitelisted ? "已移出白名单" : "已加入白名单");
  }

  elements.toggleEnabled.addEventListener("click", toggleEnabled);
  elements.toggleDomain.addEventListener("click", toggleDomain);
  elements.openOptions.addEventListener("click", () => {
    if (canUseChromeApi() && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  loadState();
})();
