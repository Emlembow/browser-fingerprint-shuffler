// Sensor and performance API protection.
// Protects battery, performance memory, and other sensor APIs.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installSensorHooks (env) {
    if (!env || !env.config?.enableSensorProtection) return;
    const { prng, noise, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][sensors] Hook failed:', e);
      }
    }

    // Battery API protection
    safeWrap(() => {
      if (!navigator.getBattery) return;

      const origGetBattery = navigator.getBattery;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetBattery)) {
        globalThis.fpStealth.markPatched(origGetBattery);

        navigator.getBattery = async function () {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          const battery = await origGetBattery.call(this);

          // Create proxy to modify battery properties
          const spoofedBattery = {
            charging: battery.charging,
            chargingTime: Infinity,
            dischargingTime: Infinity,
            level: Math.max(0.5, Math.min(1.0, 0.75 + noise(0.1))), // Random level around 75%
            onchargingchange: battery.onchargingchange,
            onchargingtimechange: battery.onchargingtimechange,
            ondischargingtimechange: battery.ondischargingtimechange,
            onlevelchange: battery.onlevelchange,
            addEventListener: battery.addEventListener.bind(battery),
            removeEventListener: battery.removeEventListener.bind(battery),
            dispatchEvent: battery.dispatchEvent.bind(battery)
          };

          log('[fp][sensors] Battery API spoofed, level:', spoofedBattery.level.toFixed(2));
          return spoofedBattery;
        };

        log('[fp][sensors] Battery API hooked');
      }
    });

    // Performance memory protection
    safeWrap(() => {
      if (!performance.memory) return;

      const origMemory = performance.memory;
      const baseUsed = origMemory.usedJSHeapSize || 10000000;
      const baseLimit = origMemory.jsHeapSizeLimit || 2172649472;

      // Add noise to memory values
      const noisedMemory = {
        get jsHeapSizeLimit() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }
          return Math.floor(baseLimit + noise(baseLimit * 0.05));
        },
        get totalJSHeapSize() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }
          return Math.floor(baseUsed * 1.5 + noise(baseUsed * 0.1));
        },
        get usedJSHeapSize() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }
          return Math.floor(baseUsed + noise(baseUsed * 0.1));
        }
      };

      try {
        Object.defineProperty(performance, 'memory', {
          get: () => noisedMemory,
          enumerable: true,
          configurable: true
        });
        log('[fp][sensors] performance.memory hooked');
      } catch (e) {
        // May fail in some browsers
      }
    });

    // Performance.now() - add subtle jitter to prevent high-resolution timing
    safeWrap(() => {
      const origNow = performance.now;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origNow)) {
        globalThis.fpStealth.markPatched(origNow);

        let timeOffset = 0;
        performance.now = function () {
          const realTime = origNow.call(this);

          // Add cumulative jitter (0-0.1ms per call)
          timeOffset += prng() * 0.1;

          return realTime + timeOffset;
        };

        log('[fp][sensors] performance.now hooked');
      }
    });

    // Connection API protection (network information)
    safeWrap(() => {
      if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) return;

      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) return;

      const connectionTypes = ['4g', '4g', '4g', 'wifi', 'wifi']; // Weighted
      const spoofedType = connectionTypes[Math.floor(prng() * connectionTypes.length)];
      const spoofedDownlink = spoofedType === 'wifi' ? 10 : 5; // Mbps

      try {
        Object.defineProperty(connection, 'effectiveType', {
          get: () => {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return spoofedType;
          },
          enumerable: true,
          configurable: true
        });

        Object.defineProperty(connection, 'downlink', {
          get: () => {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return spoofedDownlink + noise(1);
          },
          enumerable: true,
          configurable: true
        });

        log(`[fp][sensors] Connection API hooked, type: ${spoofedType}`);
      } catch (e) {
        // May fail in some browsers
      }
    });

    // Keyboard layout detection via KeyboardEvent
    safeWrap(() => {
      const origKeyboardEvent = window.KeyboardEvent;
      if (!origKeyboardEvent) return;

      // This is complex and may break functionality, so just add timing jitter
      const origGetModifierState = KeyboardEvent.prototype.getModifierState;
      if (origGetModifierState && globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetModifierState)) {
        globalThis.fpStealth.markPatched(origGetModifierState);

        KeyboardEvent.prototype.getModifierState = function () {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }
          return origGetModifierState.apply(this, arguments);
        };

        log('[fp][sensors] KeyboardEvent.getModifierState hooked');
      }
    });

    // Gamepad API protection
    safeWrap(() => {
      if (!navigator.getGamepads) return;

      const origGetGamepads = navigator.getGamepads;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetGamepads)) {
        globalThis.fpStealth.markPatched(origGetGamepads);

        navigator.getGamepads = function () {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          const gamepads = origGetGamepads.call(this);

          // Return empty array or null to prevent fingerprinting
          if (config.sensors?.hideGamepads !== false) {
            return [null, null, null, null];
          }

          return gamepads;
        };

        log('[fp][sensors] Gamepad API hooked');
      }
    });

    // Plugin enumeration (legacy, but still used)
    safeWrap(() => {
      // Return empty plugin list
      try {
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            // Return empty array-like object
            return { length: 0 };
          },
          enumerable: true,
          configurable: true
        });

        Object.defineProperty(navigator, 'mimeTypes', {
          get: () => {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            return { length: 0 };
          },
          enumerable: true,
          configurable: true
        });

        log('[fp][sensors] Plugins/mimeTypes hidden');
      } catch (e) {
        // May fail if already defined
      }
    });
  });
})();
