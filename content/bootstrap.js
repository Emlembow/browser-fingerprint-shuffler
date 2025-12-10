// Bootstrap: load salt, derive seed, initialize PRNG/noise helpers.
(function () {
  const readyPromise = (async () => {
    try {
      const getSalt = globalThis.fpGetSalt;
      const deriveSeed = globalThis.fpDeriveSeed;
      const hashString = globalThis.fpHashString;
      const createPRNG = globalThis.fpCreatePRNG;
      const config = globalThis.fpConfig || {};

      if (!getSalt || !deriveSeed || !hashString || !createPRNG) {
        throw new Error("Fingerprint bootstrap missing prerequisites");
      }

      const salt = await getSalt();
      const baseSeed = hashString(String(salt));
      const seed = config.perOriginFingerprint ? deriveSeed(salt, location.origin) : baseSeed;
      const prng = createPRNG(seed);

      // Uniform noise distribution
      const uniformNoise = (scale = 1) => (prng() - 0.5) * scale;

      // Gaussian/Normal noise distribution (Box-Muller transform)
      // More natural and harder to detect statistically
      let spareGaussian = null;
      const gaussianNoise = (mean = 0, stddev = 1) => {
        if (spareGaussian !== null) {
          const value = spareGaussian;
          spareGaussian = null;
          return mean + stddev * value;
        }

        const u1 = prng();
        const u2 = prng();
        const radius = Math.sqrt(-2 * Math.log(u1));
        const theta = 2 * Math.PI * u2;

        spareGaussian = radius * Math.sin(theta);
        return mean + stddev * (radius * Math.cos(theta));
      };

      // Choose noise function based on config
      const noise = config.useGaussianNoise
        ? (scale = 1) => gaussianNoise(0, scale)
        : uniformNoise;

      // Initialize timing utilities with PRNG for timing attack resistance
      if (globalThis.fpTimingUtils) {
        globalThis.fpTimingUtils.init(prng);
      }

      const env = { salt, seed, prng, noise, gaussianNoise, uniformNoise, config };

      globalThis.fpPRNG = prng;
      globalThis.fpNoise = noise;
      globalThis.fpEnv = env;

      return env;
    } catch (e) {
      // Fail closed: do not break the page if bootstrap fails.
      return null;
    }
  })();

  globalThis.fpReady = readyPromise;
})();
