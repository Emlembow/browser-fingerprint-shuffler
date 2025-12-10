// Basic configuration knobs for fingerprint perturbation.
// Tweak these to tune aggressiveness without changing code.
(function () {
  const config = {
    debug: false, // set true to log storage and hook activity
    enableCanvasNoise: true,
    canvasNoiseStrength: 2, // bump to ensure visible pixel delta

    enableWebGLMasking: true,
    webglJitter: 2, // bump to ensure hash delta while staying small
    maskWebGLVendorStrings: true,
    shuffleWebGLExtensions: true,

    enableAudioNoise: true,
    audioNoiseStrength: 1e-7,

    enableNavigatorFuzz: true,
    navigator: {
      fuzzHardwareConcurrency: true,
      fuzzDeviceMemory: true,
      shuffleLanguages: true
    },

    perOriginFingerprint: true,

    // WebRTC protection (CRITICAL for privacy - prevents IP leaks)
    enableWebRTCProtection: true,
    webrtc: {
      blockIPLeak: true,      // Remove host/srflx candidates (prevents real IP leak)
      randomizeSDP: true,     // Randomize SDP fingerprints
      forceRelay: false       // Force relay-only (may break some connections)
    },

    // Media devices protection
    enableMediaDeviceProtection: true,
    mediaDevices: {
      randomizeDeviceIds: true,
      spoofDeviceLabels: true
    },

    // Screen/Display protection
    enableScreenProtection: true,
    screen: {
      useRealDistribution: true // Sample from real-world resolution distribution
    },

    // Font fingerprinting protection
    enableFontProtection: true,

    // Timezone and locale protection
    enableTimezoneProtection: true,

    // Sensor and performance API protection
    enableSensorProtection: true,
    sensors: {
      hideGamepads: true // Hide gamepad information
    },

    // Cryptographic strengthening
    useStrongKDF: true, // Use PBKDF2-style key derivation (recommended)
    kdfIterations: 1000, // Number of hash iterations for seed derivation
    useGaussianNoise: true, // Use Gaussian/Normal distribution instead of uniform (more natural)

    // Automatic fingerprint rotation
    autoRotateFingerprint: false, // Automatically rotate fingerprint on schedule
    rotationIntervalHours: 24, // How often to rotate (in hours)
    rotateOnStartup: false // Rotate fingerprint every time browser starts
  };

  // Expose default config globally
  globalThis.fpConfig = config;

  // Load stored config from chrome.storage and merge with defaults
  globalThis.fpLoadConfig = async function() {
    const defaultConfig = { ...config };

    try {
      if (!chrome?.storage?.local) {
        return defaultConfig;
      }

      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(['fpConfig'], (result) => {
          if (chrome.runtime?.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });

      const storedConfig = result.fpConfig || {};

      // Deep merge: stored config overrides defaults
      const mergedConfig = { ...defaultConfig };
      for (const key in storedConfig) {
        if (typeof storedConfig[key] === 'object' && !Array.isArray(storedConfig[key]) && storedConfig[key] !== null) {
          mergedConfig[key] = { ...defaultConfig[key], ...storedConfig[key] };
        } else {
          mergedConfig[key] = storedConfig[key];
        }
      }

      // Update global config
      globalThis.fpConfig = mergedConfig;

      if (mergedConfig.debug) {
        console.log('[fp][config] Loaded config:', mergedConfig);
      }

      return mergedConfig;
    } catch (e) {
      if (config.debug) {
        console.error('[fp][config] Failed to load stored config:', e);
      }
      return defaultConfig;
    }
  };
})();
