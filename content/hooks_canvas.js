// Canvas fingerprint mutation using deterministic noise.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installCanvasHooks (env) {
    if (!env || !env.config?.enableCanvasNoise) return;

    const noiseStrength = env.config.canvasNoiseStrength ?? 0.6;
    const noise = env.noise;

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        // Best-effort; avoid breaking the page
      }
    }

    safeWrap(() => {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

      function noisedImageData (ctx, x, y, w, h) {
        // Track statistics
        if (globalThis.fpStatsTracker) {
          globalThis.fpStatsTracker.increment('canvasReads');
        }

        // Add timing resistance
        if (globalThis.fpTimingUtils) {
          globalThis.fpTimingUtils.randomDelaySync();
          globalThis.fpTimingUtils.executionJitter();
        }

        const imgData = origGetImageData.call(ctx, x, y, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] += noise(noiseStrength);
          data[i + 1] += noise(noiseStrength);
          data[i + 2] += noise(noiseStrength);
        }

        // Add exit jitter
        if (globalThis.fpTimingUtils) {
          globalThis.fpTimingUtils.executionJitter();
        }

        return imgData;
      }

      CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
        return noisedImageData(this, x, y, w, h);
      };

      HTMLCanvasElement.prototype.toDataURL = function () {
        try {
          const ctx = this.getContext("2d");
          if (ctx && origGetImageData) {
            const imgData = noisedImageData(ctx, 0, 0, this.width, this.height);
            ctx.putImageData(imgData, 0, 0);
          }
        } catch (e) { /* ignore */ }
        return origToDataURL.apply(this, arguments);
      };

      HTMLCanvasElement.prototype.toBlob = function () {
        try {
          const ctx = this.getContext("2d");
          if (ctx && origGetImageData) {
            const imgData = noisedImageData(ctx, 0, 0, this.width, this.height);
            ctx.putImageData(imgData, 0, 0);
          }
        } catch (e) { /* ignore */ }
        return origToBlob.apply(this, arguments);
      };
    });
  });
})();
