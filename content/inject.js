(function injectWebRtcControls() {
  const blockers = [
    {
      flag: "blockSupportDetection",
      id: "webrtc-control-support-detection",
      path: "content/page/support_detection.js"
    },
    {
      flag: "blockMediaDevices",
      id: "webrtc-control-media-devices",
      path: "content/page/media_devices.js"
    },
    {
      flag: "blockAdditionalObjects",
      id: "webrtc-control-additional-objects",
      path: "content/page/additional_objects.js"
    }
  ];

  function injectPageScript(path, id) {
    if (document.getElementById(id)) {
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.type = "text/javascript";
    script.src = chrome.runtime.getURL(path);
    script.onload = function removeScript() {
      script.remove();
    };

    const target = document.documentElement || document.head;

    if (target) {
      target.appendChild(script);
    }
  }

  function applyDecision(response) {
    if (!response || !response.ok || !response.protect) {
      return;
    }

    const currentSettings = response.settings || {};

    for (const blocker of blockers) {
      if (currentSettings[blocker.flag]) {
        injectPageScript(blocker.path, blocker.id);
      }
    }
  }

  chrome.runtime.sendMessage({
    type: "shouldProtectPage",
    url: location.href
  }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }

    applyDecision(response);
  });
})();
