# Testing Smart Timezone Spoofing

## How It Works

The new timezone spoofing:
- ✅ **Keeps times accurate** - UTC offset stays the same
- ✅ **Changes fingerprint** - IANA timezone string changes
- ✅ **No website breakage** - All time calculations work correctly

## Example

**Your Real Timezone:** America/Los_Angeles (PST, offset 480)

**Possible Spoofed Timezones (same offset):**
- America/Vancouver (Canada)
- America/Tijuana (Mexico)
- America/Dawson (Yukon)
- America/Whitehorse (Yukon)

**Result:**
- Date.getTimezoneOffset() returns `480` (same as before)
- Intl.DateTimeFormat().resolvedOptions().timeZone returns `America/Vancouver` (spoofed!)
- Times display correctly, but fingerprint changes

---

## Testing Instructions

### 1. Enable Timezone Protection
1. Open extension settings
2. Enable "Timezone Protection"
3. Reload AmIUnique

### 2. Test in Browser Console

Open console (F12) and run:

```javascript
// Check timezone offset (should be your real offset)
console.log('Offset:', new Date().getTimezoneOffset()); // e.g., 480

// Check timezone string (should be spoofed)
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

// Test time display (should be correct)
console.log('Time:', new Date().toLocaleString());
```

### 3. Verify on AmIUnique

1. Export fingerprint BEFORE enabling timezone protection
2. Enable timezone protection and reload
3. Export fingerprint AFTER enabling timezone protection
4. Compare the `timezone` attribute - should show different IANA string

### 4. Check Console Logs

With debug mode ON, you should see:
```
[fp][page][timezone] Real offset: 480 Spoofed zone: America/Vancouver
```

---

## Supported Timezones by Offset

Your real offset will be detected, and a random zone from the same group will be chosen:

**PST/PDT (offset 480):**
- America/Los_Angeles
- America/Vancouver
- America/Tijuana
- America/Dawson
- America/Whitehorse

**MST/MDT (offset 420):**
- America/Denver
- America/Phoenix
- America/Edmonton
- America/Hermosillo
- America/Chihuahua
- America/Mazatlan

**CST/CDT (offset 360):**
- America/Chicago
- America/Mexico_City
- America/Regina
- America/Winnipeg
- America/Guatemala
- America/Belize

**EST/EDT (offset 300):**
- America/New_York
- America/Toronto
- America/Havana
- America/Panama
- America/Lima
- America/Bogota

*Plus many more for all global timezones!*

---

## Technical Details

### What Gets Spoofed

✅ **Intl.DateTimeFormat().resolvedOptions().timeZone**
- This is what fingerprinting scripts read
- Returns spoofed IANA timezone identifier
- Deterministic (same spoof for same session)

### What Stays Real

✅ **Date.prototype.getTimezoneOffset()**
- Returns real UTC offset in minutes
- Ensures time calculations are correct
- No website breakage

### Why This Works

Fingerprinting scripts detect timezone via:
1. `Intl.DateTimeFormat().resolvedOptions().timeZone` ← We spoof this
2. `Date.getTimezoneOffset()` ← We keep this real

By spoofing #1 and keeping #2 real:
- Fingerprint changes (privacy protection)
- Times display correctly (no UX issues)

---

## Rotation Behavior

When you reset your fingerprint:
- A new timezone is picked from the same offset group
- America/Los_Angeles might become America/Tijuana
- Then America/Vancouver on next rotation
- Always within the same UTC offset to keep times correct

This creates a moving target for fingerprinting while maintaining usability!
