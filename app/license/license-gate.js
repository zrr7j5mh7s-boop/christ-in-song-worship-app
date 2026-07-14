// app/license/license-gate.js
// Renderer-side helpers for pilot licence gating.

(function initLicenseGate(global) {
  const OUTPUT_COMMANDS = new Set([
    'open-presenter',
    'present-current',
    'presenter-open-output',
    'open-obs-monitor',
    'open-stage-display',
    'open-camera-preview',
    'service-mode-enter',
    'quiet-service-mode-enter',
    'hymn-go-live',
    'hymn-take-next-live',
    'bible-send-live',
    'emergency-black',
    'emergency-white',
    'emergency-logo',
    'obs-start-stream',
    'obs-start-record',
    'obs-start-vcam',
  ]);

  function createBridge(electronApi) {
    if (!electronApi?.license) return null;
    return electronApi.license;
  }

  async function getStatus(bridge) {
    if (!bridge?.getLicenceStatus) return { status: 'not_activated', canPresent: false, canUseLiveOutputs: false };
    return bridge.getLicenceStatus();
  }

  function shouldBlockCommand(status, command) {
    if (!status || status.canUseLiveOutputs) return false;
    if (!command) return false;
    if (command === 'license-activate' || command === 'license-deactivate' || command === 'license-validate') {
      return false;
    }
    if (command === 'export-backup' || command === 'restore-backup') return false;
    if (OUTPUT_COMMANDS.has(command)) return true;
    if (command.startsWith('hymn-') && (command.includes('live') || command.includes('next'))) return true;
    if (command.startsWith('bible-') && command.includes('live')) return true;
    return false;
  }

  global.CISLicenseGate = {
    createBridge,
    getStatus,
    shouldBlockCommand,
    OUTPUT_COMMANDS,
  };
})(window);
