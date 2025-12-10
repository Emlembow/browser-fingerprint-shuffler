// Navigator property masking with deterministic fuzz.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installNavigatorHooks (env) {
    if (!env || !env.config?.enableNavigatorFuzz) return;
    const { prng, config } = env;
    const navCfg = config.navigator || {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) { /* ignore */ }
    }

    function defineGetter (obj, prop, getter) {
      try {
        // Wrap getter with timing resistance
        const resistantGetter = function() {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
            globalThis.fpTimingUtils.executionJitter();
          }
          return getter.call(this);
        };

        Object.defineProperty(obj, prop, {
          get: resistantGetter,
          configurable: false,
          enumerable: true
        });
      } catch (e) {
        // Some props may be non-configurable
      }
    }

    safeWrap(() => {
      const nav = window.navigator;

      if (navCfg.fuzzHardwareConcurrency && typeof nav.hardwareConcurrency === "number") {
        const base = nav.hardwareConcurrency;
        const choices = [Math.max(1, base - 1), base, base + 1];
        const variant = choices[Math.floor(prng() * choices.length)];
        defineGetter(navigator, "hardwareConcurrency", () => variant);
      }

      if (navCfg.fuzzDeviceMemory && typeof nav.deviceMemory === "number") {
        const baseMem = nav.deviceMemory;
        const options = [Math.max(1, baseMem - 1), baseMem, baseMem + 1];
        const pick = options[Math.floor(prng() * options.length)];
        defineGetter(navigator, "deviceMemory", () => pick);
      }

      if (navCfg.shuffleLanguages && Array.isArray(nav.languages)) {
        const langs = nav.languages.slice();
        if (langs.length > 1) {
          const offset = Math.floor(prng() * langs.length);
          const rotated = langs.slice(offset).concat(langs.slice(0, offset));
          defineGetter(navigator, "languages", () => rotated);
        } else {
          defineGetter(navigator, "languages", () => langs.slice());
        }
      }
    });
  });
})();
