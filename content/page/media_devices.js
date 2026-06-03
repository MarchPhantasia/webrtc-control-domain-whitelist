(function blockMediaDevices() {
  try {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: false,
      value: null,
      writable: false
    });
  } catch (_error) {
    try {
      navigator.mediaDevices = null;
    } catch (_ignored) {
      // Some navigator properties are not configurable.
    }
  }

  const prototype = Object.getPrototypeOf(navigator);

  if (prototype) {
    try {
      Object.defineProperty(prototype, "mediaDevices", {
        configurable: true,
        get() {
          return null;
        }
      });
    } catch (_ignored) {
      // Prototype override is best-effort.
    }
  }
})();
