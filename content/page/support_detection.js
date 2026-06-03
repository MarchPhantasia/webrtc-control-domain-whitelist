(function blockWebRtcSupportDetection() {
  function defineBlocked(target, property) {
    if (!target || !(property in target)) {
      return;
    }

    try {
      Object.defineProperty(target, property, {
        configurable: false,
        value: undefined,
        writable: false
      });
    } catch (_error) {
      try {
        target[property] = undefined;
      } catch (_ignored) {
        // Some page objects are not configurable.
      }
    }
  }

  defineBlocked(navigator, "getUserMedia");
  defineBlocked(navigator, "mozGetUserMedia");
  defineBlocked(navigator, "webkitGetUserMedia");

  defineBlocked(window, "MediaStreamTrack");
  defineBlocked(window, "RTCPeerConnection");
  defineBlocked(window, "RTCSessionDescription");

  defineBlocked(window, "mozMediaStreamTrack");
  defineBlocked(window, "mozRTCPeerConnection");
  defineBlocked(window, "mozRTCSessionDescription");

  defineBlocked(window, "webkitMediaStreamTrack");
  defineBlocked(window, "webkitRTCPeerConnection");
  defineBlocked(window, "webkitRTCSessionDescription");
})();
