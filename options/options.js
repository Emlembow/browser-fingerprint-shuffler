// Options page script for Browser Fingerprint Shuffler

document.addEventListener('DOMContentLoaded', async () => {
  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });

  // Load settings
  await loadSettings();

  // Range input sync
  const canvasRange = document.getElementById('canvasNoiseStrength');
  const canvasValue = document.getElementById('canvasNoiseValue');
  canvasRange.addEventListener('input', () => {
    canvasValue.textContent = parseFloat(canvasRange.value).toFixed(1);
  });

  const webglRange = document.getElementById('webglJitter');
  const webglValue = document.getElementById('webglJitterValue');
  webglRange.addEventListener('input', () => {
    webglValue.textContent = parseFloat(webglRange.value).toFixed(1);
  });

  // Save button
  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // Reset all button
  document.getElementById('resetAllBtn').addEventListener('click', resetAllSettings);

  // Reset fingerprint button
  document.getElementById('resetFingerprintBtn').addEventListener('click', resetFingerprint);

  // Whitelist management
  loadWhitelist();
  document.getElementById('addSiteBtn').addEventListener('click', addToWhitelist);
  document.getElementById('newSiteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addToWhitelist();
  });
});

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(null);
    const config = result.fpConfig || getDefaultConfig();

    // General settings
    document.getElementById('perOriginFingerprint').checked = config.perOriginFingerprint !== false;
    document.getElementById('useGaussianNoise').checked = config.useGaussianNoise !== false;
    document.getElementById('useStrongKDF').checked = config.useStrongKDF !== false;
    document.getElementById('kdfIterations').value = config.kdfIterations || 1000;

    // Screen
    document.getElementById('enableScreenProtection').checked = config.enableScreenProtection !== false;
    document.getElementById('useRealDistribution').checked = config.screen?.useRealDistribution !== false;

    // Font
    document.getElementById('enableFontProtection').checked = config.enableFontProtection !== false;

    // Timezone
    document.getElementById('enableTimezoneProtection').checked = config.enableTimezoneProtection !== false;

    // Sensors
    document.getElementById('enableSensorProtection').checked = config.enableSensorProtection !== false;
    document.getElementById('hideGamepads').checked = config.sensors?.hideGamepads !== false;

    // Canvas & WebGL
    document.getElementById('enableCanvasNoise').checked = config.enableCanvasNoise !== false;
    document.getElementById('canvasNoiseStrength').value = config.canvasNoiseStrength || 2;
    document.getElementById('canvasNoiseValue').textContent = (config.canvasNoiseStrength || 2).toFixed(1);

    document.getElementById('enableWebGLMasking').checked = config.enableWebGLMasking !== false;
    document.getElementById('webglJitter').value = config.webglJitter || 2;
    document.getElementById('webglJitterValue').textContent = (config.webglJitter || 2).toFixed(1);
    document.getElementById('maskWebGLVendorStrings').checked = config.maskWebGLVendorStrings !== false;
    document.getElementById('shuffleWebGLExtensions').checked = config.shuffleWebGLExtensions !== false;

    document.getElementById('enableAudioNoise').checked = config.enableAudioNoise !== false;
    document.getElementById('audioNoiseStrength').value = config.audioNoiseStrength || 1e-7;

    // WebRTC & Media
    document.getElementById('enableWebRTCProtection').checked = config.enableWebRTCProtection !== false;
    document.getElementById('blockIPLeak').checked = config.webrtc?.blockIPLeak !== false;
    document.getElementById('randomizeSDP').checked = config.webrtc?.randomizeSDP !== false;
    document.getElementById('forceRelay').checked = config.webrtc?.forceRelay === true;

    document.getElementById('enableMediaDeviceProtection').checked = config.enableMediaDeviceProtection !== false;
    document.getElementById('randomizeDeviceIds').checked = config.mediaDevices?.randomizeDeviceIds !== false;
    document.getElementById('spoofDeviceLabels').checked = config.mediaDevices?.spoofDeviceLabels !== false;

    // Navigator
    document.getElementById('enableNavigatorFuzz').checked = config.enableNavigatorFuzz !== false;
    document.getElementById('fuzzHardwareConcurrency').checked = config.navigator?.fuzzHardwareConcurrency !== false;
    document.getElementById('fuzzDeviceMemory').checked = config.navigator?.fuzzDeviceMemory !== false;
    document.getElementById('shuffleLanguages').checked = config.navigator?.shuffleLanguages !== false;

    // Debug
    document.getElementById('debug').checked = config.debug === true;

    showStatus('Settings loaded', 'success');
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

