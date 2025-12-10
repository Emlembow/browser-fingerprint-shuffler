// Audio fingerprint mutation: add deterministic noise to channel data.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installAudioHooks (env) {
    if (!env || !env.config?.enableAudioNoise) return;
    const { noise, config } = env;
    const strength = config.audioNoiseStrength ?? 1e-7;

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) { /* ignore */ }
    }

    safeWrap(() => {
      const AudioBufferProto = window.AudioBuffer && window.AudioBuffer.prototype;
      if (!AudioBufferProto || !AudioBufferProto.getChannelData) return;

      const origGetChannelData = AudioBufferProto.getChannelData;
      AudioBufferProto.getChannelData = function () {
        // Track statistics
        if (globalThis.fpStatsTracker) {
          globalThis.fpStatsTracker.increment('audioCalls');
        }

        // Add timing resistance
        if (globalThis.fpTimingUtils) {
          globalThis.fpTimingUtils.randomDelaySync();
          globalThis.fpTimingUtils.executionJitter();
        }

        const data = origGetChannelData.apply(this, arguments);
        const copy = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
          copy[i] = data[i] + noise(strength);
        }

        // Add exit jitter
        if (globalThis.fpTimingUtils) {
          globalThis.fpTimingUtils.executionJitter();
        }

        return copy;
      };
    });
  });
})();
