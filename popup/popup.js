// Popup script for Browser Fingerprint Shuffler

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const statusDetails = document.getElementById('statusDetails');
  const currentSite = document.getElementById('currentSite');
  const siteToggle = document.getElementById('siteToggle');
  const optionsBtn = document.getElementById('optionsBtn');
  const resetBtn = document.getElementById('resetBtn');
  const sitesProtected = document.getElementById('sitesProtected');
  const totalCalls = document.getElementById('totalCalls');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tab.url);
  const domain = url.hostname;

  // Display current site
  currentSite.textContent = domain;

  // Load settings
  loadSettings();

  // Load stats
  loadStats();

  // Load and display active protections
  loadActiveProtections();

  // Event listeners
  siteToggle.addEventListener('change', handleSiteToggle);
  optionsBtn.addEventListener('click', openOptions);
  resetBtn.addEventListener('click', handleReset);

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(['fp_site_settings']);
      const siteSettings = result.fp_site_settings || {};

      // Check if site is in whitelist (disabled)
      const siteSetting = siteSettings[domain];
      const isEnabled = siteSetting ? siteSetting.enabled !== false : true;

      siteToggle.checked = isEnabled;
      updateStatus(isEnabled);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function loadStats() {
    try {
      const result = await chrome.storage.local.get(['fp_stats']);
      const stats = result.fp_stats || {
        totalCanvasReads: 0,
        totalWebGLCalls: 0,
        sitesProtected: 0,
        lastReset: new Date().toISOString()
      };

      sitesProtected.textContent = stats.sitesProtected || 0;
      const totalIntercepted =
        (stats.totalCanvasReads || 0) +
        (stats.totalWebGLCalls || 0);
      totalCalls.textContent = formatNumber(totalIntercepted);
    } catch (error) {
      console.error('Failed to load stats:', error);
      sitesProtected.textContent = '0';
      totalCalls.textContent = '0';
    }
  }

  async function handleSiteToggle() {
    const isEnabled = siteToggle.checked;

    try {
      const result = await chrome.storage.local.get(['fp_site_settings']);
      const siteSettings = result.fp_site_settings || {};

      if (isEnabled) {
        // Remove from whitelist
        delete siteSettings[domain];
      } else {
        // Add to whitelist (disabled)
        siteSettings[domain] = {
          enabled: false,
          reason: 'Disabled by user'
        };
      }

      await chrome.storage.local.set({ fp_site_settings: siteSettings });

      updateStatus(isEnabled);

      // Reload the tab to apply changes
      chrome.tabs.reload(tab.id);

      // Show confirmation
      showNotification(
        isEnabled ? 'Protection enabled' : 'Protection disabled',
        isEnabled ? 'Reloading page...' : 'Site added to whitelist. Reloading...'
      );
    } catch (error) {
      console.error('Failed to update site settings:', error);
      // Revert toggle on error
      siteToggle.checked = !isEnabled;
    }
  }

  function updateStatus(isEnabled) {
    const dot = statusIndicator.querySelector('.status-dot');

    if (isEnabled) {
      statusText.textContent = 'Protected';
      statusDetails.textContent = 'All fingerprint protections active';
      dot.className = 'status-dot';
    } else {
      statusText.textContent = 'Disabled';
      statusDetails.textContent = 'Protection disabled for this site';
      dot.className = 'status-dot disabled';
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  async function handleReset() {
    const confirmed = confirm(
      'This will generate a new fingerprint. Sites may see you as a new device. Continue?'
    );

    if (!confirmed) return;

    try {
      // Remove the salt to force regeneration
      await chrome.storage.local.remove('fp_salt');

      // Show success message
      showNotification('Fingerprint Reset', 'Your fingerprint has been reset. Reloading tabs...');

      // Reload all tabs to apply new fingerprint
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          chrome.tabs.reload(tab.id);
        }
      });

      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      console.error('Failed to reset fingerprint:', error);
      alert('Failed to reset fingerprint. Please try again.');
    }
  }

  function showNotification(title, message) {
    // Update status temporarily
    const originalText = statusText.textContent;
    const originalDetails = statusDetails.textContent;

    statusText.textContent = title;
    statusDetails.textContent = message;

    setTimeout(() => {
      statusText.textContent = originalText;
      statusDetails.textContent = originalDetails;
    }, 2000);
  }

  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  async function loadActiveProtections() {
    try {
      const result = await chrome.storage.local.get(['fpConfig']);
      const config = result.fpConfig || getDefaultConfig();

      // Map of protection keys to their display info
      const protectionMap = {
        canvas: {
          enabled: config.enableCanvasNoise !== false,
          icon: '🎨',
          name: 'Canvas'
        },
        webgl: {
          enabled: config.enableWebGLMasking !== false,
          icon: '🔺',
          name: 'WebGL'
        },
        audio: {
          enabled: config.enableAudioNoise !== false,
          icon: '🔊',
          name: 'Audio'
        },
        webrtc: {
          enabled: config.enableWebRTCProtection !== false,
          icon: '📡',
          name: 'WebRTC'
        },
        screen: {
          enabled: config.enableScreenProtection !== false,
          icon: '📱',
          name: 'Screen'
        },
        fonts: {
          enabled: config.enableFontProtection !== false,
          icon: '🔤',
          name: 'Fonts'
        },
        timezone: {
          enabled: config.enableTimezoneProtection !== false,
          icon: '🌍',
          name: 'Timezone'
        },
        sensors: {
          enabled: config.enableSensorProtection !== false,
          icon: '📊',
          name: 'Sensors'
        }
      };

      // Get all protection items in the DOM
      const protectionGrid = document.querySelector('.protection-grid');
      if (!protectionGrid) return;

      // Clear existing items safely
      while (protectionGrid.firstChild) {
        protectionGrid.removeChild(protectionGrid.firstChild);
      }

      // Add only enabled protections
      Object.entries(protectionMap).forEach(([key, info]) => {
        if (info.enabled) {
          const item = document.createElement('div');
          item.className = 'protection-item';

          const icon = document.createElement('span');
          icon.className = 'protection-icon';
          icon.textContent = info.icon;

          const name = document.createElement('span');
          name.className = 'protection-name';
          name.textContent = info.name;

          item.appendChild(icon);
          item.appendChild(name);
          protectionGrid.appendChild(item);
        }
      });

      // If no protections are enabled, show a message
      if (protectionGrid.children.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.gridColumn = '1 / -1';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '1rem';
        emptyMsg.style.color = '#666';
        emptyMsg.textContent = 'No protections enabled';
        protectionGrid.appendChild(emptyMsg);
      }
    } catch (error) {
      console.error('Failed to load active protections:', error);
    }
  }

  function getDefaultConfig() {
    return {
      enableCanvasNoise: true,
      enableWebGLMasking: true,
      enableAudioNoise: true,
      enableNavigatorFuzz: true,
      enableWebRTCProtection: true,
      enableMediaDeviceProtection: true,
      enableScreenProtection: true,
      enableFontProtection: true,
      enableTimezoneProtection: true,
      enableSensorProtection: true
    };
  }
});
