(function manageOptionsPage() {
  const elements = {
    status: document.getElementById("status"),
    enabled: document.getElementById("enabled"),
    ipPolicy: document.getElementById("ip-policy"),
    blockSupportDetection: document.getElementById("block-support-detection"),
    blockMediaDevices: document.getElementById("block-media-devices"),
    blockAdditionalObjects: document.getElementById("block-additional-objects"),
    form: document.getElementById("whitelist-form"),
    input: document.getElementById("domain-input"),
    whitelist: document.getElementById("whitelist")
  };

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

        resolve(response || { ok: false, error: "No response" });
      });
    });
  }

  function setStatus(message, isError) {
    elements.status.textContent = message || "";
    elements.status.classList.toggle("error", Boolean(isError));
  }

  function renderWhitelist(whitelist) {
    elements.whitelist.textContent = "";

    if (!whitelist.length) {
      const empty = document.createElement("li");
      empty.textContent = "No domains added";
      elements.whitelist.appendChild(empty);
      return;
    }

    for (const domain of whitelist) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const remove = document.createElement("button");

      label.textContent = domain;
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        const response = await send("removeDomain", { domain });

        if (!response.ok) {
          setStatus(response.error || "Could not remove domain", true);
          return;
        }

        render(response.settings);
        setStatus(`${domain} removed`);
      });

      item.append(label, remove);
      elements.whitelist.appendChild(item);
    }
  }

  function render(settings) {
    elements.enabled.checked = settings.enabled;
    elements.ipPolicy.value = settings.ipPolicy;
    elements.blockSupportDetection.checked = settings.blockSupportDetection;
    elements.blockMediaDevices.checked = settings.blockMediaDevices;
    elements.blockAdditionalObjects.checked = settings.blockAdditionalObjects;
    renderWhitelist(settings.whitelist);
  }

  function collectSettingsPatch() {
    return {
      enabled: elements.enabled.checked,
      ipPolicy: elements.ipPolicy.value,
      blockSupportDetection: elements.blockSupportDetection.checked,
      blockMediaDevices: elements.blockMediaDevices.checked,
      blockAdditionalObjects: elements.blockAdditionalObjects.checked
    };
  }

  async function saveSettings() {
    const response = await send("updateSettings", {
      settings: collectSettingsPatch()
    });

    if (!response.ok) {
      setStatus(response.error || "Could not save settings", true);
      return;
    }

    render(response.settings);
    setStatus("Settings saved");
  }

  async function loadSettings() {
    const response = await send("getSettings");

    if (!response.ok) {
      setStatus(response.error || "Could not load settings", true);
      return;
    }

    render(response.settings);
  }

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const domain = elements.input.value.trim();
    const response = await send("addDomain", { domain });

    if (!response.ok) {
      setStatus(response.error || "Could not add domain", true);
      return;
    }

    elements.input.value = "";
    render(response.settings);
    setStatus(`${response.settings.whitelist.at(-1)} added`);
  });

  for (const control of [
    elements.enabled,
    elements.ipPolicy,
    elements.blockSupportDetection,
    elements.blockMediaDevices,
    elements.blockAdditionalObjects
  ]) {
    control.addEventListener("change", saveSettings);
  }

  loadSettings();
})();
