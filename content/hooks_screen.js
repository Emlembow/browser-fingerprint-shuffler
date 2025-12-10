// Screen and display property protection.
// Protects screen dimensions, pixel ratio, color depth to prevent stable fingerprints.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installScreenHooks (env) {
    if (!env || !env.config?.enableScreenProtection) return;
    const { prng, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][screen] Hook failed:', e);
      }
    }

    // Real-world screen resolution distributions
    const commonResolutions = [
      { width: 1920, height: 1080, weight: 0.35 },  // Most common
      { width: 1366, height: 768, weight: 0.15 },
      { width: 2560, height: 1440, weight: 0.12 },
      { width: 1536, height: 864, weight: 0.10 },
      { width: 1440, height: 900, weight: 0.08 },
      { width: 1600, height: 900, weight: 0.07 },
      { width: 3840, height: 2160, weight: 0.05 },  // 4K
      { width: 2880, height: 1800, weight: 0.04 },  // Retina
      { width: 1280, height: 720, weight: 0.04 }
    ];

    // Sample from distribution
    function sampleResolution() {
      const r = prng();
      let cumulative = 0;
      for (const res of commonResolutions) {
        cumulative += res.weight;
        if (r < cumulative) {
          return { width: res.width, height: res.height };
        }
      }
      return { width: 1920, height: 1080 }; // Fallback
    }

    safeWrap(() => {
      const baseWidth = window.screen.width;
      const baseHeight = window.screen.height;
      const basePixelRatio = window.devicePixelRatio || 1;

      // Sample or slightly modify real resolution
      const useRealDistribution = config.screen?.useRealDistribution !== false;
      let spoofedResolution;

      if (useRealDistribution) {
        spoofedResolution = sampleResolution();
      } else {
        // Slight modification of actual resolution
        const widthOffset = Math.floor((prng() - 0.5) * 100);
        const heightOffset = Math.floor((prng() - 0.5) * 100);
        spoofedResolution = {
          width: Math.max(800, baseWidth + widthOffset),
          height: Math.max(600, baseHeight + heightOffset)
        };
      }

      // Determine pixel ratio (1 for normal, 2 for retina/hi-DPI)
      const spoofedPixelRatio = spoofedResolution.width >= 2560 ? 2 : 1;

      // Common color depths: 24 (most common), 30, 32
      const colorDepths = [24, 24, 24, 30, 32]; // Weighted toward 24
      const spoofedColorDepth = colorDepths[Math.floor(prng() * colorDepths.length)];

      log(`[fp][screen] Original: ${baseWidth}x${baseHeight}, Spoofed: ${spoofedResolution.width}x${spoofedResolution.height}`);
      log(`[fp][screen] Pixel ratio: ${basePixelRatio} → ${spoofedPixelRatio}, Color depth: ${spoofedColorDepth}`);

      // Helper to define non-configurable getter
      function defineGetter(obj, prop, getter) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
          if (descriptor && !descriptor.configurable) {
            log(`[fp][screen] Cannot redefine non-configurable property: ${prop}`);
            return;
          }

          Object.defineProperty(obj, prop, {
            get: function() {
              if (globalThis.fpTimingUtils) {
                globalThis.fpTimingUtils.randomDelaySync();
                globalThis.fpTimingUtils.executionJitter();
              }
              return getter.call(this);
            },
            enumerable: true,
            configurable: false
          });
        } catch (e) {
          log(`[fp][screen] Failed to define ${prop}:`, e.message);
        }
      }

      // Screen width and height
      defineGetter(window.screen, 'width', () => spoofedResolution.width);
      defineGetter(window.screen, 'height', () => spoofedResolution.height);

      // Available width/height (usually same as width/height minus taskbar)
      const availOffset = 40; // Typical taskbar height
      defineGetter(window.screen, 'availWidth', () => spoofedResolution.width);
      defineGetter(window.screen, 'availHeight', () => spoofedResolution.height - availOffset);

      // Color depth and pixel depth
      defineGetter(window.screen, 'colorDepth', () => spoofedColorDepth);
      defineGetter(window.screen, 'pixelDepth', () => spoofedColorDepth);

      // Device pixel ratio
      defineGetter(window, 'devicePixelRatio', () => spoofedPixelRatio);

      // Screen orientation (if exists)
      if (window.screen.orientation) {
        const origOrientation = window.screen.orientation.type;
        defineGetter(window.screen.orientation, 'type', () => {
          // Keep original orientation but add consistency
          return origOrientation;
        });
      }

      // Inner/outer width and height should be consistent with screen
      // But we'll keep them close to actual to avoid breaking layouts
      const innerWidthBase = window.innerWidth;
      const innerHeightBase = window.innerHeight;

      // Only modify slightly to maintain consistency
      defineGetter(window, 'innerWidth', () => {
        return Math.min(innerWidthBase, spoofedResolution.width);
      });

      defineGetter(window, 'innerHeight', () => {
        return Math.min(innerHeightBase, spoofedResolution.height - availOffset);
      });

      log('[fp][screen] Screen properties hooked successfully');
    });
  });
})();
