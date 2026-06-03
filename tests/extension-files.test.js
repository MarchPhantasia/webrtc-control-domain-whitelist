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

  for (const relativePath of [
    "content/page/support_detection.js",
    "content/page/media_devices.js",
    "content/page/additional_objects.js",
    "options/options.html",
    "options/options.css",
    "README.md"
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} should exist`);
  }

  assert.match(inject, /shouldProtectPage/);
  assert.match(options, /addDomain/);
  assert.match(options, /removeDomain/);
  assert.match(options, /updateSettings/);
  assert.match(options, /response\.changed/);
});
