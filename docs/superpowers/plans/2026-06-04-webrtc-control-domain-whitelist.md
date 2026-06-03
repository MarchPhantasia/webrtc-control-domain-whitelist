# WebRTC Control Domain Whitelist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 WebRTC control extension with domain whitelist support.

**Architecture:** Put domain and settings behavior in CommonJS-compatible helper modules that also attach to `globalThis` for extension service workers. Keep `background.js` as a thin controller over Chrome APIs. Let the content script ask the background controller whether the current page should be protected before injecting page-context blockers.

**Tech Stack:** Manifest V3, plain JavaScript, Chrome extension APIs, Node built-in test runner.

---

## File Structure

- Create `package.json`: test command only.
- Create `src/domain.js`: domain normalization, URL hostname extraction, whitelist matching, protection decision.
- Create `src/settings.js`: defaults, settings merge, whitelist add/remove, policy validation.
- Create `tests/domain.test.js`: domain and URL protection tests.
- Create `tests/settings.test.js`: settings and whitelist mutation tests.
- Create `tests/background.test.js`: fake Chrome tests for controller behavior.
- Create `manifest.json`: MV3 extension definition.
- Create `background.js`: service worker controller, action toggle, message handling, active-tab policy updates.
- Create `content/inject.js`: content script that conditionally injects blockers.
- Create `content/page/support_detection.js`: page-context WebRTC object blocker.
- Create `content/page/media_devices.js`: page-context media devices blocker.
- Create `content/page/additional_objects.js`: page-context additional WebRTC object blocker.
- Create `options/options.html`, `options/options.css`, `options/options.js`: options UI for whitelist and settings.
- Create `README.md`: install and behavior notes.

## Task 1: Domain Helper

**Files:**
- Create: `package.json`
- Create: `tests/domain.test.js`
- Create: `src/domain.js`

- [ ] **Step 1: Write the failing test**

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const domain = require("../src/domain");

test("normalizes domain entries", () => {
  assert.equal(domain.normalizeDomain("https://www.Example.com:8443/room?q=1"), "example.com");
  assert.equal(domain.normalizeDomain(" example.com. "), "example.com");
  assert.equal(domain.normalizeDomain("localhost"), "localhost");
  assert.equal(domain.normalizeDomain("256.1.1.1"), null);
});

test("matches exact and subdomain whitelist entries", () => {
  const whitelist = ["example.com"];
  assert.equal(domain.isDomainWhitelisted("example.com", whitelist), true);
  assert.equal(domain.isDomainWhitelisted("www.example.com", whitelist), true);
  assert.equal(domain.isDomainWhitelisted("call.example.com", whitelist), true);
  assert.equal(domain.isDomainWhitelisted("badexample.com", whitelist), false);
});

