(function attachBackgroundController(root) {
  const domain = root.webrtcDomain || require("./domain");
  const settingsHelpers = root.webrtcSettings || require("./settings");

  function createBackgroundController(chromeApi) {
    function callbackToPromise(fn) {
      return new Promise((resolve) => {
        fn(resolve);
      });
    }

    async function getSettings() {
      const stored = await callbackToPromise((resolve) => {
        chromeApi.storage.local.get(null, (values) => {
          resolve(values || {});
        });
      });

      return settingsHelpers.mergeSettings(stored);
    }

    async function saveSettings(nextSettings) {
      const merged = settingsHelpers.mergeSettings(nextSettings);

      await callbackToPromise((resolve) => {
        chromeApi.storage.local.set(merged, () => {
          resolve();
        });
      });

      return merged;
    }

    async function setWebRtcPolicy(policy) {
      const network = chromeApi.privacy && chromeApi.privacy.network;

      if (!network) {
        return;
      }

      if (network.webRTCIPHandlingPolicy) {
        await callbackToPromise((resolve) => {
          network.webRTCIPHandlingPolicy.set({ value: policy }, () => {
            resolve();
          });
        });
      }

      if (network.webRTCMultipleRoutesEnabled) {
        await callbackToPromise((resolve) => {
          network.webRTCMultipleRoutesEnabled.set({ value: policy === "default" }, () => {
            resolve();
          });
        });
      }
    }

    function actionStateForUrl(url, currentSettings) {
      if (!currentSettings.enabled) {
        return {
          badge: "OFF",
          color: "#c5221f",
          title: "WebRTC 泄漏保护已关闭"
        };
      }

      if (domain.shouldProtectUrl(url, currentSettings)) {
        return {
          badge: "ON",
          color: "#17823b",
          title: "WebRTC 泄漏保护已开启"
        };
      }

      return {
        badge: "OFF",
        color: "#c5221f",
        title: "当前域名在白名单中，WebRTC 已允许"
      };
    }

    async function updateActionForUrl(tabId, url) {
      const currentSettings = await getSettings();
      const state = actionStateForUrl(url, currentSettings);
      const details = tabId === undefined || tabId === null ? {} : { tabId };

      if (chromeApi.action.setBadgeText) {
        await callbackToPromise((resolve) => {
          chromeApi.action.setBadgeText({ ...details, text: state.badge }, () => {
            resolve();
          });
        });
      }

      if (chromeApi.action.setBadgeBackgroundColor) {
        await callbackToPromise((resolve) => {
          chromeApi.action.setBadgeBackgroundColor({ ...details, color: state.color }, () => {
            resolve();
          });
        });
      }

      if (chromeApi.action.setTitle) {
        await callbackToPromise((resolve) => {
          chromeApi.action.setTitle({ ...details, title: state.title }, () => {
            resolve();
          });
        });
      }

      return state;
    }

    async function updatePolicyForUrl(url) {
      const currentSettings = await getSettings();
      const protect = domain.shouldProtectUrl(url, currentSettings);
      const policy = protect ? currentSettings.ipPolicy : "default";

      await setWebRtcPolicy(policy);

      return {
        policy,
        protect,
        settings: currentSettings
      };
    }

    async function getPopupState(url) {
      const currentSettings = await getSettings();
      const normalizedDomain = domain.hostnameFromUrl(url);
      const supported = Boolean(normalizedDomain);
      const whitelisted = supported
        ? domain.isDomainWhitelisted(normalizedDomain, currentSettings.whitelist)
        : false;

      return {
        ok: true,
        enabled: currentSettings.enabled,
        domain: normalizedDomain,
        supported,
        whitelisted,
        protect: supported ? domain.shouldProtectUrl(normalizedDomain, currentSettings) : false,
        settings: currentSettings
      };
    }

    function findMatchingWhitelistEntry(hostnameOrUrl, whitelist) {
      const hostname = domain.normalizeDomain(hostnameOrUrl);

      if (!hostname) {
        return null;
      }

      const matches = domain.normalizeWhitelist(whitelist).filter((entry) => (
        hostname === entry || hostname.endsWith(`.${entry}`)
      ));

      matches.sort((left, right) => right.length - left.length);
      return matches[0] || null;
    }

    async function updateActiveTabPolicy() {
      const tabs = await callbackToPromise((resolve) => {
        chromeApi.tabs.query({ active: true, currentWindow: true }, (result) => {
          resolve(result || []);
        });
      });
      const activeTab = tabs[0];

      if (!activeTab || !activeTab.url) {
        return null;
      }

      await updatePolicyForUrl(activeTab.url);
      await updateActionForUrl(activeTab.id, activeTab.url);

      return activeTab;
    }

    async function handleActionClick(tab) {
      const hostname = domain.hostnameFromUrl(tab && tab.url);

      if (!hostname) {
        return {
          ok: false,
          error: "Unsupported URL"
        };
      }

      const currentSettings = await getSettings();
      const matchedWhitelistEntry = findMatchingWhitelistEntry(hostname, currentSettings.whitelist);
      const wasWhitelisted = Boolean(matchedWhitelistEntry);
      const nextSettings = wasWhitelisted
        ? settingsHelpers.removeWhitelistDomain(currentSettings, matchedWhitelistEntry)
        : settingsHelpers.addWhitelistDomain(currentSettings, hostname);

      await saveSettings(nextSettings);
      await updatePolicyForUrl(tab.url);
      await updateActionForUrl(tab.id, tab.url);

      return {
        ok: true,
        whitelisted: !wasWhitelisted,
        settings: nextSettings
      };
    }

    async function updateSettingsFromMessage(patch) {
      const currentSettings = await getSettings();
      const nextSettings = settingsHelpers.updateSettings(currentSettings, patch);

      await saveSettings(nextSettings);
      await updateActiveTabPolicy();

      return {
        ok: true,
        settings: nextSettings
      };
    }

    async function addDomainFromMessage(input) {
      const normalizedDomain = domain.normalizeDomain(input);

      if (!normalizedDomain) {
        throw new Error("Invalid domain");
      }

      const currentSettings = await getSettings();
      const changed = !currentSettings.whitelist.includes(normalizedDomain);

      if (!changed) {
        return {
          ok: true,
          changed: false,
          domain: normalizedDomain,
          settings: currentSettings
        };
      }

      const nextSettings = settingsHelpers.addWhitelistDomain(currentSettings, normalizedDomain);

      await saveSettings(nextSettings);
      await updateActiveTabPolicy();

      return {
        ok: true,
        changed,
        domain: normalizedDomain,
        settings: nextSettings
      };
    }

    async function removeDomainFromMessage(input) {
      const currentSettings = await getSettings();
      const normalizedDomain = domain.normalizeDomain(input);
      const matchedWhitelistEntry = findMatchingWhitelistEntry(normalizedDomain, currentSettings.whitelist);
      const changed = Boolean(matchedWhitelistEntry);
      const nextSettings = changed
        ? settingsHelpers.removeWhitelistDomain(currentSettings, matchedWhitelistEntry)
        : currentSettings;

      await saveSettings(nextSettings);
      await updateActiveTabPolicy();

      return {
        ok: true,
        changed,
        domain: normalizedDomain,
        settings: nextSettings
      };
    }

    async function handleMessage(request) {
      if (!request || !request.type) {
        return {
          ok: false,
          error: "Unknown request"
        };
      }

      try {
        if (request.type === "getSettings") {
          return {
            ok: true,
            settings: await getSettings()
          };
        }

        if (request.type === "shouldProtectPage") {
          const currentSettings = await getSettings();

          return {
            ok: true,
            protect: domain.shouldProtectUrl(request.url, currentSettings),
            settings: currentSettings
          };
        }

        if (request.type === "getPopupState") {
          return getPopupState(request.url);
        }

        if (request.type === "addDomain") {
          return addDomainFromMessage(request.domain);
        }

        if (request.type === "removeDomain") {
          return removeDomainFromMessage(request.domain);
        }

        if (request.type === "updateSettings") {
          return updateSettingsFromMessage(request.settings || {});
        }
      } catch (error) {
        return {
          ok: false,
          error: error.message
        };
      }

      return {
        ok: false,
        error: "Unknown request"
      };
    }

    function start() {
      chromeApi.action.onClicked.addListener((tab) => {
        handleActionClick(tab);
      });

      chromeApi.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        handleMessage(request).then(sendResponse);
        return true;
      });

      chromeApi.tabs.onActivated.addListener((activeInfo) => {
        chromeApi.tabs.get(activeInfo.tabId, (tab) => {
          if (tab && tab.url) {
            updatePolicyForUrl(tab.url);
            updateActionForUrl(tab.id, tab.url);
          }
        });
      });

      chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        const url = changeInfo.url || (tab && tab.url);

        if (url) {
          if (tab && tab.active) {
            updatePolicyForUrl(url);
          }

          updateActionForUrl(tabId, url);
        }
      });

      if (chromeApi.runtime.onInstalled) {
        chromeApi.runtime.onInstalled.addListener(() => {
          updateActiveTabPolicy();
        });
      }

      updateActiveTabPolicy();
    }

    return {
      getPopupState,
      getSettings,
      handleActionClick,
      handleMessage,
      saveSettings,
      start,
      updateActionForUrl,
      updateActiveTabPolicy,
      updatePolicyForUrl
    };
  }

  const api = { createBackgroundController };

  root.webrtcBackground = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
