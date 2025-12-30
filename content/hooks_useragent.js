// User agent and platform protection.
// Adds subtle variations to user agent and platform strings.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installUserAgentHooks (env) {
    if (!env || !env.config?.enableUserAgentProtection) return;
    const { prng, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][useragent] Hook failed:', e);
      }
    }

    // Common platform strings
    const platforms = {
      windows: ['Win32', 'Win64'],
      mac: ['MacIntel', 'MacPPC'],
      linux: ['Linux x86_64', 'Linux i686', 'Linux armv7l'],
      other: ['Win32', 'MacIntel'] // Fallback
    };

    // Detect current OS category
    const origPlatform = navigator.platform;
    let platformCategory = 'other';
    if (origPlatform.includes('Win')) platformCategory = 'windows';
    else if (origPlatform.includes('Mac')) platformCategory = 'mac';
    else if (origPlatform.includes('Linux')) platformCategory = 'linux';

    // Select a platform variant from the same category
    const platformOptions = platforms[platformCategory] || platforms.other;
    const spoofedPlatform = platformOptions[Math.floor(prng() * platformOptions.length)];

    log(`[fp][useragent] Original platform: ${origPlatform}, Spoofed: ${spoofedPlatform}`);

    // Hook navigator.platform
    safeWrap(() => {
      try {
        Object.defineProperty(navigator, 'platform', {
          get: function() {
            // Track statistics
            if (globalThis.fpStatsTracker) {
              globalThis.fpStatsTracker.increment('navigatorReads');
            }

            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return spoofedPlatform;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][useragent] navigator.platform hooked');
      } catch (e) {
        if (debug) console.error('[fp][useragent] Failed to hook platform:', e);
      }
    });

    // Hook navigator.userAgent - Add minor version variation
    safeWrap(() => {
      const origUserAgent = navigator.userAgent;

      // Parse Chrome version if present
      const chromeMatch = origUserAgent.match(/Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
      let modifiedUserAgent = origUserAgent;

      if (chromeMatch) {
        // Modify the patch version (last number) slightly
        const [full, major, minor, build, patch] = chromeMatch;
        const patchNum = parseInt(patch);
        const variation = Math.floor(prng() * 5) - 2; // -2 to +2
        const newPatch = Math.max(0, patchNum + variation);

        modifiedUserAgent = origUserAgent.replace(
          `Chrome/${major}.${minor}.${build}.${patch}`,
          `Chrome/${major}.${minor}.${build}.${newPatch}`
        );

        log(`[fp][useragent] Modified Chrome version: ${patch} → ${newPatch}`);
      }

      try {
        Object.defineProperty(navigator, 'userAgent', {
          get: function() {
            // Track statistics
            if (globalThis.fpStatsTracker) {
              globalThis.fpStatsTracker.increment('navigatorReads');
            }

            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return modifiedUserAgent;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][useragent] navigator.userAgent hooked');
      } catch (e) {
        if (debug) console.error('[fp][useragent] Failed to hook userAgent:', e);
      }
    });

    // Hook navigator.appVersion
    safeWrap(() => {
      const origAppVersion = navigator.appVersion;
      const origUserAgent = navigator.userAgent;

      // appVersion is often similar to userAgent
      let modifiedAppVersion = origAppVersion;

      const chromeMatch = origUserAgent.match(/Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
      if (chromeMatch) {
        const [full, major, minor, build, patch] = chromeMatch;
        const patchNum = parseInt(patch);
        const variation = Math.floor(prng() * 5) - 2;
        const newPatch = Math.max(0, patchNum + variation);

        // Apply same modification to appVersion if it contains Chrome version
        if (origAppVersion.includes(`Chrome/${major}.${minor}.${build}.${patch}`)) {
          modifiedAppVersion = origAppVersion.replace(
            `Chrome/${major}.${minor}.${build}.${patch}`,
            `Chrome/${major}.${minor}.${build}.${newPatch}`
          );
        }
      }

      try {
        Object.defineProperty(navigator, 'appVersion', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return modifiedAppVersion;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][useragent] navigator.appVersion hooked');
      } catch (e) {
        if (debug) console.error('[fp][useragent] Failed to hook appVersion:', e);
      }
    });

    // Hook navigator.oscpu (Firefox-specific)
    safeWrap(() => {
      if (!navigator.oscpu) return;

      const origOscpu = navigator.oscpu;

      try {
        Object.defineProperty(navigator, 'oscpu', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            // Keep same OS but slight variation
            return origOscpu;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][useragent] navigator.oscpu hooked');
      } catch (e) {
        // May not be configurable
      }
    });

    // Hook navigator.vendor
    safeWrap(() => {
      const origVendor = navigator.vendor;

      try {
        Object.defineProperty(navigator, 'vendor', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            // Keep same vendor to avoid breaking sites
            return origVendor;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][useragent] navigator.vendor hooked');
      } catch (e) {
        // May not be configurable
      }
    });

    // Hook navigator.userAgentData (Chromium User-Agent Client Hints API)
    safeWrap(() => {
      if (!navigator.userAgentData) return;

      const origUserAgentData = navigator.userAgentData;

      // Create a proxy to intercept getHighEntropyValues
      const handler = {
        get(target, prop) {
          if (prop === 'getHighEntropyValues') {
            const origMethod = target.getHighEntropyValues;
            return async function(hints) {
              if (globalThis.fpTimingUtils) {
                globalThis.fpTimingUtils.randomDelaySync();
              }

              const values = await origMethod.call(target, hints);

              // Add subtle variations to high entropy values
              if (values.platformVersion) {
                // Modify patch version slightly
                const parts = values.platformVersion.split('.');
                if (parts.length > 0) {
                  const lastPart = parseInt(parts[parts.length - 1]);
                  const variation = Math.floor(prng() * 3) - 1;
                  parts[parts.length - 1] = Math.max(0, lastPart + variation);
                  values.platformVersion = parts.join('.');
                  log(`[fp][useragent] Modified platformVersion: ${values.platformVersion}`);
                }
              }

              if (values.fullVersionList && Array.isArray(values.fullVersionList)) {
                // Modify Chrome version in the list
                values.fullVersionList = values.fullVersionList.map(item => {
                  if (item.brand && item.brand.includes('Chrome') && item.version) {
                    const parts = item.version.split('.');
                    if (parts.length >= 4) {
                      const patch = parseInt(parts[3]);
                      const variation = Math.floor(prng() * 5) - 2;
                      parts[3] = Math.max(0, patch + variation);
                      return { ...item, version: parts.join('.') };
                    }
                  }
                  return item;
                });
              }

              return values;
            };
          }

          if (prop === 'brands' && Array.isArray(target.brands)) {
            // Slightly shuffle brand order
            const brands = [...target.brands];
            if (brands.length > 1 && prng() < 0.3) {
              // 30% chance to swap first two
              [brands[0], brands[1]] = [brands[1], brands[0]];
            }
            return brands;
          }

          return target[prop];
        }
      };

      try {
        const proxiedUserAgentData = new Proxy(origUserAgentData, handler);
        Object.defineProperty(navigator, 'userAgentData', {
          get: function() {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return proxiedUserAgentData;
          },
          enumerable: true,
          configurable: true
        });
        log('[fp][useragent] navigator.userAgentData hooked');
      } catch (e) {
        if (debug) console.error('[fp][useragent] Failed to hook userAgentData:', e);
      }
    });
  });
})();
