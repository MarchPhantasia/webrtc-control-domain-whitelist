const assert = require("node:assert/strict");
const test = require("node:test");
const { createBackgroundController } = require("../background");

function createEventTarget() {
  const listeners = [];

  return {
    addListener(listener) {
      listeners.push(listener);
    },
    listeners
  };
}

function fakeChrome(initialStorage = {}, tabs = [{ id: 1, url: "https://other.test/" }]) {
  const localStore = { ...initialStorage };
  const policyCalls = [];
  const multipleRoutesCalls = [];
  const badgeTexts = [];
  const titles = [];
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));

  return {
    localStore,
    policyCalls,
    multipleRoutesCalls,
    badgeTexts,
    titles,
    runtime: {
      lastError: null,
      onInstalled: createEventTarget(),
      onMessage: createEventTarget()
    },
    tabs: {
      onActivated: createEventTarget(),
      onUpdated: createEventTarget(),
      query(_query, callback) {
        callback(tabs);
      },
      get(tabId, callback) {
        callback(tabById.get(tabId));
      }
    },
    action: {
      onClicked: createEventTarget(),
      setBadgeText(details, callback) {
        badgeTexts.push(details);
        if (callback) {
          callback();
        }
      },
      setBadgeBackgroundColor(_details, callback) {
        if (callback) {
          callback();
        }
      },
      setTitle(details, callback) {
        titles.push(details);
        if (callback) {
          callback();
        }
      }
    },
    storage: {
      local: {
        get(_keys, callback) {
          callback({ ...localStore });
        },
        set(values, callback) {
          Object.assign(localStore, values);
          if (callback) {
            callback();
          }
        }
      }
    },
    privacy: {
      network: {
        webRTCIPHandlingPolicy: {
          set(details, callback) {
            policyCalls.push(details);
            if (callback) {
              callback();
            }
          }
        },
        webRTCMultipleRoutesEnabled: {
          set(details, callback) {
            multipleRoutesCalls.push(details);
            if (callback) {
              callback();
            }
          }
        }
      }
    }
  };
}

test("message returns protection decision for the current URL", async () => {
  const chrome = fakeChrome({ whitelist: ["example.com"] });
  const controller = createBackgroundController(chrome);

  const whitelisted = await controller.handleMessage({
    type: "shouldProtectPage",
    url: "https://call.example.com/"
  });
  const protectedPage = await controller.handleMessage({
    type: "shouldProtectPage",
    url: "https://other.test/"
  });

  assert.equal(whitelisted.ok, true);
  assert.equal(whitelisted.protect, false);
  assert.equal(whitelisted.settings.blockSupportDetection, true);
  assert.equal(protectedPage.protect, true);
});

test("action click toggles current tab domain in the whitelist", async () => {
  const chrome = fakeChrome({ whitelist: [] });
  const controller = createBackgroundController(chrome);

  const added = await controller.handleActionClick({ id: 7, url: "https://www.example.com/room" });

  assert.equal(added.ok, true);
  assert.equal(added.whitelisted, true);
  assert.deepEqual(chrome.localStore.whitelist, ["example.com"]);
  assert.equal(chrome.policyCalls.at(-1).value, "default");
  assert.equal(chrome.badgeTexts.at(-1).text, "ALLOW");

  const removed = await controller.handleActionClick({ id: 7, url: "https://www.example.com/room" });

  assert.equal(removed.ok, true);
  assert.equal(removed.whitelisted, false);
  assert.deepEqual(chrome.localStore.whitelist, []);
  assert.equal(chrome.policyCalls.at(-1).value, "disable_non_proxied_udp");
  assert.equal(chrome.badgeTexts.at(-1).text, "ON");
});

test("policy follows whitelist and configured protection policy", async () => {
  const chrome = fakeChrome({
    ipPolicy: "default_public_interface_only",
    whitelist: ["example.com"]
  });
  const controller = createBackgroundController(chrome);

  const protectedPage = await controller.updatePolicyForUrl("https://other.test/");
  const whitelisted = await controller.updatePolicyForUrl("https://call.example.com/");

  assert.equal(protectedPage.policy, "default_public_interface_only");
  assert.equal(whitelisted.policy, "default");
  assert.deepEqual(chrome.policyCalls.map((call) => call.value), ["default_public_interface_only", "default"]);
  assert.deepEqual(chrome.multipleRoutesCalls.map((call) => call.value), [false, true]);
});

test("start wires Chrome event listeners", () => {
  const chrome = fakeChrome();
  const controller = createBackgroundController(chrome);

  controller.start();

  assert.equal(chrome.runtime.onMessage.listeners.length, 1);
  assert.equal(chrome.action.onClicked.listeners.length, 1);
  assert.equal(chrome.tabs.onActivated.listeners.length, 1);
  assert.equal(chrome.tabs.onUpdated.listeners.length, 1);
});
