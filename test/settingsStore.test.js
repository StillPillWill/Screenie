const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;

before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenie-test-'));
    process.env.APPDATA = tmpDir;
    delete require.cache[require.resolve('../src/main/settingsStore')];
});

after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.APPDATA;
});

describe('settingsStore', () => {
    let ss;

    beforeEach(() => {
        delete require.cache[require.resolve('../src/main/settingsStore')];
        ss = require('../src/main/settingsStore');
    });

    it('loads default values', () => {
        const all = ss.get();
        assert.equal(typeof all.interval, 'number');
        assert.equal(typeof all.idleThreshold, 'number');
        assert.equal(all.allowlistEnabled, false);
        assert.deepEqual(all.allowlist, []);
        assert.equal(all.quality, 'medium');
        assert.equal(all.minimizeToTray, true);
    });

    it('gets a single key', () => {
        assert.equal(ss.get('interval'), 60);
        assert.equal(ss.get('quality'), 'medium');
    });

    it('returns undefined for unknown keys', () => {
        assert.equal(ss.get('nonexistent'), undefined);
    });

    it('returns full settings when no key given', () => {
        const all = ss.get();
        assert.ok(all.interval !== undefined);
        assert.ok(all.storagePath !== undefined);
    });

    it('sets a single key', () => {
        ss.set('interval', 30);
        assert.equal(ss.get('interval'), 30);
    });

    it('persists to disk and reloads', () => {
        ss.set('interval', 99);
        delete require.cache[require.resolve('../src/main/settingsStore')];
        const ss2 = require('../src/main/settingsStore');
        assert.equal(ss2.get('interval'), 99);
    });

    it('sets multiple keys at once via object', () => {
        ss.set({ interval: 45, quality: 'high' });
        assert.equal(ss.get('interval'), 45);
        assert.equal(ss.get('quality'), 'high');
    });

    it('resets to defaults', () => {
        ss.set('interval', 10);
        ss.set('quality', 'low');
        const result = ss.reset();
        assert.equal(result.interval, 60);
        assert.equal(result.quality, 'medium');
        assert.equal(ss.get('interval'), 60);
    });

    it('settings file is valid JSON', () => {
        const filePath = ss.getSettingsPath();
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        assert.ok(typeof parsed === 'object');
        assert.ok(parsed.interval !== undefined);
    });

    it('validates setting types survive round-trip', () => {
        ss.set('interval', 75);
        ss.set('allowlist', ['Chrome.exe', 'Code.exe']);
        ss.set('allowlistEnabled', true);

        delete require.cache[require.resolve('../src/main/settingsStore')];
        const ss2 = require('../src/main/settingsStore');
        assert.equal(ss2.get('interval'), 75);
        assert.deepEqual(ss2.get('allowlist'), ['Chrome.exe', 'Code.exe']);
        assert.equal(ss2.get('allowlistEnabled'), true);
    });

    it('getStorageDir returns a string path', () => {
        assert.equal(typeof ss.getStorageDir(), 'string');
        assert.ok(ss.getStorageDir().length > 0);
    });

    it('getSettingsPath ends with settings.json', () => {
        assert.ok(ss.getSettingsPath().endsWith('settings.json'));
    });

    it('has render defaults', () => {
        const all = ss.get();
        assert.equal(all.timelapseFps, 1);
        assert.equal(all.timelapseCrf, 23);
        assert.equal(all.timelapsePreset, 'medium');
        assert.equal(all.timelapseResolution, '1.0');
        assert.equal(all.timelapseSubtitles, true);
    });

    it('sets and gets render settings', () => {
        ss.set('timelapseFps', 15);
        ss.set('timelapseCrf', 18);
        ss.set('timelapsePreset', 'slow');
        ss.set('timelapseResolution', '0.75');
        ss.set('timelapseSubtitles', false);

        assert.equal(ss.get('timelapseFps'), 15);
        assert.equal(ss.get('timelapseCrf'), 18);
        assert.equal(ss.get('timelapsePreset'), 'slow');
        assert.equal(ss.get('timelapseResolution'), '0.75');
        assert.equal(ss.get('timelapseSubtitles'), false);
    });

    it('render settings survive disk round-trip', () => {
        ss.set('timelapseFps', 24);
        ss.set('timelapseCrf', 30);
        ss.set('timelapsePreset', 'veryslow');

        delete require.cache[require.resolve('../src/main/settingsStore')];
        const ss2 = require('../src/main/settingsStore');
        assert.equal(ss2.get('timelapseFps'), 24);
        assert.equal(ss2.get('timelapseCrf'), 30);
        assert.equal(ss2.get('timelapsePreset'), 'veryslow');
    });

    // --- NEW: filterMode and selectedDisplay ---

    it('has filterMode default of allowlist', () => {
        assert.equal(ss.get('filterMode'), 'allowlist');
    });

    it('sets and gets filterMode', () => {
        ss.set('filterMode', 'blocklist');
        assert.equal(ss.get('filterMode'), 'blocklist');
    });

    it('filterMode survives disk round-trip', () => {
        ss.set('filterMode', 'blocklist');
        delete require.cache[require.resolve('../src/main/settingsStore')];
        const ss2 = require('../src/main/settingsStore');
        assert.equal(ss2.get('filterMode'), 'blocklist');
    });

    it('has selectedDisplay default of primary', () => {
        assert.equal(ss.get('selectedDisplay'), 'primary');
    });

    it('sets and gets selectedDisplay', () => {
        ss.set('selectedDisplay', '192837465');
        assert.equal(ss.get('selectedDisplay'), '192837465');
    });

    it('selectedDisplay survives disk round-trip', () => {
        ss.set('selectedDisplay', '12345');
        delete require.cache[require.resolve('../src/main/settingsStore')];
        const ss2 = require('../src/main/settingsStore');
        assert.equal(ss2.get('selectedDisplay'), '12345');
    });

    it('reset restores filterMode and selectedDisplay to defaults', () => {
        ss.set('filterMode', 'blocklist');
        ss.set('selectedDisplay', '999');
        ss.reset();
        assert.equal(ss.get('filterMode'), 'allowlist');
        assert.equal(ss.get('selectedDisplay'), 'primary');
    });
});
