// Timezone and locale protection.
// Protects against timezone and locale fingerprinting.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installTimezoneHooks (env) {
    if (!env || !env.config?.enableTimezoneProtection) return;
    const { prng, config } = env;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][timezone] Hook failed:', e);
      }
    }

    // Common timezones weighted by usage
    const commonTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'America/Denver',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney'
    ];

    // Select a timezone deterministically
    const timezoneIndex = Math.floor(prng() * commonTimezones.length);
    const spoofedTimezone = commonTimezones[timezoneIndex];

    // Calculate timezone offset (simplified - just for demonstration)
    const timezoneOffsets = {
      'America/New_York': 300,
      'America/Chicago': 360,
      'America/Los_Angeles': 480,
      'America/Denver': 420,
      'Europe/London': 0,
      'Europe/Paris': -60,
      'Europe/Berlin': -60,
      'Asia/Tokyo': -540,
      'Asia/Shanghai': -480,
      'Australia/Sydney': -660
    };
    const spoofedOffset = timezoneOffsets[spoofedTimezone] || 0;

    log(`[fp][timezone] Spoofed timezone: ${spoofedTimezone}, offset: ${spoofedOffset}`);

    // Hook Date.prototype.getTimezoneOffset
    safeWrap(() => {
      const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetTimezoneOffset)) {
        globalThis.fpStealth.markPatched(origGetTimezoneOffset);

        Date.prototype.getTimezoneOffset = function () {
          if (globalThis.fpTimingUtils) {
            globalThis.fpTimingUtils.randomDelaySync();
          }
          return spoofedOffset;
        };

        log('[fp][timezone] getTimezoneOffset hooked');
      }
    });

    // Hook Intl.DateTimeFormat
    safeWrap(() => {
      const OrigDateTimeFormat = Intl.DateTimeFormat;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(OrigDateTimeFormat)) {
        globalThis.fpStealth.markPatched(OrigDateTimeFormat);

        Intl.DateTimeFormat = function () {
          const formatter = new OrigDateTimeFormat(...arguments);
          const origResolvedOptions = formatter.resolvedOptions;

          formatter.resolvedOptions = function () {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            const options = origResolvedOptions.call(this);
            options.timeZone = spoofedTimezone;
            log('[fp][timezone] resolvedOptions spoofed timezone');
            return options;
          };

          return formatter;
        };

        // Preserve prototype chain
        Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
        Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;

        log('[fp][timezone] Intl.DateTimeFormat hooked');
      }
    });

    // Hook toLocaleString and related methods
    safeWrap(() => {
      const dateStringMethods = [
        'toLocaleString',
        'toLocaleDateString',
        'toLocaleTimeString'
      ];

      dateStringMethods.forEach(method => {
        const orig = Date.prototype[method];
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(orig)) {
          globalThis.fpStealth.markPatched(orig);

          Date.prototype[method] = function (locales, options) {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            // Force spoofed timezone in options
            const modifiedOptions = options ? { ...options } : {};
            modifiedOptions.timeZone = spoofedTimezone;

            return orig.call(this, locales, modifiedOptions);
          };
        }
      });

      log('[fp][timezone] Date locale methods hooked');
    });
  });
})();
