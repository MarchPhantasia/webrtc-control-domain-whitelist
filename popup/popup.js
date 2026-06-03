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

    const response = await send("getPopupState", {
      url: activeTab && activeTab.url
    });

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
