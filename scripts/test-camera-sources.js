#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function loadConstants() {
  const source = fs.readFileSync(path.join(ROOT, "app/camera/camera-constants.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.CISCameraConstants;
}

function loadStore() {
  const constants = loadConstants();
  const constantsSource = fs.readFileSync(path.join(ROOT, "app/camera/camera-constants.js"), "utf8");
  const storeSource = fs.readFileSync(path.join(ROOT, "app/camera/camera-settings-store.js"), "utf8");
  const sandbox = {
    window: { CISCameraConstants: constants },
    console,
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, value) { this._data[key] = value; },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(constantsSource, sandbox);
  vm.runInContext(storeSource, sandbox);
  return sandbox.window.CISCameraSettingsStore;
}

function loadServiceLogic() {
  const constants = loadConstants();
  const store = loadStore();
  const serviceSource = fs.readFileSync(path.join(ROOT, "app/camera/camera-source-service.js"), "utf8");
  const sandbox = {
    navigator: {
      mediaDevices: {
        async enumerateDevices() {
          return [
            { kind: "videoinput", deviceId: "a", label: "FaceTime HD Camera" },
            { kind: "videoinput", deviceId: "b", label: "OBS Virtual Camera" },
            { kind: "videoinput", deviceId: "c", label: "Camo Camera" },
            { kind: "videoinput", deviceId: "d", label: "Iriun Webcam" },
          ];
        },
        async getUserMedia() {
          const stream = {
            active: true,
            getVideoTracks() {
              return [{
                getSettings() { return { width: 1280, height: 720, frameRate: 30, deviceId: "b" }; },
                addEventListener() {},
                stop() {},
              }];
            },
            getTracks() { return this.getVideoTracks(); },
          };
          return stream;
        },
        addEventListener() {},
      },
    },
    window: {
      CISCameraConstants: constants,
      CISCameraSettingsStore: store,
      CISPresenterEngine: { setDisplayMode() {} },
      CISObsConnectionService: { getStatus: () => ({ connected: false, obsRuntime: {} }) },
      CISObsSettingsStore: { loadSettings: () => ({ outputTarget: "projector" }) },
      localStorage: {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, value) { this._data[key] = value; },
      },
    },
    console,
  };
  sandbox.window.localStorage = sandbox.window.localStorage;
  sandbox.localStorage = sandbox.window.localStorage;
  vm.createContext(sandbox);
  vm.runInContext(serviceSource, sandbox);
  return sandbox.window.CISCameraSourceService;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

async function run() {
  const constants = loadConstants();
  assert.equal(constants.classifyDevice("OBS Virtual Camera").id, "obs-virtual");
  assert.equal(constants.classifyDevice("Camo Camera").id, "camo");
  assert.equal(constants.classifyDevice("Iriun Webcam").id, "iriun");
  assert.equal(constants.classifyDevice("USB Camera").id, "usb");
  assert.equal(constants.classifyDevice("Random Future Cam 3000").id, "generic");

  const store = loadStore();
  const cam = store.defaultSavedCamera({ name: "Main", deviceLabel: "OBS Virtual Camera" });
  store.saveSavedCameras([cam]);
  const loaded = store.loadSavedCameras();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].deviceLabel, "OBS Virtual Camera");
  assert.equal(loaded[0].preferredDeviceId, "");

  const service = loadServiceLogic();
  await service.refreshDevices(false);
  const devices = service.getState().devices;
  assert.equal(devices.length, 4);

  const obsDevice = service.matchDevice(
    { deviceLabel: "OBS Virtual Camera" },
    devices,
  );
  assert.equal(obsDevice.deviceId, "b");

  const camoHint = service.classifyLabel("Camo Camera");
  assert.equal(camoHint.id, "camo");
  assert.match(camoHint.guidance, /Camo Studio/i);

  const saved = service.addCamera({ name: "OBS Program", deviceLabel: "OBS Virtual Camera", role: "obs-program" });
  service.setDefaultCamera(saved.id);

  await service.startPreview(saved.id);
  assert.equal(service.getState().preview.active, true);
  assert.equal(service.getState().preview.status, "connected");

  await service.sendCameraLive({ cameraId: saved.id, skipPermission: true });
  assert.equal(service.getState().live.active, true);
  assert.equal(service.getState().live.status, "connected");

  const recursion = service.checkRecursion(saved, ["obs"]);
  assert.equal(recursion.blocked, true);
  assert.match(recursion.message, /recursive video loop/i);

  const localOnly = service.checkRecursion(
    service.getSavedCamera(saved.id),
    ["main"],
  );
  assert.equal(localOnly.blocked, false);

  service.clearCamera();
  assert.equal(service.getState().live.active, false);

  await service.stopPreview();
  assert.equal(service.getState().preview.active, false);

  const uiSource = read("app/camera/camera-source-ui.js");
  assert.ok(uiSource.includes("Camera Sources"));
  assert.ok(uiSource.includes("muted"));
  assert.ok(uiSource.includes("LOCAL PRESENTATION ACTIVE"));
  assert.ok(uiSource.includes("Internet streaming"));

  const serviceSource = read("app/camera/camera-source-service.js");
  assert.ok(serviceSource.includes("audio: false") || serviceSource.includes('audio: opts.audio'));
  assert.ok(serviceSource.includes("releaseStream"));
  assert.ok(serviceSource.includes("wouldCauseObsRecursion"));
  assert.ok(serviceSource.includes("prepareCameraStream"));

  const compositorSource = read("app/camera/camera-compositor.js");
  assert.ok(compositorSource.includes("muted"));
  assert.ok(compositorSource.includes("projector-camera-stage"));

  const outputSource = read("app/presenter-output.js");
  assert.ok(outputSource.includes("bindCameraVideos"));
  assert.ok(outputSource.includes("cameraState"));

  const appSource = read("app/app.js");
  assert.ok(appSource.includes('id: "cameras"'));
  assert.ok(appSource.includes("camera-send-live"));
  assert.ok(appSource.includes("setupCameraSources"));
  assert.ok(appSource.includes("typing"));

  const slideSource = read("app/slide-content.js");
  assert.ok(slideSource.includes('"camera"'));

  const helpSource = read("app/help/help-ui.js");
  assert.ok(helpSource.includes("camera-switch-backup"));

  const mainSource = read("src/main.js");
  assert.ok(mainSource.includes("camera-preview:open"));

  const preloadSource = read("src/preload.js");
  assert.ok(preloadSource.includes("cameraPreview"));

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:camera-sources"], "test:camera-sources script required");

  console.log("test:camera-sources — all checks passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
