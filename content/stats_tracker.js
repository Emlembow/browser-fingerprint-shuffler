// Statistics tracker for content scripts
// Batches statistics updates and sends them to the background script

(function () {
  'use strict';

  // Local counters (batched before sending)
  const localStats = {
    canvasReads: 0,
    webglCalls: 0,
    audioCalls: 0,
    navigatorReads: 0,
    webrtcCalls: 0,
    screenReads: 0,
    fontReads: 0,
    timezoneReads: 0,
    sensorReads: 0
  };

  let flushTimeout = null;
  const FLUSH_INTERVAL = 2000; // Send updates every 2 seconds

  // Increment a statistic counter
  function increment(category) {
    if (localStats.hasOwnProperty(category)) {
      localStats[category]++;
      scheduleFlush();
    }
  }

  // Schedule a flush of statistics to background
  function scheduleFlush() {
    if (flushTimeout) return; // Already scheduled

    flushTimeout = setTimeout(() => {
      flushStats();
      flushTimeout = null;
    }, FLUSH_INTERVAL);
  }

  // Flush statistics to background script
  function flushStats() {
    // Check if there are any updates to send
    const hasUpdates = Object.values(localStats).some(count => count > 0);
    if (!hasUpdates) return;

    // Create a copy of current stats
    const statsToSend = { ...localStats };

    // Reset local counters
    Object.keys(localStats).forEach(key => {
      localStats[key] = 0;
    });

    // Send to background
    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_STATS',
        data: statsToSend
      }).catch(error => {
        // Extension context might be invalid, ignore
        if (globalThis.fpConfig?.debug) {
          console.warn('[FP Stats] Failed to send stats:', error);
        }
      });
    } catch (error) {
      // Ignore errors (extension might be reloading)
      if (globalThis.fpConfig?.debug) {
        console.warn('[FP Stats] Failed to send stats:', error);
      }
    }
  }

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flushStats();
  });

  // Export to global scope
  globalThis.fpStatsTracker = {
    increment,
    flush: flushStats
  };
})();
