(function () {
  const ready = globalThis.fpReady;
  const installers = globalThis.fpHookInstallers || [];
  const testFingerprint = globalThis.fpTestFingerprint;

  if (!ready || !installers.length || !testFingerprint) return;

  ready.then(async env => {
    if (!env) return;
    const log = env.config?.debug ? console.log : () => { };

    const before = await testFingerprint();

    const tasks = installers.map(fn => {
      try {
        return fn(env);
      } catch (e) {
        // Best-effort; keep page functional
        return null;
      }
    });

    for (const t of tasks) {
      if (t && typeof t.then === "function") {
        try { await t; } catch (e) { /* ignore */ }
      }
    }

    const after = await testFingerprint();
    console.log(`Fingerprint Shuffled. Before: ${before} After: ${after}`);
    log("[fp] before", before, "after", after);

    // Clean up globals to hide extension fingerprinting
    if (globalThis.fpStealth && globalThis.fpStealth.cleanupGlobals) {
      globalThis.fpStealth.cleanupGlobals();
    }
  });
})();
