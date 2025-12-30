// Detection resistance for ad blockers, extensions, and incognito mode.
// Protects against various detection techniques used to identify extensions and privacy tools.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installDetectionResistanceHooks (env) {
    if (!env || !env.config?.enableDetectionResistance) return;
    const { prng, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][detection] Hook failed:', e);
      }
    }

    // Prevent FileSystem API quota checks (incognito detection)
    safeWrap(() => {
      if (!navigator.webkitTemporaryStorage && !navigator.webkitPersistentStorage) return;

      // Hook quota queries that can detect incognito mode
      if (navigator.webkitTemporaryStorage && navigator.webkitTemporaryStorage.queryUsageAndQuota) {
        const origQuery = navigator.webkitTemporaryStorage.queryUsageAndQuota;

        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origQuery)) {
          globalThis.fpStealth.markPatched(origQuery);

          navigator.webkitTemporaryStorage.queryUsageAndQuota = function(successCallback, errorCallback) {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            log('[fp][detection] queryUsageAndQuota called');

            // Wrap success callback to normalize quota values
            const wrappedSuccess = function(usedBytes, grantedBytes) {
              // Normalize quota to appear as normal browsing
              // Incognito typically has lower quota
              const normalizedGranted = Math.max(grantedBytes, 1024 * 1024 * 1024); // At least 1GB
              const normalizedUsed = Math.floor(usedBytes + (prng() * 1024 * 1024)); // Add some random usage

              log(`[fp][detection] Normalized quota: ${grantedBytes} → ${normalizedGranted}`);

              if (successCallback) {
                successCallback(normalizedUsed, normalizedGranted);
              }
            };

            return origQuery.call(this, wrappedSuccess, errorCallback);
          };

          log('[fp][detection] webkitTemporaryStorage.queryUsageAndQuota hooked');
        }
      }
    });

    // Prevent IndexedDB quota detection (incognito detection)
    safeWrap(() => {
      if (!navigator.storage || !navigator.storage.estimate) return;

      const origEstimate = navigator.storage.estimate;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origEstimate)) {
        globalThis.fpStealth.markPatched(origEstimate);

        navigator.storage.estimate = async function() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          const estimate = await origEstimate.call(this);

          // Normalize quota to appear as normal mode
          // Incognito mode often has restricted quota
          if (estimate.quota && estimate.quota < 1024 * 1024 * 1024) {
            estimate.quota = Math.floor(10 * 1024 * 1024 * 1024 + (prng() * 1024 * 1024 * 1024)); // 10-11 GB
            log(`[fp][detection] Normalized storage quota to ${(estimate.quota / 1024 / 1024 / 1024).toFixed(2)} GB`);
          }

          // Add some random usage
          if (estimate.usage !== undefined) {
            estimate.usage = Math.floor(estimate.usage + (prng() * 100 * 1024 * 1024)); // Add 0-100 MB
          }

          return estimate;
        };

        log('[fp][detection] navigator.storage.estimate hooked');
      }
    });

    // Hook permissions API (extension/privacy tool detection)
    safeWrap(() => {
      if (!navigator.permissions || !navigator.permissions.query) return;

      const origQuery = navigator.permissions.query;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origQuery)) {
        globalThis.fpStealth.markPatched(origQuery);

        navigator.permissions.query = async function(permissionDesc) {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          log(`[fp][detection] permissions.query called for ${JSON.stringify(permissionDesc)}`);

          // Call original
          const result = await origQuery.call(this, permissionDesc);

          // Add timing jitter
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.executionJitter();
          }

          return result;
        };

        log('[fp][detection] navigator.permissions.query hooked');
      }
    });

    // Prevent Chrome extension detection via chrome.runtime
    safeWrap(() => {
      // Some sites test for chrome.runtime to detect extensions
      // We can't remove it (extension needs it), but add timing resistance
      if (!window.chrome || !window.chrome.runtime) return;

      const origRuntime = window.chrome.runtime;

      // Wrap common detection methods
      if (origRuntime.sendMessage) {
        const origSendMessage = origRuntime.sendMessage;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origSendMessage)) {
          globalThis.fpStealth.markPatched(origSendMessage);

          window.chrome.runtime.sendMessage = function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return origSendMessage.apply(this, arguments);
          };
        }
      }

      log('[fp][detection] chrome.runtime wrapped with timing resistance');
    });

    // Prevent navigator.webdriver detection (automation detection)
    safeWrap(() => {
      try {
        // Always set webdriver to false/undefined
        Object.defineProperty(navigator, 'webdriver', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return false;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][detection] navigator.webdriver hooked');
      } catch (e) {
        // May already be defined
      }
    });

    // Prevent chrome.app detection (extension detection)
    safeWrap(() => {
      // chrome.app is deprecated but still checked
      if (window.chrome && !window.chrome.app) return;

      try {
        // Remove chrome.app entirely
        delete window.chrome.app;
        log('[fp][detection] Removed chrome.app');
      } catch (e) {
        // May not be configurable
      }
    });

    // Prevent chrome.loadTimes detection (extension/headless detection)
    safeWrap(() => {
      // chrome.loadTimes is deprecated and removed in newer Chrome
      if (!window.chrome || !window.chrome.loadTimes) return;

      try {
        delete window.chrome.loadTimes;
        log('[fp][detection] Removed chrome.loadTimes');
      } catch (e) {
        // May not be configurable
      }
    });

    // Prevent chrome.csi detection (headless/extension detection)
    safeWrap(() => {
      if (!window.chrome || !window.chrome.csi) return;

      try {
        delete window.chrome.csi;
        log('[fp][detection] Removed chrome.csi');
      } catch (e) {
        // May not be configurable
      }
    });

    // Hook Error.stack to prevent extension detection via stack traces
    safeWrap(() => {
      const OrigError = Error;
      const origStackDescriptor = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');

      if (!origStackDescriptor || !origStackDescriptor.get) {
        // Stack might be a simple property, not a getter
        return;
      }

      const origStackGetter = origStackDescriptor.get;

      Object.defineProperty(Error.prototype, 'stack', {
        get: function() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.executionJitter();
          }

          let stack = origStackGetter.call(this);

          // Remove extension URLs from stack traces
          // chrome-extension:// urls can leak extension IDs
          if (stack && typeof stack === 'string') {
            stack = stack.replace(/chrome-extension:\/\/[a-z]{32}/g, 'chrome-extension://[redacted]');
          }

          return stack;
        },
        configurable: true,
        enumerable: false
      });

      log('[fp][detection] Error.stack hooked to hide extension URLs');
    });

    // Prevent resource timing detection (ad blocker detection via blocked requests)
    safeWrap(() => {
      if (!window.performance || !window.performance.getEntriesByType) return;

      const origGetEntriesByType = window.performance.getEntriesByType;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetEntriesByType)) {
        globalThis.fpStealth.markPatched(origGetEntriesByType);

        window.performance.getEntriesByType = function(type) {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          const entries = origGetEntriesByType.call(this, type);

          // Sites check for missing resources to detect ad blockers
          // We don't modify this (would be complex), just add timing resistance
          return entries;
        };

        log('[fp][detection] performance.getEntriesByType hooked');
      }
    });

    // Hook document.hidden and visibilityState (tab focus detection for behavior tracking)
    safeWrap(() => {
      const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      const origVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

      if (origHidden && origHidden.get) {
        const origHiddenGetter = origHidden.get;

        Object.defineProperty(Document.prototype, 'hidden', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.executionJitter();
            }
            return origHiddenGetter.call(this);
          },
          enumerable: true,
          configurable: true
        });
      }

      if (origVisibilityState && origVisibilityState.get) {
        const origVisibilityStateGetter = origVisibilityState.get;

        Object.defineProperty(Document.prototype, 'visibilityState', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.executionJitter();
            }
            return origVisibilityStateGetter.call(this);
          },
          enumerable: true,
          configurable: true
        });
      }

      log('[fp][detection] document.hidden and visibilityState hooked with timing resistance');
    });
  });
})();
