importScripts(
  "src/domain.js",
  "src/settings.js",
  "src/background-controller.js"
);

webrtcBackground.createBackgroundController(chrome).start();
