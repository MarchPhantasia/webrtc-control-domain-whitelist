# Popup Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chinese popup control panel for global WebRTC Control ON/OFF, current-domain whitelist management, and opening the options page.

**Architecture:** Keep all settings and domain decisions in the existing background controller. The popup queries a new `getPopupState` message and reuses `updateSettings`, `addDomain`, and `removeDomain` for mutations. Static extension-file tests cover the Manifest V3 popup wiring and popup UI assets.

**Tech Stack:** Manifest V3 Chrome extension, plain HTML/CSS/JavaScript, Node `node:test`, existing CommonJS-compatible helpers.

---

### Task 1: Background Popup State API

**Files:**
- Modify: `tests/background.test.js`
- Modify: `src/background-controller.js`

- [ ] **Step 1: Write failing tests for popup state**

Add tests that call `handleMessage({ type: "getPopupState", url })` and verify supported, whitelisted, and unsupported URLs:

```js
test("popup state describes the current protected page", async () => {
  const chrome = fakeChrome({
    enabled: true,
    whitelist: ["example.com"]
  });
  const controller = createBackgroundController(chrome);

  const state = await controller.handleMessage({
    type: "getPopupState",
    url: "https://meet.other.test/room"
  });

  assert.equal(state.ok, true);
  assert.equal(state.enabled, true);
  assert.equal(state.domain, "meet.other.test");
  assert.equal(state.supported, true);
  assert.equal(state.whitelisted, false);
  assert.equal(state.protect, true);
  assert.equal(state.settings.enabled, true);
});

test("popup state marks whitelisted pages as allowed", async () => {
  const chrome = fakeChrome({
    enabled: true,
    whitelist: ["example.com"]
  });
  const controller = createBackgroundController(chrome);

  const state = await controller.handleMessage({
    type: "getPopupState",
    url: "https://call.example.com/"
  });

  assert.equal(state.ok, true);
  assert.equal(state.domain, "call.example.com");
  assert.equal(state.supported, true);
  assert.equal(state.whitelisted, true);
  assert.equal(state.protect, false);
});

test("popup state handles unsupported URLs", async () => {
  const chrome = fakeChrome();
  const controller = createBackgroundController(chrome);

  const state = await controller.handleMessage({
    type: "getPopupState",
    url: "chrome://extensions"
  });

  assert.equal(state.ok, true);
  assert.equal(state.domain, null);
  assert.equal(state.supported, false);
  assert.equal(state.whitelisted, false);
  assert.equal(state.protect, false);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test`

Expected: failures because `getPopupState` currently returns `Unknown request`.

- [ ] **Step 3: Implement `getPopupState`**

In `src/background-controller.js`, add a helper that returns:

```js
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
```

Register it in `handleMessage`:

```js
if (request.type === "getPopupState") {
  return getPopupState(request.url);
}
```

Expose `getPopupState` from the returned controller object for direct future tests.

- [ ] **Step 4: Run tests and verify green**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```text
git add tests/background.test.js src/background-controller.js
git commit -m "feat: add popup state API"
```

### Task 2: Manifest and Popup Static Assets

**Files:**
- Modify: `tests/extension-files.test.js`
- Modify: `manifest.json`
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

- [ ] **Step 1: Write failing manifest and popup file tests**

Extend `tests/extension-files.test.js`:

```js
assert.equal(manifest.action.default_popup, "popup/popup.html");
```

Read popup files and assert Chinese UI and message hooks:

```js
const popupHtml = readText("popup/popup.html");
const popupJs = readText("popup/popup.js");

assert.match(popupHtml, /WebRTC Control/);
assert.match(popupHtml, /当前页面/);
assert.match(popupHtml, /打开选项页面/);
assert.match(popupJs, /getPopupState/);
assert.match(popupJs, /updateSettings/);
assert.match(popupJs, /addDomain/);
assert.match(popupJs, /removeDomain/);
assert.match(popupJs, /openOptionsPage/);
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test`

