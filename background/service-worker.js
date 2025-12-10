// Background service worker for Browser Fingerprint Shuffler
// Handles statistics tracking and aggregation

// Initialize statistics on install
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['fp_stats']);
  if (!result.fp_stats) {
    await chrome.storage.local.set({
      fp_stats: {
        sitesProtected: new Set(),
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
});

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
