// Deterministic pseudo-random generator (Xoshiro128**).
// Stronger than Mulberry32, produces stable noise for a given seed.
// Based on xoshiro128** by Blackman and Vigna.
(function () {
  // Xoshiro128** - High quality, fast PRNG
  function createPRNG (seed) {
    // Initialize state using SplitMix32
    function splitmix32(a) {
      return function() {
        a |= 0;
        a = a + 0x9e3779b9 | 0;
        let t = a ^ a >>> 16;
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15;
        t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
      };
    }

    const smix = splitmix32(seed >>> 0);
    const state = new Uint32Array(4);
    state[0] = (smix() * 0xFFFFFFFF) >>> 0;
    state[1] = (smix() * 0xFFFFFFFF) >>> 0;
    state[2] = (smix() * 0xFFFFFFFF) >>> 0;
    state[3] = (smix() * 0xFFFFFFFF) >>> 0;

    // Rotl helper
    function rotl(x, k) {
      return ((x << k) | (x >>> (32 - k))) >>> 0;
    }

    return function next() {
      const result = rotl(Math.imul(state[1], 5), 7) * 9;
      const t = (state[1] << 9) >>> 0;

      state[2] ^= state[0];
      state[3] ^= state[1];
      state[1] ^= state[2];
      state[0] ^= state[3];
      state[2] ^= t;
      state[3] = rotl(state[3], 11);

      return (result >>> 0) / 4294967296;
    };
  }

  // Also keep legacy Mulberry32 for backwards compatibility testing
  function createMulberry32PRNG(seed) {
    let state = seed >>> 0;
    return function next() {
      state |= 0;
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  globalThis.fpCreatePRNG = createPRNG;
  globalThis.fpCreateMulberry32 = createMulberry32PRNG; // For testing
})();
