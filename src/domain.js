(function attachDomainHelpers(root) {
  const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

  function isValidIpv4(hostname) {
    const parts = hostname.split(".");

    if (parts.length !== 4) {
      return false;
    }

    return parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }

      const value = Number(part);
      return value >= 0 && value <= 255 && String(value) === part.replace(/^0+(?=\d)/, "");
    });
  }

  function isValidDomain(hostname) {
    if (hostname === "localhost") {
      return true;
    }

    if (/^\d/.test(hostname)) {
      return isValidIpv4(hostname);
    }

    const labels = hostname.split(".");

    if (labels.length < 2) {
      return false;
    }

    return labels.every((label) => (
      label.length > 0
      && label.length <= 63
      && /^[a-z0-9-]+$/.test(label)
      && !label.startsWith("-")
      && !label.endsWith("-")
    ));
  }

  function parseHostname(value) {
    const input = String(value || "").trim().toLowerCase();

    if (!input) {
      return null;
    }

    try {
      const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);

      if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
        return null;
      }

      return url.hostname;
    } catch (_error) {
      const host = input
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
        .split(":")[0];

      return host || null;
    }
  }

  function normalizeDomain(value) {
    let hostname = parseHostname(value);

    if (!hostname || hostname.includes(":")) {
      return null;
    }

    hostname = hostname.replace(/\.$/, "");

    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    return isValidDomain(hostname) ? hostname : null;
  }

  function hostnameFromUrl(url) {
    return normalizeDomain(url);
  }

  function normalizeWhitelist(whitelist) {
    const seen = new Set();
    const normalized = [];

    for (const entry of Array.isArray(whitelist) ? whitelist : []) {
      const domain = normalizeDomain(entry);

      if (domain && !seen.has(domain)) {
        seen.add(domain);
        normalized.push(domain);
      }
    }

    return normalized;
  }

  function isDomainWhitelisted(hostnameOrUrl, whitelist) {
    const hostname = normalizeDomain(hostnameOrUrl);

    if (!hostname) {
      return false;
    }

    return normalizeWhitelist(whitelist).some((entry) => (
      hostname === entry || hostname.endsWith(`.${entry}`)
    ));
  }

  function shouldProtectUrl(url, settings) {
    const currentSettings = settings || {};
    const hostname = hostnameFromUrl(url);

    if (!currentSettings.enabled || !hostname) {
      return false;
    }

    return !isDomainWhitelisted(hostname, currentSettings.whitelist || []);
  }

  const api = {
    hostnameFromUrl,
    isDomainWhitelisted,
    normalizeDomain,
    normalizeWhitelist,
    shouldProtectUrl
  };

  root.webrtcDomain = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
