(function () {
  "use strict";

  const CAMERA_ROLES = [
    { id: "main", label: "Main camera" },
    { id: "secondary", label: "Secondary camera" },
    { id: "pulpit", label: "Pulpit camera" },
    { id: "choir", label: "Choir camera" },
    { id: "instrument", label: "Instrument camera" },
    { id: "obs-program", label: "OBS Program camera" },
    { id: "backup", label: "Backup camera" },
    { id: "custom", label: "Custom role" },
  ];

  const CAMERA_LAYOUTS = [
    { id: "fullscreen", label: "Full-screen camera" },
    { id: "scripture-overlay", label: "Camera with scripture overlay" },
    { id: "hymn-overlay", label: "Camera with hymn lyrics overlay" },
    { id: "sermon-title", label: "Camera with sermon title" },
    { id: "lower-third", label: "Camera with speaker lower third" },
    { id: "announcement-overlay", label: "Camera with announcement overlay" },
    { id: "pip-bottom-right", label: "Picture-in-picture (bottom right)" },
    { id: "pip-bottom-left", label: "Picture-in-picture (bottom left)" },
    { id: "split-screen", label: "Split-screen camera and presentation" },
    { id: "transparent-overlay", label: "Camera background with transparent worship overlay" },
    { id: "church-logo", label: "Camera with church logo" },
    { id: "safe-area", label: "Camera with safe-area guides" },
  ];

  const OUTPUT_DESTINATIONS = [
    { id: "main", label: "Main projector" },
    { id: "secondary", label: "Secondary projector" },
    { id: "all-congregation", label: "All congregation projectors" },
    { id: "stage", label: "Stage display" },
    { id: "foyer", label: "Foyer display" },
    { id: "operator", label: "Operator screen (preview only)" },
  ];

  const OUTPUT_GROUPS = [
    { id: "mirrored-all", label: "All mirrored outputs", destinations: ["main", "secondary", "all-congregation"] },
    { id: "sanctuary", label: "Sanctuary projectors", destinations: ["main", "secondary"] },
    { id: "stage-only", label: "Stage display only", destinations: ["stage"] },
  ];

  const TRANSITIONS = [
    { id: "cut", label: "Cut" },
    { id: "fade", label: "Fade" },
    { id: "crossfade", label: "Crossfade" },
    { id: "dip-black", label: "Dip to black" },
    { id: "dip-logo", label: "Dip to logo" },
  ];

  const DEVICE_HINTS = [
    { id: "obs-virtual", patterns: [/obs virtual/i, /obs-camera/i], label: "OBS Virtual Camera", guidance: "Start Virtual Camera in OBS (Tools → Start Virtual Camera) with output set to Program, then Refresh Devices." },
    { id: "camo", patterns: [/camo/i], label: "Camo Camera", guidance: "Camo Camera is not currently available. Open Camo Studio, connect the phone or camera, and then select Refresh Devices." },
    { id: "iriun", patterns: [/iriun/i], label: "Iriun Webcam", guidance: "Iriun Webcam is not currently available. Open Iriun on the computer and phone, confirm that the camera is connected, and then select Refresh Devices." },
    { id: "droidcam", patterns: [/droidcam/i], label: "DroidCam", guidance: "DroidCam is not currently available. Open DroidCam on the computer and phone, then select Refresh Devices." },
    { id: "continuity", patterns: [/continuity/i, /iphone/i], label: "Continuity Camera", guidance: "Continuity Camera is not available. Ensure your iPhone is nearby and connected, then Refresh Devices." },
    { id: "capture-card", patterns: [/capture/i, /elgato/i, /blackmagic/i, /hdmi/i, /sdi/i], label: "Capture device", guidance: "The capture device is not available. Check cables and power, then Refresh Devices." },
    { id: "builtin", patterns: [/facetime/i, /integrated/i, /built-?in/i, /isight/i], label: "Built-in camera", guidance: "Built-in camera is not available. Check system camera permissions and Refresh Devices." },
    { id: "usb", patterns: [/usb/i, /webcam/i, /logitech/i], label: "USB webcam", guidance: "USB camera is not available. Reconnect the device and Refresh Devices." },
  ];

  const AUDIO_MODES = [
    { id: "video-only", label: "Use video only" },
    { id: "camera-mic", label: "Use camera microphone" },
    { id: "separate-input", label: "Select separate audio input" },
    { id: "muted", label: "Mute camera audio" },
  ];

  const DEFAULT_SETTINGS = {
    defaultCameraId: "",
    backupCameraId: "",
    preferredWidth: 1280,
    preferredHeight: 720,
    preferredFrameRate: 30,
    defaultLayout: "fullscreen",
    defaultTransition: "cut",
    defaultDestinations: ["main", "secondary"],
    audioDisabledByDefault: true,
    prepareNextCamera: true,
    showLogoOnFailure: true,
    warnObsRecursion: true,
    defaultOutputGroup: "mirrored-all",
    internetStreamingOff: true,
  };

  function classifyDevice(label) {
    const text = String(label || "").trim();
    if (!text) return { id: "unknown", label: "Unknown camera", type: "physical", guidance: "" };
    for (const hint of DEVICE_HINTS) {
      if (hint.patterns.some((pattern) => pattern.test(text))) {
        return {
          id: hint.id,
          label: hint.label,
          type: hint.id === "obs-virtual" ? "obs-virtual" : "virtual",
          guidance: hint.guidance,
          deviceLabel: text,
        };
      }
    }
    return { id: "generic", label: text, type: "physical", guidance: "", deviceLabel: text };
  }

  function isObsVirtualCameraLabel(label) {
    return classifyDevice(label).id === "obs-virtual";
  }

  function getRoleLabel(roleId) {
    return (CAMERA_ROLES.find((role) => role.id === roleId) || { label: roleId }).label;
  }

  function getLayoutLabel(layoutId) {
    return (CAMERA_LAYOUTS.find((layout) => layout.id === layoutId) || { label: layoutId }).label;
  }

  window.CISCameraConstants = {
    CAMERA_ROLES,
    CAMERA_LAYOUTS,
    OUTPUT_DESTINATIONS,
    OUTPUT_GROUPS,
    TRANSITIONS,
    DEVICE_HINTS,
    AUDIO_MODES,
    DEFAULT_SETTINGS,
    classifyDevice,
    isObsVirtualCameraLabel,
    getRoleLabel,
    getLayoutLabel,
  };
})();
