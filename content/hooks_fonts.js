// Font fingerprinting protection.
// Protects against font enumeration and canvas font measurement techniques.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installFontHooks (env) {
    if (!env || !env.config?.enableFontProtection) return;
    const { prng, noise, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][fonts] Hook failed:', e);
      }
    }

    // Hook canvas text measurement (used for font fingerprinting)
    safeWrap(() => {
      const CanvasProto = CanvasRenderingContext2D.prototype;
      if (!CanvasProto.measureText) return;

      const origMeasureText = CanvasProto.measureText;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origMeasureText)) {
        globalThis.fpStealth.markPatched(origMeasureText);

        CanvasProto.measureText = function (text) {
          // Track statistics
          if (globalThis.fpStatsTracker) {
            globalThis.fpStatsTracker.increment('fontReads');
          }

          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
            globalThis.fpTimingUtils.executionJitter();
          }

          const metrics = origMeasureText.call(this, text);

          // Add slight noise to all metrics
          const noiseFactor = 0.01; // 1% variation

          const noisedMetrics = {
            width: metrics.width + noise(metrics.width * noiseFactor),
            actualBoundingBoxLeft: metrics.actualBoundingBoxLeft + noise(noiseFactor),
            actualBoundingBoxRight: metrics.actualBoundingBoxRight + noise(noiseFactor),
            actualBoundingBoxAscent: metrics.actualBoundingBoxAscent + noise(noiseFactor),
            actualBoundingBoxDescent: metrics.actualBoundingBoxDescent + noise(noiseFactor),
            fontBoundingBoxAscent: metrics.fontBoundingBoxAscent + noise(noiseFactor),
            fontBoundingBoxDescent: metrics.fontBoundingBoxDescent + noise(noiseFactor),
            alphabeticBaseline: metrics.alphabeticBaseline,
            hangingBaseline: metrics.hangingBaseline,
            ideographicBaseline: metrics.ideographicBaseline,
            emHeightAscent: metrics.emHeightAscent,
            emHeightDescent: metrics.emHeightDescent
          };

          log('[fp][fonts] measureText noised:', text.substring(0, 20));
          return noisedMetrics;
        };

        log('[fp][fonts] measureText hooked');
      }
    });

    // Hook FontFaceSet.check() to prevent font enumeration
    safeWrap(() => {
      if (!document.fonts || !document.fonts.check) return;

      const origCheck = document.fonts.check;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origCheck)) {
        globalThis.fpStealth.markPatched(origCheck);

        document.fonts.check = function (font, text) {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
            globalThis.fpTimingUtils.executionJitter();
          }

          // Call original but add randomness to prevent font enumeration
          const result = origCheck.call(this, font, text);

          // Occasionally flip the result for uncommon fonts
          if (prng() < 0.1) { // 10% chance
            log('[fp][fonts] check() result flipped for:', font);
            return !result;
          }

          return result;
        };

        log('[fp][fonts] FontFaceSet.check hooked');
      }
    });

    // Hook document.fonts iteration
    safeWrap(() => {
      if (!document.fonts) return;

      const origFonts = document.fonts;
      const fontArray = Array.from(origFonts);

      // Shuffle font order deterministically
      const shuffledFonts = fontArray.slice();
      for (let i = shuffledFonts.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [shuffledFonts[i], shuffledFonts[j]] = [shuffledFonts[j], shuffledFonts[i]];
      }

      // Override iterator
      try {
        Object.defineProperty(document.fonts, Symbol.iterator, {
          value: function* () {
            yield* shuffledFonts;
          },
          writable: false,
          enumerable: false,
          configurable: true
        });
        log('[fp][fonts] Font iterator shuffled');
      } catch (e) {
        // May fail in some browsers
      }
    });
  });
})();