async function saveSettings() {
  try {
    const config = {
      // General
      perOriginFingerprint: document.getElementById('perOriginFingerprint').checked,
      useGaussianNoise: document.getElementById('useGaussianNoise').checked,
      useStrongKDF: document.getElementById('useStrongKDF').checked,
      kdfIterations: parseInt(document.getElementById('kdfIterations').value),

      // Screen
      enableScreenProtection: document.getElementById('enableScreenProtection').checked,
      screen: {
        useRealDistribution: document.getElementById('useRealDistribution').checked
      },

      // Font
      enableFontProtection: document.getElementById('enableFontProtection').checked,

      // Timezone
      enableTimezoneProtection: document.getElementById('enableTimezoneProtection').checked,

      // Sensors
      enableSensorProtection: document.getElementById('enableSensorProtection').checked,
      sensors: {
        hideGamepads: document.getElementById('hideGamepads').checked
      },

      // Canvas & WebGL
      enableCanvasNoise: document.getElementById('enableCanvasNoise').checked,
      canvasNoiseStrength: parseFloat(document.getElementById('canvasNoiseStrength').value),

      enableWebGLMasking: document.getElementById('enableWebGLMasking').checked,
      webglJitter: parseFloat(document.getElementById('webglJitter').value),
      maskWebGLVendorStrings: document.getElementById('maskWebGLVendorStrings').checked,
      shuffleWebGLExtensions: document.getElementById('shuffleWebGLExtensions').checked,

      enableAudioNoise: document.getElementById('enableAudioNoise').checked,
      audioNoiseStrength: parseFloat(document.getElementById('audioNoiseStrength').value),

      // WebRTC & Media
      enableWebRTCProtection: document.getElementById('enableWebRTCProtection').checked,
      webrtc: {
        blockIPLeak: document.getElementById('blockIPLeak').checked,
        randomizeSDP: document.getElementById('randomizeSDP').checked,
        forceRelay: document.getElementById('forceRelay').checked
      },

      enableMediaDeviceProtection: document.getElementById('enableMediaDeviceProtection').checked,
      mediaDevices: {
        randomizeDeviceIds: document.getElementById('randomizeDeviceIds').checked,
        spoofDeviceLabels: document.getElementById('spoofDeviceLabels').checked
      },

      // Navigator
      enableNavigatorFuzz: document.getElementById('enableNavigatorFuzz').checked,
      navigator: {
        fuzzHardwareConcurrency: document.getElementById('fuzzHardwareConcurrency').checked,
        fuzzDeviceMemory: document.getElementById('fuzzDeviceMemory').checked,
        shuffleLanguages: document.getElementById('shuffleLanguages').checked
      },

      // Debug
      debug: document.getElementById('debug').checked
    };

    await chrome.storage.local.set({ fpConfig: config });
    showStatus('Settings saved! Reload tabs for changes to take effect.', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

async function resetAllSettings() {
  const confirmed = confirm('Reset all settings to defaults? This will reload all tabs.');
  if (!confirmed) return;

  try {
    await chrome.storage.local.remove('fpConfig');
    await loadSettings();
    showStatus('Settings reset to defaults', 'success');

    // Reload all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.reload(tab.id);
      }
    });
  } catch (error) {
    console.error('Failed to reset settings:', error);
    showStatus('Failed to reset settings', 'error');
  }
}

async function resetFingerprint() {
  const confirmed = confirm(
    'This will generate a new fingerprint. Sites may see you as a new device. Continue?'
  );
  if (!confirmed) return;

  try {
    await chrome.storage.local.remove('fp_salt');
    showStatus('Fingerprint reset! Reloading all tabs...', 'success');

    // Reload all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.reload(tab.id);
      }
    });
  } catch (error) {
    console.error('Failed to reset fingerprint:', error);
    showStatus('Failed to reset fingerprint', 'error');
  }
}

