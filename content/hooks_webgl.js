// WebGL fingerprint mutation: jitter numeric params and mask vendor strings.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installWebGLHooks (env) {
    if (!env || !env.config?.enableWebGLMasking) return;
    const { prng, config, seed } = env;
    const jitter = config.webglJitter ?? 1;
    const maskVendors = config.maskWebGLVendorStrings !== false;
    const shuffleExt = config.shuffleWebGLExtensions !== false;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function patchSelf (proto) {
      if (!proto || !proto.getParameter) return;
      const origGetParameter = proto.getParameter;
      // Use stealth tracking instead of __fp_patched
      if (globalThis.fpStealth && globalThis.fpStealth.isPatched(origGetParameter)) return;
      if (globalThis.fpStealth) globalThis.fpStealth.markPatched(origGetParameter);

      proto.getParameter = function (p) {
        // Add timing resistance
        if (globalThis.fpTimingUtils) {
          globalThis.fpTimingUtils.randomDelaySync();
          globalThis.fpTimingUtils.executionJitter();
        }

        const value = origGetParameter.call(this, p);

        if (typeof value === "number") {
          const delta = jitter || 1;
          const out = value + delta;
          log("[fp][webgl][cs] jitter", p, "base", value, "delta", delta, "out", out);
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
          const suffix = (prng() * 0xFFFF >>> 0) || 1;
          const out = value + " (fp-" + suffix + ")";
          log("[fp][webgl][cs] vendor", value, "->", out);
          return out;
        }

        return value;
      };

      if (proto.getSupportedExtensions && shuffleExt) {
        const origGetSupportedExtensions = proto.getSupportedExtensions;
        if (!globalThis.fpStealth || !globalThis.fpStealth.isPatched(origGetSupportedExtensions)) {
          if (globalThis.fpStealth) globalThis.fpStealth.markPatched(origGetSupportedExtensions);
          proto.getSupportedExtensions = function () {
            const list = origGetSupportedExtensions.call(this);
            if (Array.isArray(list)) {
              const reversed = list.slice().reverse();
              log("[fp][webgl][cs] extensions", reversed);
              return reversed;
            }
            return list;
          };
        }
      }

      log("[fp][webgl][cs] patched", proto.constructor && proto.constructor.name);
    }

    // Patch content-script world so testFingerprint (which runs here) sees changes.
    try {
      if (window.WebGLRenderingContext) patchSelf(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) patchSelf(WebGL2RenderingContext.prototype);
    } catch (e) { /* ignore */ }

    // Inject a page-context script (src) with parameters via dataset to bypass CSP inline restrictions.
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("content/webgl_page_patch.js");
    script.dataset.fpJitter = String(jitter);
    script.dataset.fpMaskVendors = String(maskVendors);
    script.dataset.fpShuffleExt = String(shuffleExt);
    script.dataset.fpDebug = String(debug);
    script.dataset.fpSeed = String(seed >>> 0);
    const parent = document.documentElement || document.head || document.body;
    if (!parent) return;
    parent.appendChild(script);
    return new Promise(resolve => {
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        resolve();
      };
    });
  });
})();
