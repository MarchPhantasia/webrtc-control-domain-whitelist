const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("manifest wires the extension runtime", () => {
  const manifest = readJson("manifest.json");

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.options_ui.page, "options/options.html");
  assert.equal(manifest.action.default_title, "WebRTC Control");
  assert.equal(manifest.action.default_popup, "popup/popup.html");
  assert.ok(manifest.permissions.includes("privacy"));
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(manifest.permissions.includes("tabs"));
});

test("background entry delegates to the controller module", () => {
  const background = readText("background.js");

  assert.match(background, /src\/background-controller\.js/);
  assert.match(background, /createBackgroundController\(chrome\)\.start\(\)/);
  assert.doesNotMatch(background, /function createBackgroundController/);
});

test("manifest exposes content script and page-context blockers", () => {
  const manifest = readJson("manifest.json");
  const contentScript = manifest.content_scripts[0];
  const resources = manifest.web_accessible_resources[0].resources;

  assert.equal(contentScript.run_at, "document_start");
  assert.equal(contentScript.all_frames, true);
  assert.deepEqual(contentScript.matches, ["*://*/*"]);
  assert.deepEqual(contentScript.js, ["content/inject.js"]);
  assert.ok(resources.includes("content/page/support_detection.js"));
  assert.ok(resources.includes("content/page/media_devices.js"));
  assert.ok(resources.includes("content/page/additional_objects.js"));
});

test("extension UI and injection files exist with expected message hooks", () => {
  const inject = readText("content/inject.js");
  const options = readText("options/options.js");
  const optionsHtml = readText("options/options.html");
  const popupHtml = readText("popup/popup.html");
  const popupJs = readText("popup/popup.js");

  for (const relativePath of [
    "content/page/support_detection.js",
    "content/page/media_devices.js",
    "content/page/additional_objects.js",
    "options/options.html",
    "options/options.css",
    "popup/popup.html",
    "popup/popup.css",
    "popup/popup.js",
    "README.md"
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} should exist`);
  }

  assert.match(inject, /shouldProtectPage/);
  assert.match(options, /addDomain/);
  assert.match(options, /removeDomain/);
  assert.match(options, /updateSettings/);
  assert.match(options, /response\.changed/);
  assert.match(options, /设置已保存/);
  assert.match(options, /已加入白名单/);
  assert.match(options, /已经在白名单中/);
  assert.match(optionsHtml, /WebRTC 控制/);
  assert.match(optionsHtml, /保护开关/);
  assert.match(optionsHtml, /域名白名单/);
  assert.match(optionsHtml, /正在加载设置/);
  assert.match(optionsHtml, />添加</);
  assert.match(optionsHtml, />移除</);
  assert.match(popupHtml, /WebRTC Control/);
  assert.match(popupHtml, /当前页面/);
  assert.match(popupHtml, /打开选项页面/);
  assert.match(popupJs, /getPopupState/);
  assert.match(popupJs, /getSettings/);
  assert.match(popupJs, /Unknown request/);
  assert.match(popupJs, /buildFallbackState/);
  assert.match(popupJs, /updateSettings/);
  assert.match(popupJs, /addDomain/);
  assert.match(popupJs, /removeDomain/);
  assert.match(popupJs, /openOptionsPage/);
});

test("popup styles use readable control text sizes", () => {
  const popupCss = readText("popup/popup.css");

  assert.match(popupCss, /#status-text\s*{[^}]*font-size:\s*13px/s);
  assert.match(popupCss, /\.domain\s*{[^}]*font-size:\s*16px/s);
  assert.match(popupCss, /button\s*{[^}]*font-size:\s*16px/s);
  assert.match(popupCss, /#message\s*{[^}]*font-size:\s*13px/s);
});
