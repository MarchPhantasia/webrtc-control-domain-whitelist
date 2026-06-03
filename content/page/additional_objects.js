(function blockAdditionalWebRtcObjects() {
  for (const property of ["RTCDataChannel", "RTCIceCandidate", "RTCConfiguration"]) {
    if (!(property in window)) {
      continue;
    }

    try {
      Object.defineProperty(window, property, {
        configurable: false,
        value: undefined,
        writable: false
      });
    } catch (_error) {
      try {
        window[property] = undefined;
      } catch (_ignored) {
        // Some window properties are not configurable.
      }
    }
  }
})();
