const assert = require("node:assert/strict");
const test = require("node:test");
const domain = require("../src/domain");

test("normalizes domain entries", () => {
  assert.equal(domain.normalizeDomain("https://www.Example.com:8443/room?q=1"), "example.com");
  assert.equal(domain.normalizeDomain(" example.com. "), "example.com");
  assert.equal(domain.normalizeDomain("localhost"), "localhost");
  assert.equal(domain.normalizeDomain("192.168.1.10"), "192.168.1.10");
  assert.equal(domain.normalizeDomain("256.1.1.1"), null);
});

test("extracts supported URL hostnames", () => {
  assert.equal(domain.hostnameFromUrl("https://www.Example.com/room"), "example.com");
  assert.equal(domain.hostnameFromUrl("http://localhost:3000"), "localhost");
  assert.equal(domain.hostnameFromUrl("chrome://extensions"), null);
  assert.equal(domain.hostnameFromUrl("file:///tmp/index.html"), null);
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