test("decides whether a URL should be protected", () => {
  const settings = { enabled: true, whitelist: ["example.com"] };
  assert.equal(domain.shouldProtectUrl("https://meet.example.com/room", settings), false);
  assert.equal(domain.shouldProtectUrl("https://other.test/room", settings), true);
  assert.equal(domain.shouldProtectUrl("chrome://extensions", settings), false);
  assert.equal(domain.shouldProtectUrl("https://other.test/room", { enabled: false, whitelist: [] }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`

Expected: FAIL because `../src/domain` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `src/domain.js` with `normalizeDomain`, `hostnameFromUrl`, `normalizeWhitelist`, `isDomainWhitelisted`, and `shouldProtectUrl`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`

Expected: PASS for `tests/domain.test.js`.

- [ ] **Step 5: Commit**

Run: `git add package.json src/domain.js tests/domain.test.js`

Run: `git commit -m "feat: add domain whitelist helpers"`

## Task 2: Settings Helper

**Files:**
- Create: `tests/settings.test.js`
- Create: `src/settings.js`

- [ ] **Step 1: Write the failing test**

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const settings = require("../src/settings");

test("merges stored values with defaults", () => {
  const merged = settings.mergeSettings({ whitelist: ["Example.com"], ipPolicy: "invalid" });
  assert.equal(merged.enabled, true);
  assert.equal(merged.ipPolicy, "disable_non_proxied_udp");
  assert.deepEqual(merged.whitelist, ["example.com"]);
});

test("adds and removes normalized whitelist domains", () => {
  const first = settings.addWhitelistDomain(settings.DEFAULT_SETTINGS, "https://www.Example.com/room");
  assert.deepEqual(first.whitelist, ["example.com"]);
  const second = settings.addWhitelistDomain(first, "call.example.com");
  assert.deepEqual(second.whitelist, ["example.com", "call.example.com"]);
  const third = settings.removeWhitelistDomain(second, "www.example.com");
  assert.deepEqual(third.whitelist, ["call.example.com"]);
});

test("rejects invalid whitelist domains", () => {
  assert.throws(() => settings.addWhitelistDomain(settings.DEFAULT_SETTINGS, "chrome://extensions"), /Invalid domain/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`

Expected: FAIL because `../src/settings` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `DEFAULT_SETTINGS`, `mergeSettings`, `addWhitelistDomain`, `removeWhitelistDomain`, and policy validation in `src/settings.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`

Expected: PASS for domain and settings tests.

- [ ] **Step 5: Commit**

Run: `git add src/settings.js tests/settings.test.js`

Run: `git commit -m "feat: add extension settings helpers"`

## Task 3: Background Controller

**Files:**
- Create: `tests/background.test.js`
- Create: `background.js`

- [ ] **Step 1: Write the failing test**

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const { createBackgroundController } = require("../background");

function fakeChrome(initialStorage = {}) {
  const localStore = { ...initialStorage };
  const policyCalls = [];
  return {
    localStore,
    policyCalls,
    runtime: {
      onMessage: { addListener() {} }
    },
    tabs: {
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      query(_query, callback) { callback([{ id: 1, url: "https://other.test/" }]); },
      get(_tabId, callback) { callback({ id: 1, url: "https://other.test/" }); }
    },
    action: {
      onClicked: { addListener() {} },
      setBadgeText(_details, callback) { if (callback) callback(); },
      setBadgeBackgroundColor(_details, callback) { if (callback) callback(); },
      setTitle(_details, callback) { if (callback) callback(); }
    },
    storage: {
      local: {
        get(_keys, callback) { callback({ ...localStore }); },
        set(values, callback) { Object.assign(localStore, values); if (callback) callback(); }
      }
    },
    privacy: {
      network: {
        webRTCIPHandlingPolicy: {
          set(details, callback) { policyCalls.push(details.value); if (callback) callback(); }
        }
      }
    }
  };
}

test("message returns protection decision for the current URL", async () => {
  const chrome = fakeChrome({ whitelist: ["example.com"] });
  const controller = createBackgroundController(chrome);
  const response = await controller.handleMessage({ type: "shouldProtectPage", url: "https://call.example.com/" });
  assert.equal(response.protect, false);
});

test("action click toggles current tab domain in the whitelist", async () => {
  const chrome = fakeChrome({ whitelist: [] });
  const controller = createBackgroundController(chrome);
  await controller.handleActionClick({ id: 7, url: "https://www.example.com/room" });
  assert.deepEqual(chrome.localStore.whitelist, ["example.com"]);
  assert.equal(chrome.policyCalls.at(-1), "default");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`

Expected: FAIL because `../background` does not export `createBackgroundController`.

- [ ] **Step 3: Write minimal implementation**

Implement `createBackgroundController(chromeApi)` with async `getSettings`, `saveSettings`, `handleMessage`, `handleActionClick`, `updatePolicyForUrl`, `updateActionForUrl`, and `start`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`

Expected: PASS for domain, settings, and background tests.

- [ ] **Step 5: Commit**

Run: `git add background.js tests/background.test.js`

Run: `git commit -m "feat: add background whitelist controller"`

## Task 4: Extension Files and UI

**Files:**
- Create: `manifest.json`
- Create: `content/inject.js`
- Create: `content/page/support_detection.js`
- Create: `content/page/media_devices.js`
- Create: `content/page/additional_objects.js`
- Create: `options/options.html`
- Create: `options/options.css`
- Create: `options/options.js`
- Create: `README.md`

- [ ] **Step 1: Write static validation test**

Add manifest and UI assertions to `tests/extension-files.test.js`: manifest version is 3, required permissions exist, content script runs at `document_start`, page blocker scripts are web accessible, and options page is configured.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`

Expected: FAIL because `manifest.json` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add the extension manifest, conditional injector, page-context blocker scripts, options UI, and README.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`

Expected: PASS for all tests.

- [ ] **Step 5: Commit**

Run: `git add manifest.json content options README.md tests/extension-files.test.js`

Run: `git commit -m "feat: add browser extension UI and manifest"`

## Task 5: Final Verification

**Files:**
- Modify: no new files unless verification exposes a defect.

- [ ] **Step 1: Run all automated tests**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 2: Inspect git status**

Run: `git status --short`

Expected: clean working tree.
