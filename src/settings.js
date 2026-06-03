(function attachSettingsHelpers(root) {
  const domain = root.webrtcDomain || require("./domain");
  const VALID_IP_POLICIES = new Set([
    "default",
    "default_public_and_private_interfaces",
    "default_public_interface_only",
    "disable_non_proxied_udp"
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    ipPolicy: "disable_non_proxied_udp",
    blockSupportDetection: true,
    blockMediaDevices: false,
    blockAdditionalObjects: false,
    whitelist: Object.freeze([])
  });

  function booleanOrDefault(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function policyOrDefault(value) {
    return VALID_IP_POLICIES.has(value) ? value : DEFAULT_SETTINGS.ipPolicy;
  }

  function mergeSettings(stored) {
    const source = stored || {};

    return {
      enabled: booleanOrDefault(source.enabled, DEFAULT_SETTINGS.enabled),
      ipPolicy: policyOrDefault(source.ipPolicy),
      blockSupportDetection: booleanOrDefault(source.blockSupportDetection, DEFAULT_SETTINGS.blockSupportDetection),
      blockMediaDevices: booleanOrDefault(source.blockMediaDevices, DEFAULT_SETTINGS.blockMediaDevices),
      blockAdditionalObjects: booleanOrDefault(source.blockAdditionalObjects, DEFAULT_SETTINGS.blockAdditionalObjects),
      whitelist: domain.normalizeWhitelist(source.whitelist)
    };
  }

  function addWhitelistDomain(settings, input) {
    const normalized = domain.normalizeDomain(input);

    if (!normalized) {
      throw new Error("Invalid domain");
    }

    const current = mergeSettings(settings);

    if (current.whitelist.includes(normalized)) {
      return current;
    }

    return {
      ...current,
      whitelist: [...current.whitelist, normalized]
    };
  }

  function removeWhitelistDomain(settings, input) {
    const normalized = domain.normalizeDomain(input);
    const current = mergeSettings(settings);

    if (!normalized) {
      return current;
    }

    return {
      ...current,
      whitelist: current.whitelist.filter((entry) => entry !== normalized)
    };
  }

  function updateSettings(settings, patch) {
    return mergeSettings({
      ...mergeSettings(settings),
      ...(patch || {})
    });
  }

  const api = {
    DEFAULT_SETTINGS,
    VALID_IP_POLICIES,
    addWhitelistDomain,
    mergeSettings,
    removeWhitelistDomain,
    updateSettings
  };

  root.webrtcSettings = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