async function loadWhitelist() {
  try {
    const result = await chrome.storage.local.get(['fp_site_settings']);
    const siteSettings = result.fp_site_settings || {};
    const container = document.getElementById('whitelistContainer');

    // Clear container
    container.textContent = '';

    const disabledSites = Object.entries(siteSettings)
      .filter(([_, settings]) => settings.enabled === false);

    if (disabledSites.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      const p = document.createElement('p');
      p.textContent = 'No whitelisted sites';
      emptyState.appendChild(p);
      container.appendChild(emptyState);
      return;
    }

    disabledSites.forEach(([domain, settings]) => {
      const item = document.createElement('div');
      item.className = 'whitelist-item';

      const info = document.createElement('div');

      const domainEl = document.createElement('div');
      domainEl.className = 'whitelist-domain';
      domainEl.textContent = domain;
      info.appendChild(domainEl);

      if (settings.reason) {
        const reasonEl = document.createElement('div');
        reasonEl.className = 'whitelist-reason';
        reasonEl.textContent = settings.reason;
        info.appendChild(reasonEl);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeFromWhitelist(domain));

      item.appendChild(info);
      item.appendChild(removeBtn);
      container.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to load whitelist:', error);
  }
}

async function addToWhitelist() {
  const input = document.getElementById('newSiteInput');
  const domain = input.value.trim();

  if (!domain) return;

  try {
    const result = await chrome.storage.local.get(['fp_site_settings']);
    const siteSettings = result.fp_site_settings || {};

    siteSettings[domain] = {
      enabled: false,
      reason: 'Added manually'
    };

    await chrome.storage.local.set({ fp_site_settings: siteSettings });
    input.value = '';
    await loadWhitelist();
    showStatus(`Added ${domain} to whitelist`, 'success');
  } catch (error) {
    console.error('Failed to add to whitelist:', error);
    showStatus('Failed to add site', 'error');
  }
}

async function removeFromWhitelist(domain) {
  try {
    const result = await chrome.storage.local.get(['fp_site_settings']);
    const siteSettings = result.fp_site_settings || {};

    delete siteSettings[domain];

    await chrome.storage.local.set({ fp_site_settings: siteSettings });
    await loadWhitelist();
    showStatus(`Removed ${domain} from whitelist`, 'success');
  } catch (error) {
    console.error('Failed to remove from whitelist:', error);
    showStatus('Failed to remove site', 'error');
  }
}

function showStatus(message, type = '') {
  const statusBar = document.getElementById('statusBar');
  const statusMessage = document.getElementById('statusMessage');

  statusMessage.textContent = message;
  statusBar.className = `status-bar ${type}`;

  if (type) {
    setTimeout(() => {
      statusBar.className = 'status-bar';
      statusMessage.textContent = 'Ready';
    }, 3000);
  }
}

function getDefaultConfig() {
  return {
    debug: false,
    enableCanvasNoise: true,
    canvasNoiseStrength: 2,
    enableWebGLMasking: true,
    webglJitter: 2,
    maskWebGLVendorStrings: true,
    shuffleWebGLExtensions: true,
    enableAudioNoise: true,
    audioNoiseStrength: 1e-7,
    enableNavigatorFuzz: true,
    navigator: {
      fuzzHardwareConcurrency: true,
      fuzzDeviceMemory: true,
      shuffleLanguages: true
    },
    perOriginFingerprint: true,
    enableWebRTCProtection: true,
    webrtc: {
      blockIPLeak: true,
      randomizeSDP: true,
      forceRelay: false
    },
    enableMediaDeviceProtection: true,
    mediaDevices: {
      randomizeDeviceIds: true,
      spoofDeviceLabels: true
    },
    enableScreenProtection: true,
    screen: {
      useRealDistribution: true
    },
    enableFontProtection: true,
    enableTimezoneProtection: true,
    enableSensorProtection: true,
    sensors: {
      hideGamepads: true
    },
    useStrongKDF: true,
    kdfIterations: 1000,
    useGaussianNoise: true
  };
}
