// Timing utilities to prevent timing attack detection.
// Adds random micro-delays and execution path variations to make
// hook operations timing-resistant.
(function () {
  let prng = null;

  // Initialize with PRNG after bootstrap
  function initTimingUtils(prngFunction) {
    prng = prngFunction;
  }

  // Add random micro-delay (0-5ms) to prevent timing measurements
  async function randomDelay() {
    if (!prng) return;
    const delay = Math.floor(prng() * 5); // 0-5ms
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Synchronous random delay using busy-wait (for synchronous operations)
  function randomDelaySync() {
    if (!prng) return;
    const delay = prng() * 2; // 0-2ms for sync operations
    if (delay > 0.5) {
      const start = performance.now();
      while (performance.now() - start < delay) {
        // Busy wait - prevents async scheduling timing leaks
      }
    }
  }

  // Add random execution path jitter
  function executionJitter() {
    if (!prng) return;
    // Perform random number of no-op operations
    const iterations = Math.floor(prng() * 10);
    let dummy = 0;
    for (let i = 0; i < iterations; i++) {
      dummy += Math.sqrt(i + 1);
    }
    return dummy; // Return to prevent optimization
  }

  // Wrap a function with timing resistance
  function timingResistant(fn, async = false) {
    if (async) {
      return async function (...args) {
        await randomDelay();
        executionJitter();
        const result = await fn.apply(this, args);
        await randomDelay();
        return result;
      };
    } else {
      return function (...args) {
        randomDelaySync();
        executionJitter();
        const result = fn.apply(this, args);
        return result;
      };
    }
  }

  // Expose globally for hook modules
  globalThis.fpTimingUtils = {
    init: initTimingUtils,
    randomDelay,
    randomDelaySync,
    executionJitter,
    timingResistant
  };
})();