Expected: failures because manifest has no `default_popup` and `popup/*` files do not exist.

- [ ] **Step 3: Add popup manifest wiring**

Update `manifest.json` action:

```json
"action": {
  "default_title": "WebRTC Control",
  "default_popup": "popup/popup.html"
}
```

- [ ] **Step 4: Add popup files**

Create `popup/popup.html` with semantic controls:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WebRTC Control</title>
    <link rel="stylesheet" href="popup.css">
  </head>
  <body>
    <main class="popup-shell">
      <header class="status-card">
        <span id="status-badge" class="status-badge">...</span>
        <div>
          <h1>WebRTC Control</h1>
          <p id="status-text">正在读取当前页面</p>
        </div>
      </header>

      <section class="panel">
        <p class="label">当前页面</p>
        <p id="domain" class="domain">读取中</p>
      </section>

      <section class="actions">
        <button id="toggle-enabled" type="button">关闭保护</button>
        <button id="toggle-domain" type="button" class="secondary">加入白名单</button>
      </section>

      <p id="message" role="status" aria-live="polite"></p>

      <button id="open-options" type="button" class="link-button">打开选项页面</button>
    </main>
    <script src="popup.js"></script>
  </body>
</html>
```

Create `popup/popup.css` with a compact 320px popup layout, green ON and red OFF badge variants, stable button widths, and dark-mode support.

Create `popup/popup.js` to query active tab, load popup state, send mutation messages, re-render after each mutation, and open the options page.

- [ ] **Step 5: Run tests and verify green**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

Run:

```text
git add tests/extension-files.test.js manifest.json popup/popup.html popup/popup.css popup/popup.js
git commit -m "feat: add popup control panel"
```

### Task 3: Popup Behavior Hardening and Verification

**Files:**
- Modify: `popup/popup.js`
- Modify: `popup/popup.css`
- Optional modify: `tests/background.test.js`

- [ ] **Step 1: Add focused behavior checks if gaps appear**

If implementation reveals missing coverage, add background tests for mutation flows through existing messages:

```js
test("popup state reflects global toggle and domain whitelist mutations", async () => {
  const chrome = fakeChrome({ enabled: true, whitelist: [] });
  const controller = createBackgroundController(chrome);

  await controller.handleMessage({
    type: "updateSettings",
    settings: { enabled: false }
  });
  const disabled = await controller.handleMessage({
    type: "getPopupState",
    url: "https://example.com/"
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.protect, false);

  await controller.handleMessage({
    type: "addDomain",
    domain: "https://example.com/room"
  });
  const whitelisted = await controller.handleMessage({
    type: "getPopupState",
    url: "https://example.com/"
  });
  assert.equal(whitelisted.whitelisted, true);
});
```

- [ ] **Step 2: Run tests and verify any new test fails before implementation**

Run: `npm run test`

Expected: any newly added test fails for the missing behavior, not syntax errors.

- [ ] **Step 3: Implement hardening**

Ensure popup behavior covers:

- Missing active tab: show “无法读取当前页面”.
- Unsupported URL: show “当前页面不支持域名规则” and disable domain button.
- Message errors: show the returned Chinese or browser error message.
- Successful global toggle: reload popup state from background.
- Successful domain toggle: reload popup state from background.

- [ ] **Step 4: Run final automated verification**

Run:

```text
npm run test
git diff --check
git status --short
```

Expected: tests pass, diff check has no errors, only intended files are modified before final commit.

- [ ] **Step 5: Visual verification**

Open `popup/popup.html` in the in-app browser or Chrome with mocked extension APIs only if practical. At minimum inspect rendered HTML/CSS dimensions through file review and ensure no text overflow risks in the fixed popup width.

- [ ] **Step 6: Commit and push**

Run:

```text
git add .
git commit -m "fix: harden popup control behavior"
git push origin feature/popup-control-panel
```

After review, merge or fast-forward `master` only when the user approves that integration path.
