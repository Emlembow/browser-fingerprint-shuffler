// Timezone and locale protection.
// Protects against timezone and locale fingerprinting by spoofing timezone NAME only.
// IMPORTANT: Does NOT modify getTimezoneOffset() to avoid breaking time-based functionality.
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

    // Get the REAL timezone offset (don't modify this!)
    const realOffset = new Date().getTimezoneOffset();

    // Map of UTC offsets to IANA timezone identifiers
    // Grouped by offset so we can pick a different zone with the SAME offset
    // NOTE: getTimezoneOffset() returns POSITIVE for zones BEHIND UTC (e.g., PST = 480)
    //       and NEGATIVE for zones AHEAD of UTC (e.g., China = -480)
    const timezonesByOffset = {
      '720': ['Pacific/Wake', 'Pacific/Wallis'],
      '660': ['Pacific/Midway', 'Pacific/Niue', 'Pacific/Pago_Pago'],
      '600': ['Pacific/Honolulu', 'Pacific/Rarotonga', 'Pacific/Tahiti'],
      '570': ['Pacific/Marquesas'],
      '540': ['America/Anchorage', 'America/Juneau', 'America/Nome', 'America/Sitka', 'America/Yakutat'],
      '480': ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana', 'America/Dawson', 'America/Whitehorse'],
      '420': ['America/Denver', 'America/Phoenix', 'America/Edmonton', 'America/Hermosillo', 'America/Chihuahua', 'America/Mazatlan'],
      '360': ['America/Chicago', 'America/Mexico_City', 'America/Regina', 'America/Winnipeg', 'America/Guatemala', 'America/Belize'],
      '300': ['America/New_York', 'America/Toronto', 'America/Havana', 'America/Panama', 'America/Lima', 'America/Bogota'],
      '240': ['America/Caracas', 'America/Halifax', 'America/Santiago', 'America/La_Paz', 'America/Manaus'],
      '210': ['America/St_Johns'],
      '180': ['America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'America/Godthab'],
      '120': ['Atlantic/South_Georgia'],
      '60': ['Atlantic/Azores', 'Atlantic/Cape_Verde'],
      '0': ['Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Africa/Casablanca', 'Atlantic/Reykjavik', 'UTC'],
      '-60': ['Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Brussels', 'Europe/Amsterdam', 'Europe/Stockholm', 'Africa/Lagos'],
      '-120': ['Europe/Athens', 'Europe/Helsinki', 'Europe/Kiev', 'Africa/Cairo', 'Asia/Jerusalem', 'Europe/Bucharest', 'Africa/Johannesburg'],
      '-180': ['Europe/Moscow', 'Asia/Baghdad', 'Asia/Riyadh', 'Africa/Nairobi', 'Asia/Kuwait'],
      '-210': ['Asia/Tehran'],
      '-240': ['Asia/Dubai', 'Asia/Baku', 'Asia/Tbilisi', 'Asia/Muscat'],
      '-270': ['Asia/Kabul'],
      '-300': ['Asia/Karachi', 'Asia/Tashkent', 'Asia/Yekaterinburg'],
      '-330': ['Asia/Kolkata', 'Asia/Colombo'],
      '-345': ['Asia/Kathmandu'],
      '-360': ['Asia/Dhaka', 'Asia/Almaty', 'Asia/Omsk'],
      '-390': ['Asia/Yangon'],
      '-420': ['Asia/Bangkok', 'Asia/Jakarta', 'Asia/Ho_Chi_Minh'],
      '-480': ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Manila', 'Australia/Perth'],
      '-540': ['Asia/Tokyo', 'Asia/Seoul', 'Asia/Pyongyang'],
      '-570': ['Australia/Adelaide', 'Australia/Darwin'],
      '-600': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Pacific/Guam'],
      '-630': ['Australia/Lord_Howe'],
      '-660': ['Pacific/Noumea', 'Pacific/Guadalcanal'],
      '-720': ['Pacific/Auckland', 'Pacific/Fiji'],
      '-780': ['Pacific/Tongatapu', 'Pacific/Apia']
    };

    // Find timezones with the SAME offset as real timezone
    const offsetKey = String(realOffset);
    const availableZones = timezonesByOffset[offsetKey] || [];

    let spoofedTimezone = null;

    if (availableZones.length > 0) {
      // Pick a random timezone from the same offset group
      spoofedTimezone = availableZones[Math.floor(prng() * availableZones.length)];
      log(`[fp][timezone] Real offset: ${realOffset}, Spoofed timezone: ${spoofedTimezone}`);
    } else {
      log(`[fp][timezone] No alternative timezones for offset ${realOffset}, protection disabled`);
      return; // Can't spoof safely, skip this protection
    }

    // DO NOT HOOK getTimezoneOffset() - it must return the real offset!
    // This ensures calendars, time pickers, and time-based functionality work correctly.

    // Hook Intl.DateTimeFormat to return spoofed timezone name
    safeWrap(() => {
      const OrigDateTimeFormat = Intl.DateTimeFormat;
      if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(OrigDateTimeFormat)) {
        globalThis.fpStealth.markPatched(OrigDateTimeFormat);

        Intl.DateTimeFormat = function () {
          const formatter = new OrigDateTimeFormat(...arguments);
          const origResolvedOptions = formatter.resolvedOptions;

          formatter.resolvedOptions = function () {
            // Track statistics
            if (globalThis.fpStatsTracker) {
              globalThis.fpStatsTracker.increment('timezoneReads');
            }

            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            const options = origResolvedOptions.call(this);
            // Only spoof the timezone name, offset remains unchanged
            options.timeZone = spoofedTimezone;
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
    // These use the timezone for formatting but don't affect actual time calculations
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

            // Don't override timezone if user explicitly provided one
            // Only add spoofed timezone if no timezone was specified
            if (options && options.timeZone) {
              // User explicitly set timezone, don't override
              return orig.call(this, locales, options);
            }

            // No explicit timezone, use spoofed one
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
