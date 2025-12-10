// Page-world WebGL patcher injected by content/hooks_webgl.js.
(function () {
  const current = document.currentScript;
  if (!current) return;

  const jitter = parseFloat(current.dataset.fpJitter || "1");
  const maskVendors = current.dataset.fpMaskVendors === "true";
  const shuffleExt = current.dataset.fpShuffleExt === "true";
  const debug = current.dataset.fpDebug === "true";
  const baseSeed = Number(current.dataset.fpSeed || 0) >>> 0;

  function log () {
    if (debug) console.log.apply(console, arguments);
  }

  // Xoshiro128** PRNG - matches core/prng.js
  function createPRNG (seed) {
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

  const prng = createPRNG((baseSeed ^ 0x9E3779B9) >>> 0);

  // Gaussian noise using Box-Muller transform
  let spareGaussian = null;
  function gaussianNoise(mean, stddev) {
    mean = mean || 0;
    stddev = stddev || 1;

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
  }

  // Use Gaussian noise for more natural distribution
  function noise (scale) {
    return gaussianNoise(0, scale || 1);
  }

  // Minimal timing resistance for page context
  function executionJitter() {
    const iterations = Math.floor(prng() * 10);
    let dummy = 0;
    for (let i = 0; i < iterations; i++) {
      dummy += Math.sqrt(i + 1);
    }
    return dummy;
  }

  function deterministicShuffle (arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Use Symbol-based tracking instead of __fp_patched
  const patchedMarker = Symbol('fp.patched');
  const patchedFunctions = new WeakMap();

  function isPatched(fn) {
    return patchedFunctions.has(fn) || fn[patchedMarker] === true;
  }

  function markPatched(fn) {
    try {
      patchedFunctions.set(fn, true);
    } catch (e) {
      try {
        fn[patchedMarker] = true;
      } catch (e2) { /* ignore */ }
    }
  }

  function patch (proto) {
    if (!proto || !proto.getParameter) return;
    const orig = proto.getParameter;
    if (isPatched(orig)) return;
    markPatched(orig);

    proto.getParameter = function (p) {
      executionJitter(); // Add timing resistance
      const value = orig.call(this, p);
      if (typeof value === "number") {
        const delta = jitter || 1;
        const out = value + delta;
        log("[fp][webgl] jitter", p, "base", value, "delta", delta, "out", out);
        return out;
      }

      const gl = this;
      const vendorParams = [
        gl.VENDOR,
        gl.RENDERER,
        gl.UNMASKED_VENDOR_WEBGL,
        gl.UNMASKED_RENDERER_WEBGL
      ].filter(Boolean);

      if (maskVendors && vendorParams.includes(p) && typeof value === "string") {
        const suffix = (Math.floor(prng() * 0xFFFF) || 1) >>> 0;
        const out = value + " (fp-" + suffix + ")";
        log("[fp][webgl] vendor", value, "->", out);
        return out;
      }

      return value;
    };

    if (proto.getSupportedExtensions && shuffleExt) {
      const origExt = proto.getSupportedExtensions;
      if (!isPatched(origExt)) {
        markPatched(origExt);
        proto.getSupportedExtensions = function () {
          const list = origExt.call(this);
          if (Array.isArray(list)) {
            const rev = list.slice().reverse();
            log("[fp][webgl] extensions", rev);
            return rev;
          }
          return list;
        };
      }
    }

    log("[fp][webgl] patched", proto.constructor && proto.constructor.name);
  }

  function tryPatch () {
    try {
      if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
    } catch (e) {
      // ignore
    }
  }

  tryPatch();
  if (!window.WebGLRenderingContext || !window.WebGL2RenderingContext) {
    window.addEventListener("load", tryPatch, { once: true });
  }
})();
