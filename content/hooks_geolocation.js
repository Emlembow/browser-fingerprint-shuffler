// Geolocation API protection.
// Adds noise to geolocation coordinates to prevent precise location tracking.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installGeolocationHooks (env) {
    if (!env || !env.config?.enableGeolocationProtection) return;
    const { prng, noise, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][geolocation] Hook failed:', e);
      }
    }

    // Configurable noise levels (in degrees)
    // ~1km = 0.01 degrees, ~100m = 0.001 degrees, ~10m = 0.0001 degrees
    const noiseLevel = config.geolocation?.noiseLevel || 0.001; // Default ~100m

    function addNoiseToCoordinates(coords) {
      // Add Gaussian noise to latitude and longitude
      const latNoise = noise(noiseLevel);
      const lonNoise = noise(noiseLevel);

      return {
        latitude: coords.latitude + latNoise,
        longitude: coords.longitude + lonNoise,
        altitude: coords.altitude, // Keep altitude as-is
        accuracy: coords.accuracy ? coords.accuracy + Math.abs(latNoise * 111000) : coords.accuracy, // Adjust accuracy
        altitudeAccuracy: coords.altitudeAccuracy,
        heading: coords.heading,
        speed: coords.speed
      };
    }

    // Hook navigator.geolocation.getCurrentPosition
    safeWrap(() => {
      if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) return;

      const origGetCurrentPosition = navigator.geolocation.getCurrentPosition;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetCurrentPosition)) {
        globalThis.fpStealth.markPatched(origGetCurrentPosition);

        navigator.geolocation.getCurrentPosition = function(successCallback, errorCallback, options) {
          // Track statistics
          if (globalThis.fpStatsTracker) {
            globalThis.fpStatsTracker.increment('geolocationReads');
          }

          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          log('[fp][geolocation] getCurrentPosition called');

          // Wrap the success callback to modify coordinates
          const wrappedSuccess = function(position) {
            // Create a modified position object
            const noisedCoords = addNoiseToCoordinates(position.coords);

            const modifiedPosition = {
              coords: noisedCoords,
              timestamp: position.timestamp
            };

            log(`[fp][geolocation] Added noise: lat ${position.coords.latitude.toFixed(6)} → ${noisedCoords.latitude.toFixed(6)}, ` +
                `lon ${position.coords.longitude.toFixed(6)} → ${noisedCoords.longitude.toFixed(6)}`);

            // Call original success callback with modified position
            if (successCallback) {
              successCallback(modifiedPosition);
            }
          };

          // Call original with wrapped callback
          return origGetCurrentPosition.call(this, wrappedSuccess, errorCallback, options);
        };

        log('[fp][geolocation] getCurrentPosition hooked');
      }
    });

    // Hook navigator.geolocation.watchPosition
    safeWrap(() => {
      if (!navigator.geolocation || !navigator.geolocation.watchPosition) return;

      const origWatchPosition = navigator.geolocation.watchPosition;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origWatchPosition)) {
        globalThis.fpStealth.markPatched(origWatchPosition);

        navigator.geolocation.watchPosition = function(successCallback, errorCallback, options) {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          log('[fp][geolocation] watchPosition called');

          // Wrap the success callback
          const wrappedSuccess = function(position) {
            const noisedCoords = addNoiseToCoordinates(position.coords);

            const modifiedPosition = {
              coords: noisedCoords,
              timestamp: position.timestamp
            };

            log(`[fp][geolocation] watchPosition: Added noise to coordinates`);

            if (successCallback) {
              successCallback(modifiedPosition);
            }
          };

          return origWatchPosition.call(this, wrappedSuccess, errorCallback, options);
        };

        log('[fp][geolocation] watchPosition hooked');
      }
    });

    // Hook GeolocationCoordinates (if accessible)
    // This is more of a fallback in case direct access is attempted
    safeWrap(() => {
      if (!window.GeolocationCoordinates) return;

      const proto = window.GeolocationCoordinates.prototype;
      const latDescriptor = Object.getOwnPropertyDescriptor(proto, 'latitude');
      const lonDescriptor = Object.getOwnPropertyDescriptor(proto, 'longitude');

      if (!latDescriptor || !lonDescriptor) return;

      // Store original getters
      const origLatGetter = latDescriptor.get;
      const origLonGetter = lonDescriptor.get;

      if (!origLatGetter || !origLonGetter) return;

      // Create a WeakMap to store noise per coordinate object
      const noiseMap = new WeakMap();

      Object.defineProperty(proto, 'latitude', {
        get: function() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          const originalLat = origLatGetter.call(this);

          // Get or create noise for this object
          if (!noiseMap.has(this)) {
            noiseMap.set(this, {
              latNoise: noise(noiseLevel),
              lonNoise: noise(noiseLevel)
            });
          }

          const noiseData = noiseMap.get(this);
          return originalLat + noiseData.latNoise;
        },
        enumerable: true,
        configurable: true
      });

      Object.defineProperty(proto, 'longitude', {
        get: function() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }

          const originalLon = origLonGetter.call(this);

          if (!noiseMap.has(this)) {
            noiseMap.set(this, {
              latNoise: noise(noiseLevel),
              lonNoise: noise(noiseLevel)
            });
          }

          const noiseData = noiseMap.get(this);
          return originalLon + noiseData.lonNoise;
        },
        enumerable: true,
        configurable: true
      });

      log('[fp][geolocation] GeolocationCoordinates prototype hooked');
    });
  });
})();
