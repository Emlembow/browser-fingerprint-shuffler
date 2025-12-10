// Hashing helpers to derive deterministic seeds with PBKDF2-style strengthening.
(function () {
  // FNV-1a hash - fast and good distribution
  function hashString (str) {
    let h1 = 0x811C9DC5;
    for (let i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
      h1 >>>= 0;
    }
    return h1 >>> 0;
  }

  // PBKDF2-style iterative key derivation for stronger seed
  function deriveStrongSeed(baseSalt, origin, iterations = 1000) {
    // Initial mix
    let seed = hashString(String(baseSalt) + String(origin || ""));

    // Iterative strengthening (PBKDF2-like)
    for (let i = 0; i < iterations; i++) {
      // Mix current seed with salt and origin again
      seed = hashString(String(seed) + String(baseSalt) + String(i));
    }

    return seed >>> 0;
  }

  // Legacy derivation for backwards compatibility
  function deriveSeed (baseSalt, origin) {
    const saltHash = hashString(String(baseSalt));
    const originHash = hashString(String(origin || ""));
    return (saltHash ^ originHash) >>> 0;
  }

  // Use strong derivation by default, but allow legacy mode
  function deriveSeedWithConfig(baseSalt, origin) {
    const config = globalThis.fpConfig || {};
    if (config.useStrongKDF !== false) {
      // Default to strong KDF (1000 iterations)
      const iterations = config.kdfIterations || 1000;
      return deriveStrongSeed(baseSalt, origin, iterations);
    }
    // Fallback to simple derivation if disabled
    return deriveSeed(baseSalt, origin);
  }

  globalThis.fpHashString = hashString;
  globalThis.fpDeriveSeed = deriveSeedWithConfig; // Use strong version by default
  globalThis.fpDeriveSeedSimple = deriveSeed; // Expose legacy for testing
  globalThis.fpDeriveStrongSeed = deriveStrongSeed; // Expose strong version directly
})();
