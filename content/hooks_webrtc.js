// WebRTC fingerprint protection and IP leak prevention.
// Prevents real IP exposure even behind VPN, randomizes RTP fingerprints.
(function () {
  const installers = (globalThis.fpHookInstallers = globalThis.fpHookInstallers || []);

  installers.push(function installWebRTCHooks (env) {
    if (!env || !env.config?.enableWebRTCProtection) return;
    const { prng, config } = env;
    const blockIPLeak = config.webrtc?.blockIPLeak !== false;
    const randomizeSDP = config.webrtc?.randomizeSDP !== false;
    const forceRelay = config.webrtc?.forceRelay === true;
    const debug = config.debug ? true : false;
    const log = debug ? console.log : () => {};

    function safeWrap (fn) {
      try {
        fn();
      } catch (e) {
        if (debug) console.error('[fp][webrtc] Hook failed:', e);
      }
    }

    safeWrap(() => {
      if (!window.RTCPeerConnection) return;

      const OrigRTCPeerConnection = window.RTCPeerConnection;

      // Proxy RTCPeerConnection constructor
      window.RTCPeerConnection = function (configuration, constraints) {
        // Track statistics
        if (globalThis.fpStatsTracker) {
          globalThis.fpStatsTracker.increment('webrtcCalls');
        }

        log('[fp][webrtc] RTCPeerConnection created');

        // Modify configuration to force relay if enabled
        if (forceRelay && configuration) {
          configuration.iceTransportPolicy = 'relay';
          log('[fp][webrtc] Forced relay-only ICE');
        }

        const pc = new OrigRTCPeerConnection(configuration, constraints);

        // Hook createOffer
        const origCreateOffer = pc.createOffer;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origCreateOffer)) {
          globalThis.fpStealth.markPatched(origCreateOffer);
          pc.createOffer = function (options) {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            // Force relay candidates if configured
            if (forceRelay && options) {
              options.iceTransportPolicy = 'relay';
            }

            log('[fp][webrtc] createOffer called');
            return origCreateOffer.apply(this, arguments);
          };
        }

        // Hook createAnswer
        const origCreateAnswer = pc.createAnswer;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origCreateAnswer)) {
          globalThis.fpStealth.markPatched(origCreateAnswer);
          pc.createAnswer = function (options) {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            log('[fp][webrtc] createAnswer called');
            return origCreateAnswer.apply(this, arguments);
          };
        }

        // Hook setLocalDescription to filter SDP
        const origSetLocalDescription = pc.setLocalDescription;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origSetLocalDescription)) {
          globalThis.fpStealth.markPatched(origSetLocalDescription);
          pc.setLocalDescription = function (description) {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            if (description && description.sdp) {
              let modifiedSdp = description.sdp;

              // Block IP leak: Remove host and srflx candidates
              if (blockIPLeak) {
                const beforeLines = modifiedSdp.split('\n').length;
                // Remove local IP candidates (typ host)
                modifiedSdp = modifiedSdp.replace(/^a=candidate:.*typ host.*$/gm, '');
                // Remove server reflexive candidates (typ srflx) - can leak real IP
                modifiedSdp = modifiedSdp.replace(/^a=candidate:.*typ srflx.*$/gm, '');
                const afterLines = modifiedSdp.split('\n').length;
                const removed = beforeLines - afterLines;
                if (removed > 0) {
                  log(`[fp][webrtc] Removed ${removed} candidate lines to prevent IP leak`);
                }
              }

              // Randomize SDP fingerprints
              if (randomizeSDP) {
                // Modify fingerprint values
                modifiedSdp = modifiedSdp.replace(
                  /^a=fingerprint:(\w+)\s+([0-9A-F:]+)$/gm,
                  (match, algorithm, fingerprint) => {
                    // Generate deterministic but different fingerprint
                    const parts = fingerprint.split(':');
                    const modified = parts.map((part, idx) => {
                      const num = parseInt(part, 16);
                      const offset = Math.floor(prng() * 16) % 256;
                      const newNum = (num + offset) % 256;
                      return newNum.toString(16).toUpperCase().padStart(2, '0');
                    });
                    const newFingerprint = modified.join(':');
                    log(`[fp][webrtc] Randomized fingerprint: ${fingerprint.substring(0, 20)}... → ${newFingerprint.substring(0, 20)}...`);
                    return `a=fingerprint:${algorithm} ${newFingerprint}`;
                  }
                );

                // Modify ICE credentials (ufrag and pwd)
                modifiedSdp = modifiedSdp.replace(
                  /^a=ice-ufrag:(.+)$/gm,
                  (match, ufrag) => {
                    const suffix = Math.floor(prng() * 0xFFFF).toString(16);
                    const newUfrag = ufrag + suffix;
                    log(`[fp][webrtc] Modified ice-ufrag`);
                    return `a=ice-ufrag:${newUfrag}`;
                  }
                );

                modifiedSdp = modifiedSdp.replace(
                  /^a=ice-pwd:(.+)$/gm,
                  (match, pwd) => {
                    const suffix = Math.floor(prng() * 0xFFFF).toString(16);
                    const newPwd = pwd + suffix;
                    log(`[fp][webrtc] Modified ice-pwd`);
                    return `a=ice-pwd:${newPwd}`;
                  }
                );
              }

              // Create modified description
              const modifiedDesc = {
                type: description.type,
                sdp: modifiedSdp
              };

              return origSetLocalDescription.call(this, modifiedDesc);
            }

            return origSetLocalDescription.apply(this, arguments);
          };
        }

        // Hook setRemoteDescription
        const origSetRemoteDescription = pc.setRemoteDescription;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origSetRemoteDescription)) {
          globalThis.fpStealth.markPatched(origSetRemoteDescription);
          pc.setRemoteDescription = function () {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            log('[fp][webrtc] setRemoteDescription called');
            return origSetRemoteDescription.apply(this, arguments);
          };
        }

        // Hook addIceCandidate to filter candidates
        const origAddIceCandidate = pc.addIceCandidate;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origAddIceCandidate)) {
          globalThis.fpStealth.markPatched(origAddIceCandidate);
          pc.addIceCandidate = function (candidate) {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            if (blockIPLeak && candidate && candidate.candidate) {
              // Block host and srflx candidates
              if (candidate.candidate.includes('typ host') ||
                  candidate.candidate.includes('typ srflx')) {
                log('[fp][webrtc] Blocked ICE candidate:', candidate.candidate.substring(0, 50));
                // Return resolved promise without adding the candidate
                return Promise.resolve();
              }
            }

            return origAddIceCandidate.apply(this, arguments);
          };
        }

        return pc;
      };

      // Copy static properties
      Object.setPrototypeOf(window.RTCPeerConnection, OrigRTCPeerConnection);
      window.RTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;

      log('[fp][webrtc] RTCPeerConnection hooked successfully');
    });

    // Hook getUserMedia to prevent device enumeration fingerprinting
    safeWrap(() => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const origGetUserMedia = navigator.mediaDevices.getUserMedia;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origGetUserMedia)) {
          globalThis.fpStealth.markPatched(origGetUserMedia);
          navigator.mediaDevices.getUserMedia = function () {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }
            log('[fp][webrtc] getUserMedia called');
            return origGetUserMedia.apply(this, arguments);
          };
        }
      }
    });

    // Hook enumerateDevices to randomize device IDs and spoof labels
    if (config.enableMediaDeviceProtection) {
      safeWrap(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

        const origEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        if (globalThis.fpStealth && !globalThis.fpStealth.isPatched(origEnumerateDevices)) {
          globalThis.fpStealth.markPatched(origEnumerateDevices);

          navigator.mediaDevices.enumerateDevices = async function () {
            if (globalThis.fpTimingUtils) {
              globalThis.fpTimingUtils.randomDelaySync();
            }

            const devices = await origEnumerateDevices.call(this);
            const randomizeIds = config.mediaDevices?.randomizeDeviceIds !== false;
            const spoofLabels = config.mediaDevices?.spoofDeviceLabels !== false;

            if (!randomizeIds && !spoofLabels) {
              return devices;
            }

            // Hash function for deterministic device ID generation
            function hashDeviceId(deviceId, seed) {
              let hash = seed;
              for (let i = 0; i < deviceId.length; i++) {
                hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
                hash = hash & hash; // Convert to 32-bit integer
              }
              return Math.abs(hash).toString(16);
            }

            const modifiedDevices = devices.map((device, index) => {
              const modified = {
                deviceId: device.deviceId,
                kind: device.kind,
                label: device.label,
                groupId: device.groupId
              };

              // Randomize device IDs deterministically
              if (randomizeIds && device.deviceId) {
                const seed = env.seed + index;
                modified.deviceId = 'fp-' + hashDeviceId(device.deviceId, seed);
                if (device.groupId) {
                  modified.groupId = 'fp-group-' + hashDeviceId(device.groupId, seed);
                }
              }

              // Spoof device labels
              if (spoofLabels && device.label) {
                const genericLabels = {
                  audioinput: ['Microphone', 'Default Microphone', 'Internal Microphone'],
                  audiooutput: ['Speaker', 'Default Speaker', 'Internal Speaker'],
                  videoinput: ['Camera', 'Default Camera', 'Built-in Camera']
                };

                const labels = genericLabels[device.kind] || ['Device'];
                const labelIndex = Math.floor(prng() * labels.length);
                modified.label = labels[labelIndex];
                log(`[fp][media] Spoofed label: ${device.label} → ${modified.label}`);
              }

              return modified;
            });

            log(`[fp][media] enumerateDevices: ${devices.length} devices, IDs randomized: ${randomizeIds}, labels spoofed: ${spoofLabels}`);
            return modifiedDevices;
          };

          log('[fp][media] enumerateDevices hooked successfully');
        }
      });
    }
  });
})();
