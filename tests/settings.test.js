const assert = require("node:assert/strict");
const test = require("node:test");
const settings = require("../src/settings");

test("merges stored values with defaults", () => {
  const merged = settings.mergeSettings({
    blockMediaDevices: true,
    ipPolicy: "invalid",
    whitelist: ["Example.com", "https://www.Example.com/room", "bad host"]
  });

  assert.equal(merged.enabled, true);
  assert.equal(merged.ipPolicy, "disable_non_proxied_udp");
  assert.equal(merged.blockSupportDetection, true);
  assert.equal(merged.blockMediaDevices, true);
  assert.equal(merged.blockAdditionalObjects, false);
  assert.deepEqual(merged.whitelist, ["example.com"]);
});

test("adds and removes normalized whitelist domains", () => {
  const first = settings.addWhitelistDomain(settings.DEFAULT_SETTINGS, "https://www.Example.com/room");

  assert.deepEqual(first.whitelist, ["example.com"]);

  const second = settings.addWhitelistDomain(first, "call.example.com");

  assert.deepEqual(second.whitelist, ["example.com", "call.example.com"]);

  const duplicate = settings.addWhitelistDomain(second, "www.example.com");

  assert.deepEqual(duplicate.whitelist, ["example.com", "call.example.com"]);

  const third = settings.removeWhitelistDomain(duplicate, "www.example.com");

  assert.deepEqual(third.whitelist, ["call.example.com"]);
});

test("rejects invalid whitelist domains", () => {
  assert.throws(
    () => settings.addWhitelistDomain(settings.DEFAULT_SETTINGS, "chrome://extensions"),
    /Invalid domain/
  );
});

test("updates settings while preserving valid existing values", () => {
  const updated = settings.updateSettings(
    { ...settings.DEFAULT_SETTINGS, whitelist: ["example.com"] },
    {
      enabled: false,
      ipPolicy: "default",
      blockAdditionalObjects: true,
      whitelist: ["other.test"]
    }
  );

  assert.deepEqual(updated, {
    enabled: false,
    ipPolicy: "default",
    blockSupportDetection: true,
    blockMediaDevices: false,
    blockAdditionalObjects: true,
    whitelist: ["other.test"]
  });
});
