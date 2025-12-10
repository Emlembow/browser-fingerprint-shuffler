// Page-world injector - runs in MAIN world to hook actual page APIs
// This script has NO access to chrome.* APIs but can modify page JavaScript
(function () {
  'use strict';

  // Minimal PRNG (Xoshiro128**) - same as core/prng.js
  function createPRNG(seed) {
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

  // Listen for config from ISOLATED world
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'FP_INIT_PAGE_HOOKS') return;

    const { config, seed } = event.data;
    const debug = config.debug || false;
    const log = debug ? console.log.bind(console) : () => {};

    log('[fp][page] Initializing page-world hooks with config:', config);

    if (!config || typeof seed !== 'number') {
      log('[fp][page] Invalid config or seed, aborting');
      return;
    }

    const prng = createPRNG(seed);

    // Gaussian noise
    let spareGaussian = null;
    function gaussianNoise(mean = 0, stddev = 1) {
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

    const noise = config.useGaussianNoise
      ? (scale = 1) => gaussianNoise(0, scale)
      : (scale = 1) => (prng() - 0.5) * scale;

    // ========================================================================
    // CANVAS HOOKS
    // ========================================================================
    if (config.enableCanvasNoise) {
      try {
        const noiseStrength = config.canvasNoiseStrength ?? 0.6;
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const origToBlob = HTMLCanvasElement.prototype.toBlob;

        function noisedImageData(ctx, x, y, w, h) {
          const imgData = origGetImageData.call(ctx, x, y, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] += noise(noiseStrength);
            data[i + 1] += noise(noiseStrength);
            data[i + 2] += noise(noiseStrength);
          }
          return imgData;
        }

        CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
          return noisedImageData(this, x, y, w, h);
        };

        HTMLCanvasElement.prototype.toDataURL = function() {
          try {
            const ctx = this.getContext('2d');
            if (ctx) {
              const imgData = noisedImageData(ctx, 0, 0, this.width, this.height);
              ctx.putImageData(imgData, 0, 0);
            }
          } catch (e) { /* ignore */ }
          return origToDataURL.apply(this, arguments);
        };

        HTMLCanvasElement.prototype.toBlob = function() {
          try {
            const ctx = this.getContext('2d');
            if (ctx) {
              const imgData = noisedImageData(ctx, 0, 0, this.width, this.height);
              ctx.putImageData(imgData, 0, 0);
            }
          } catch (e) { /* ignore */ }
          return origToBlob.apply(this, arguments);
        };

        log('[fp][page][canvas] Hooks installed');
      } catch (e) {
        log('[fp][page][canvas] Failed:', e);
      }
    }

    // ========================================================================
    // SCREEN HOOKS
    // ========================================================================
    if (config.enableScreenProtection) {
      try {
        const commonResolutions = [
          { width: 1920, height: 1080, weight: 0.35 },
          { width: 1366, height: 768, weight: 0.15 },
          { width: 2560, height: 1440, weight: 0.12 },
          { width: 1536, height: 864, weight: 0.10 },
          { width: 1440, height: 900, weight: 0.08 },
          { width: 1600, height: 900, weight: 0.07 },
          { width: 3840, height: 2160, weight: 0.05 },
          { width: 2880, height: 1800, weight: 0.04 },
          { width: 1280, height: 720, weight: 0.04 }
        ];

        function sampleResolution() {
          const r = prng();
          let cumulative = 0;
          for (const res of commonResolutions) {
            cumulative += res.weight;
            if (r < cumulative) {
              return { width: res.width, height: res.height };
            }
          }
          return { width: 1920, height: 1080 };
        }

        const realWidth = window.screen.width;
        const realHeight = window.screen.height;
        const spoofed = sampleResolution();
        const spoofedPixelRatio = spoofed.width >= 2560 ? 2 : 1;
        const colorDepths = [24, 24, 24, 30, 32];
        const spoofedColorDepth = colorDepths[Math.floor(prng() * colorDepths.length)];

        log(`[fp][page][screen] Real: ${realWidth}x${realHeight}, Spoofed: ${spoofed.width}x${spoofed.height}`);

        function defineGetter(obj, prop, getter) {
          try {
            Object.defineProperty(obj, prop, {
              get: getter,
              enumerable: true,
              configurable: false
            });
          } catch (e) {
            log(`[fp][page][screen] Failed to define ${prop}:`, e.message);
          }
        }

        defineGetter(window.screen, 'width', () => spoofed.width);
        defineGetter(window.screen, 'height', () => spoofed.height);
        defineGetter(window.screen, 'availWidth', () => spoofed.width);
        defineGetter(window.screen, 'availHeight', () => spoofed.height - 40);
        defineGetter(window.screen, 'colorDepth', () => spoofedColorDepth);
        defineGetter(window.screen, 'pixelDepth', () => spoofedColorDepth);
        defineGetter(window, 'devicePixelRatio', () => spoofedPixelRatio);

        log('[fp][page][screen] Hooks installed');
      } catch (e) {
        log('[fp][page][screen] Failed:', e);
      }
    }

    // ========================================================================
    // NAVIGATOR HOOKS
    // ========================================================================
    if (config.enableNavigatorFuzz) {
      try {
        const nav = navigator;
        const realHardwareConcurrency = nav.hardwareConcurrency || 4;
        const realDeviceMemory = nav.deviceMemory || 8;

        const fuzzedConcurrency = Math.max(2, realHardwareConcurrency + Math.floor((prng() - 0.5) * 4));
        const fuzzedMemory = Math.max(4, realDeviceMemory + Math.floor((prng() - 0.5) * 4));

        if (config.navigator?.fuzzHardwareConcurrency !== false) {
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => fuzzedConcurrency,
            enumerable: true,
            configurable: false
          });
        }

        if (config.navigator?.fuzzDeviceMemory !== false && 'deviceMemory' in navigator) {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => fuzzedMemory,
            enumerable: true,
            configurable: false
          });
        }

        log('[fp][page][navigator] Hooks installed, HC:', fuzzedConcurrency, 'Memory:', fuzzedMemory);
      } catch (e) {
        log('[fp][page][navigator] Failed:', e);
      }
    }

    // ========================================================================
    // TIMEZONE HOOKS
    // ========================================================================
    if (config.enableTimezoneProtection) {
      try {
        // Get real timezone offset (don't change this - keeps times correct)
        const realOffset = new Date().getTimezoneOffset();

        // Map of UTC offsets to IANA timezone identifiers
        // Grouped by offset so we can pick a different zone with same offset
        const timezonesByOffset = {
          '-720': ['Pacific/Wake', 'Pacific/Wallis'],
          '-660': ['Pacific/Midway', 'Pacific/Niue', 'Pacific/Pago_Pago'],
          '-600': ['Pacific/Honolulu', 'Pacific/Rarotonga', 'Pacific/Tahiti'],
          '-570': ['Pacific/Marquesas'],
          '-540': ['America/Anchorage', 'America/Juneau', 'America/Nome', 'America/Sitka', 'America/Yakutat'],
          '-480': ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana', 'America/Dawson', 'America/Whitehorse'],
          '-420': ['America/Denver', 'America/Phoenix', 'America/Edmonton', 'America/Hermosillo', 'America/Chihuahua', 'America/Mazatlan'],
          '-360': ['America/Chicago', 'America/Mexico_City', 'America/Regina', 'America/Winnipeg', 'America/Guatemala', 'America/Belize'],
          '-300': ['America/New_York', 'America/Toronto', 'America/Havana', 'America/Panama', 'America/Lima', 'America/Bogota'],
          '-240': ['America/Caracas', 'America/Halifax', 'America/Santiago', 'America/La_Paz', 'America/Manaus'],
          '-210': ['America/St_Johns'],
          '-180': ['America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'America/Godthab'],
          '-120': ['Atlantic/South_Georgia'],
          '-60': ['Atlantic/Azores', 'Atlantic/Cape_Verde'],
          '0': ['Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Africa/Casablanca', 'Atlantic/Reykjavik', 'UTC'],
          '60': ['Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Brussels', 'Europe/Amsterdam', 'Europe/Stockholm', 'Africa/Lagos'],
          '120': ['Europe/Athens', 'Europe/Helsinki', 'Europe/Kiev', 'Africa/Cairo', 'Asia/Jerusalem', 'Europe/Bucharest', 'Africa/Johannesburg'],
          '180': ['Europe/Moscow', 'Asia/Baghdad', 'Asia/Riyadh', 'Africa/Nairobi', 'Asia/Kuwait'],
          '210': ['Asia/Tehran'],
          '240': ['Asia/Dubai', 'Asia/Baku', 'Asia/Tbilisi', 'Asia/Muscat'],
          '270': ['Asia/Kabul'],
          '300': ['Asia/Karachi', 'Asia/Tashkent', 'Asia/Yekaterinburg'],
          '330': ['Asia/Kolkata', 'Asia/Colombo'],
          '345': ['Asia/Kathmandu'],
          '360': ['Asia/Dhaka', 'Asia/Almaty', 'Asia/Omsk'],
          '390': ['Asia/Yangon'],
          '420': ['Asia/Bangkok', 'Asia/Jakarta', 'Asia/Ho_Chi_Minh'],
          '480': ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Manila', 'Australia/Perth'],
          '540': ['Asia/Tokyo', 'Asia/Seoul', 'Asia/Pyongyang'],
          '570': ['Australia/Adelaide', 'Australia/Darwin'],
          '600': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Pacific/Guam'],
          '630': ['Australia/Lord_Howe'],
          '660': ['Pacific/Noumea', 'Pacific/Guadalcanal'],
          '720': ['Pacific/Auckland', 'Pacific/Fiji'],
          '780': ['Pacific/Tongatapu', 'Pacific/Apia']
        };

        // Find timezones with the same offset as real timezone
        const offsetKey = String(realOffset);
        const availableZones = timezonesByOffset[offsetKey] || [];

        if (availableZones.length > 0) {
          // Pick a random timezone from the same offset group
          const spoofedZone = availableZones[Math.floor(prng() * availableZones.length)];

          // Hook Intl.DateTimeFormat to return spoofed timezone
          const OrigDateTimeFormat = Intl.DateTimeFormat;
          Intl.DateTimeFormat = function(...args) {
            const instance = new OrigDateTimeFormat(...args);
            const origResolvedOptions = instance.resolvedOptions;

            instance.resolvedOptions = function() {
              const options = origResolvedOptions.call(this);
              options.timeZone = spoofedZone;
              return options;
            };

            return instance;
          };

          // Copy static properties
          Object.setPrototypeOf(Intl.DateTimeFormat, OrigDateTimeFormat);
          Object.setPrototypeOf(Intl.DateTimeFormat.prototype, OrigDateTimeFormat.prototype);

          log('[fp][page][timezone] Real offset:', realOffset, 'Spoofed zone:', spoofedZone);
        } else {
          log('[fp][page][timezone] No alternative timezones for offset:', realOffset);
        }
      } catch (e) {
        log('[fp][page][timezone] Failed:', e);
      }
    }

    // ========================================================================
    // WEBGL HOOKS
    // ========================================================================
    if (config.enableWebGLMasking) {
      try {
        const jitter = config.webglJitter ?? 2;
        const maskVendors = config.maskWebGLVendorStrings !== false;

        function patchWebGL(proto) {
          if (!proto || !proto.getParameter) return;
          const origGetParameter = proto.getParameter;

          proto.getParameter = function(p) {
            const value = origGetParameter.call(this, p);

            if (typeof value === 'number') {
              return value + jitter;
            }

            const gl = this;
            const vendorParams = [
              gl.VENDOR,
              gl.RENDERER,
              gl.UNMASKED_VENDOR_WEBGL,
              gl.UNMASKED_RENDERER_WEBGL
            ].filter(Boolean);

            if (maskVendors && vendorParams.includes(p) && typeof value === 'string') {
              const suffix = (Math.floor(prng() * 0xFFFF) || 1) >>> 0;
              return value + ' (fp-' + suffix + ')';
            }

            return value;
          };
        }

        if (window.WebGLRenderingContext) patchWebGL(WebGLRenderingContext.prototype);
        if (window.WebGL2RenderingContext) patchWebGL(WebGL2RenderingContext.prototype);

        log('[fp][page][webgl] Hooks installed');
      } catch (e) {
        log('[fp][page][webgl] Failed:', e);
      }
    }

    // ========================================================================
    // AUDIO HOOKS
    // ========================================================================
    if (config.enableAudioNoise) {
      try {
        const audioNoiseStrength = config.audioNoiseStrength ?? 1e-7;
        const AudioContext = window.AudioContext || window.webkitAudioContext;

        if (AudioContext) {
          const origGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function(channel) {
            const data = origGetChannelData.call(this, channel);
            for (let i = 0; i < data.length; i++) {
              data[i] += noise(audioNoiseStrength);
            }
            return data;
          };

          log('[fp][page][audio] Hooks installed');
        }
      } catch (e) {
        log('[fp][page][audio] Failed:', e);
      }
    }

    log('[fp][page] All hooks installed successfully');
  }, { once: false }); // Allow multiple messages

  // Signal that page-world script is ready
  window.postMessage({ type: 'FP_PAGE_WORLD_READY' }, '*');
})();
