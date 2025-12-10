# Debugging AmIUnique Protection

## Quick Checks

### 1. Check Extension is Active
1. Open https://amiunique.org/fingerprint
2. Open the popup (click extension icon)
3. Verify: "Protection enabled on this site" toggle is ON
4. If OFF: Turn it ON and reload the page

### 2. Enable Debug Mode
1. Go to Settings (⚙️ in popup)
2. Scroll to "Advanced" tab
3. Enable "Debug Mode"
4. Save Changes
5. Reload amiunique.org

### 3. Check Console for Hook Messages
1. Press F12 to open DevTools
2. Go to Console tab
3. Reload the page
4. Look for messages like:
   - `[fp][canvas][cs] patched`
   - `[fp][webgl][cs] patched`
   - `[fp][screen] ...`
   - etc.

If you see these messages, the hooks ARE working.

### 4. Test Specific APIs in Console

Paste these commands in the Console to test if hooks are working:

```javascript
// Test Canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.fillText('test', 0, 0);
const data1 = canvas.toDataURL();
const data2 = canvas.toDataURL();
console.log('Canvas deterministic?', data1 === data2);

// Test Screen
console.log('Screen resolution:', screen.width, 'x', screen.height);
console.log('Device pixel ratio:', devicePixelRatio);

// Test WebGL
const gl = canvas.getContext('webgl');
if (gl) {
  console.log('WebGL Vendor:', gl.getParameter(gl.VENDOR));
  console.log('WebGL Renderer:', gl.getParameter(gl.RENDERER));
}

// Test Timezone
console.log('Timezone offset:', new Date().getTimezoneOffset());
```

## Common Issues

### Issue 1: Page Loads Too Fast
**Symptom:** Hooks not applied before fingerprinting runs

**Solution:** The extension runs at `document_start`, but some sites are faster. Try:
1. Hard reload (Ctrl+Shift+R)
2. Clear cache and reload

### Issue 2: Worker-Based Fingerprinting
**Symptom:** Protection works in main page but not in workers

**Solution:** AmIUnique might use Web Workers. Our current version only protects the main thread.

### Issue 3: CSS-Based Fingerprinting
**Symptom:** Font lists detected via CSS

**Solution:** We protect Canvas measureText, but not pure CSS techniques.

### Issue 4: Multiple Iframes
**Symptom:** Some data protected, some not

**Solution:** Check if fingerprinting happens in cross-origin iframes.

## Expected Protection on AmIUnique

What SHOULD be protected:
- ✅ Canvas fingerprint (noise added)
- ✅ WebGL fingerprint (jitter + vendor masking)
- ✅ Screen resolution (spoofed)
- ✅ Timezone (spoofed)
- ✅ Audio context (noise)
- ✅ Hardware concurrency (fuzzed)
- ✅ Device memory (fuzzed)

What MIGHT NOT be protected:
- ❌ CSS-based font enumeration
- ❌ WebRTC in some edge cases
- ❌ HTTP header fingerprinting (User-Agent, etc.)
- ❌ JavaScript engine quirks
- ❌ Performance API timings (below our protection)
- ❌ Pure CSS measurements

## Advanced Debug: Check Specific Values

Run this in Console to see what amiunique is detecting:

```javascript
// Comprehensive fingerprint check
const fp = {
  canvas: (function() {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('amiunique.org', 2, 15);
    return c.toDataURL();
  })(),

  screen: {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    devicePixelRatio: window.devicePixelRatio
  },

  webgl: (function() {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl');
    if (!gl) return null;
    return {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    };
  })(),

  navigator: {
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    languages: navigator.languages
  },

  timezone: new Date().getTimezoneOffset()
};

console.log('Fingerprint Data:', JSON.stringify(fp, null, 2));
```

Compare the output:
1. Run once with extension enabled
2. Run again with extension disabled (whitelist the site)
3. Values should be DIFFERENT if protection is working

## Report Back

After running these tests, report:
1. Do you see `[fp]` debug messages in console?
2. Are the test values different with/without extension?
3. What specific data does amiunique show (screenshot)?
4. Any errors in console?
