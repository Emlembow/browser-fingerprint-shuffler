// Background service worker for Browser Fingerprint Shuffler
// Handles statistics tracking, aggregation, and automatic fingerprint rotation

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  await checkAndRotateFingerprint();
  await setupRotationAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await checkRotateOnStartup();
  await setupRotationAlarm();
});

// Initialize statistics storage
async function initializeStorage() {
  const result = await chrome.storage.local.get(['fp_stats', 'fp_rotation_info']);

  if (!result.fp_stats) {
    await chrome.storage.local.set({
      fp_stats: {
        sitesProtectedArray: [],
        sitesProtected: 0,
        totalCanvasReads: 0,
        totalWebGLCalls: 0,
        totalAudioCalls: 0,
        totalNavigatorReads: 0,
        totalWebRTCCalls: 0,
        totalScreenReads: 0,
        totalFontReads: 0,
        totalTimezoneReads: 0,
        totalSensorReads: 0,
        lastReset: new Date().toISOString()
      }
    });
  }

  if (!result.fp_rotation_info) {
    await chrome.storage.local.set({
      fp_rotation_info: {
        lastRotation: new Date().toISOString(),
        rotationCount: 0
      }
    });
  }
}

// Listen for statistics updates from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_STATS') {
    updateStatistics(message.data, sender.tab?.url).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to update statistics:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_STATS') {
    getStatistics().then(stats => {
      sendResponse({ success: true, stats });
    }).catch(error => {
      console.error('Failed to get statistics:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'RESET_STATS') {
    resetStatistics().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to reset statistics:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'GET_ROTATION_STATUS') {
    getRotationStatus().then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      console.error('Failed to get rotation status:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'ROTATE_NOW') {
    rotateFingerprintNow().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to rotate fingerprint:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'UPDATE_ROTATION_CONFIG') {
    setupRotationAlarm().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to update rotation config:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

async function updateStatistics(data, tabUrl) {
  try {
    const result = await chrome.storage.local.get(['fp_stats']);
    let stats = result.fp_stats || {};

    // Convert Set to Array for storage, then back to Set
    let sitesProtected = new Set(stats.sitesProtectedArray || []);

    // Add current origin to sites protected
    if (tabUrl) {
      try {
        const origin = new URL(tabUrl).origin;
        sitesProtected.add(origin);
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Update counters
    stats = {
      sitesProtectedArray: Array.from(sitesProtected),
      sitesProtected: sitesProtected.size,
      totalCanvasReads: (stats.totalCanvasReads || 0) + (data.canvasReads || 0),
      totalWebGLCalls: (stats.totalWebGLCalls || 0) + (data.webglCalls || 0),
      totalAudioCalls: (stats.totalAudioCalls || 0) + (data.audioCalls || 0),
      totalNavigatorReads: (stats.totalNavigatorReads || 0) + (data.navigatorReads || 0),
      totalWebRTCCalls: (stats.totalWebRTCCalls || 0) + (data.webrtcCalls || 0),
      totalScreenReads: (stats.totalScreenReads || 0) + (data.screenReads || 0),
      totalFontReads: (stats.totalFontReads || 0) + (data.fontReads || 0),
      totalTimezoneReads: (stats.totalTimezoneReads || 0) + (data.timezoneReads || 0),
      totalSensorReads: (stats.totalSensorReads || 0) + (data.sensorReads || 0),
      lastUpdate: new Date().toISOString(),
      lastReset: stats.lastReset || new Date().toISOString()
    };

    await chrome.storage.local.set({ fp_stats: stats });
  } catch (error) {
    console.error('Error updating statistics:', error);
    throw error;
  }
}

async function getStatistics() {
  const result = await chrome.storage.local.get(['fp_stats']);
  const stats = result.fp_stats || {};

  // Ensure sitesProtected is a number
  if (!stats.sitesProtected && stats.sitesProtectedArray) {
    stats.sitesProtected = stats.sitesProtectedArray.length;
  }

  return stats;
}

async function resetStatistics() {
  await chrome.storage.local.set({
    fp_stats: {
      sitesProtectedArray: [],
      sitesProtected: 0,
      totalCanvasReads: 0,
      totalWebGLCalls: 0,
      totalAudioCalls: 0,
      totalNavigatorReads: 0,
      totalWebRTCCalls: 0,
      totalScreenReads: 0,
      totalFontReads: 0,
      totalTimezoneReads: 0,
      totalSensorReads: 0,
      lastReset: new Date().toISOString()
    }
  });
}

// ============================================================================
// AUTOMATIC FINGERPRINT ROTATION
// ============================================================================

// Check if fingerprint should be rotated on startup
async function checkRotateOnStartup() {
  const result = await chrome.storage.local.get(['fpConfig']);
  const config = result.fpConfig || {};

  if (config.rotateOnStartup === true) {
    console.log('[FP Rotation] Rotating fingerprint on startup');
    await rotateFingerprintNow();
  }
}

// Check if scheduled rotation is needed
async function checkAndRotateFingerprint() {
  const result = await chrome.storage.local.get(['fpConfig', 'fp_rotation_info']);
  const config = result.fpConfig || {};
  const rotationInfo = result.fp_rotation_info || {};

  if (!config.autoRotateFingerprint) {
    return; // Auto-rotation disabled
  }

  const intervalHours = config.rotationIntervalHours || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const lastRotation = rotationInfo.lastRotation ? new Date(rotationInfo.lastRotation) : new Date(0);
  const now = new Date();
  const timeSinceRotation = now - lastRotation;

  if (timeSinceRotation >= intervalMs) {
    console.log(`[FP Rotation] Time for scheduled rotation (${intervalHours}h interval)`);
    await rotateFingerprintNow();
  } else {
    const nextRotation = new Date(lastRotation.getTime() + intervalMs);
    const timeUntil = nextRotation - now;
    console.log(`[FP Rotation] Next rotation in ${Math.round(timeUntil / 1000 / 60)} minutes`);
  }
}

// Setup alarm to periodically check for rotation
async function setupRotationAlarm() {
  // Clear any existing alarms
  await chrome.alarms.clear('fingerprint-rotation-check');

  const result = await chrome.storage.local.get(['fpConfig']);
  const config = result.fpConfig || {};

  if (config.autoRotateFingerprint) {
    // Check every hour if rotation is needed
    await chrome.alarms.create('fingerprint-rotation-check', {
      periodInMinutes: 60
    });
    console.log('[FP Rotation] Rotation alarm set (checks every 60 minutes)');
  }
}

// Listen for alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'fingerprint-rotation-check') {
    await checkAndRotateFingerprint();
  }
});

// Perform fingerprint rotation
async function rotateFingerprintNow() {
  try {
    // Generate new salt (removes old one, forcing regeneration)
    await chrome.storage.local.remove('fp_salt');

    // Update rotation info
    const result = await chrome.storage.local.get(['fp_rotation_info']);
    const rotationInfo = result.fp_rotation_info || {};

    await chrome.storage.local.set({
      fp_rotation_info: {
        lastRotation: new Date().toISOString(),
        rotationCount: (rotationInfo.rotationCount || 0) + 1
      }
    });

    console.log('[FP Rotation] Fingerprint rotated successfully');

    // Reload all tabs to apply new fingerprint
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          await chrome.tabs.reload(tab.id);
        } catch (e) {
          // Tab might not be reloadable, skip
        }
      }
    }

    // Send notification
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.jpg'),
        title: 'Fingerprint Rotated',
        message: 'Your browser fingerprint has been automatically rotated.',
        priority: 1
      });
    } catch (e) {
      // Notifications might not be available
    }
  } catch (error) {
    console.error('[FP Rotation] Failed to rotate fingerprint:', error);
  }
}

// Get rotation status (for UI)
async function getRotationStatus() {
  const result = await chrome.storage.local.get(['fpConfig', 'fp_rotation_info']);
  const config = result.fpConfig || {};
  const rotationInfo = result.fp_rotation_info || {};

  if (!config.autoRotateFingerprint) {
    return {
      enabled: false,
      nextRotation: null,
      lastRotation: rotationInfo.lastRotation || null,
      rotationCount: rotationInfo.rotationCount || 0
    };
  }

  const intervalHours = config.rotationIntervalHours || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const lastRotation = rotationInfo.lastRotation ? new Date(rotationInfo.lastRotation) : new Date();
  const nextRotation = new Date(lastRotation.getTime() + intervalMs);

  return {
    enabled: true,
    intervalHours,
    nextRotation: nextRotation.toISOString(),
    lastRotation: rotationInfo.lastRotation || null,
    rotationCount: rotationInfo.rotationCount || 0,
    rotateOnStartup: config.rotateOnStartup || false
  };
}
