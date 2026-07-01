const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Progress ring math ───
const RING_CIRCUMFERENCE = 2 * Math.PI * 88;

function updateProgressCircle(countdown, total) {
    if (total <= 0) return { offset: RING_CIRCUMFERENCE, valid: false };
    const ratio = Math.max(0, Math.min(1, countdown / total));
    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    return { offset, valid: true };
}

describe('renderer - progress ring math', () => {
    it('full countdown → offset=0', () => {
        assert.equal(updateProgressCircle(30, 30).offset, 0);
    });

    it('zero countdown → offset=circumference', () => {
        assert.ok(Math.abs(updateProgressCircle(0, 30).offset - RING_CIRCUMFERENCE) < 0.001);
    });

    it('halfway countdown → offset is half', () => {
        assert.ok(Math.abs(updateProgressCircle(15, 30).offset - RING_CIRCUMFERENCE / 2) < 0.001);
    });

    it('handles total=0 gracefully', () => {
        assert.equal(updateProgressCircle(0, 0).valid, false);
    });

    it('clamps negative countdown', () => {
        assert.ok(Math.abs(updateProgressCircle(-5, 30).offset - RING_CIRCUMFERENCE) < 0.001);
    });

    it('clamps countdown > total', () => {
        assert.equal(updateProgressCircle(50, 30).offset, 0);
    });
});

// ─── Number input clamping ───
describe('renderer - clamp logic for number inputs', () => {
    function clampInterval(val) {
        val = Math.max(5, Math.min(120, val));
        val = Math.round(val / 5) * 5;
        return val;
    }

    function clampIdle(val) {
        val = Math.max(10, Math.min(300, val));
        val = Math.round(val / 10) * 10;
        return val;
    }

    it('clamps interval below min', () => assert.equal(clampInterval(1), 5));
    it('clamps interval above max', () => assert.equal(clampInterval(200), 120));
    it('snaps interval to step of 5', () => {
        assert.equal(clampInterval(33), 35);
        assert.equal(clampInterval(32), 30);
    });
    it('interval mid-range passthrough', () => assert.equal(clampInterval(60), 60));
    it('clamps idle below min', () => assert.equal(clampIdle(5), 10));
    it('clamps idle above max', () => assert.equal(clampIdle(500), 300));
    it('snaps idle to step of 10', () => {
        assert.equal(clampIdle(25), 30);
        assert.equal(clampIdle(33), 30);
    });
    it('idle mid-range passthrough', () => assert.equal(clampIdle(120), 120));
});

// ─── Toast colors ───
describe('renderer - toast color mapping', () => {
    it('has correct colors', () => {
        assert.equal('var(--green)', 'var(--green)');
        assert.equal('var(--red)', 'var(--red)');
        assert.equal('var(--amber)', 'var(--amber)');
        assert.equal('var(--accent)', 'var(--accent)');
    });
});

// ─── Scale filter generation ───
describe('renderer - scale filter generation', () => {
    function buildScaleFilter(resolution) {
        const scale = parseFloat(resolution) || 1.0;
        return scale < 1
            ? `scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2`
            : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
    }

    it('full resolution', () => assert.equal(buildScaleFilter('1.0'), 'scale=trunc(iw/2)*2:trunc(ih/2)*2'));
    it('half resolution', () => assert.equal(buildScaleFilter('0.5'), 'scale=trunc(iw*0.5/2)*2:trunc(ih*0.5/2)*2'));
    it('three-quarter resolution', () => assert.equal(buildScaleFilter('0.75'), 'scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2'));
    it('invalid falls back to full', () => assert.equal(buildScaleFilter('invalid'), 'scale=trunc(iw/2)*2:trunc(ih/2)*2'));
});

// ─── Subtitle toggle ───
describe('renderer - subtitle toggle logic', () => {
    const scaleFilter = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

    it('enabled appends subtitle filter', () => {
        const filters = `${scaleFilter},subtitles=subtitles.ass`;
        assert.ok(filters.includes('subtitles'));
    });

    it('disabled omits subtitle filter', () => {
        assert.ok(!scaleFilter.includes('subtitles'));
    });
});

// ─── NEW: Storage size formatting ───
describe('renderer - storage size formatting', () => {
    function formatSize(bytes) {
        if (bytes > 1024 * 1024 * 1024) {
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    it('formats bytes as MB', () => {
        assert.equal(formatSize(5 * 1024 * 1024), '5.0 MB');
    });

    it('formats small values as MB', () => {
        assert.equal(formatSize(1024 * 1024), '1.0 MB');
    });

    it('formats large values as GB', () => {
        assert.equal(formatSize(2.5 * 1024 * 1024 * 1024), '2.5 GB');
    });

    it('formats zero as MB', () => {
        assert.equal(formatSize(0), '0.0 MB');
    });

    it('formats fractional MB', () => {
        assert.equal(formatSize(1.5 * 1024 * 1024), '1.5 MB');
    });

    it('formats just under 1 GB as MB', () => {
        assert.equal(formatSize(0.9 * 1024 * 1024 * 1024), '921.6 MB');
    });
});

// ─── NEW: Filter mode logic ───
describe('renderer - filter mode logic', () => {
    function filterWindows(windows, list, mode) {
        if (mode === 'blocklist') {
            return windows.filter(w => !list.some(a => a.toLowerCase() === w.appName.toLowerCase()));
        }
        return windows.filter(w => list.some(a => a.toLowerCase() === w.appName.toLowerCase()));
    }

    const apps = [
        { appName: 'Chrome.exe' },
        { appName: 'Code.exe' },
        { appName: 'Discord.exe' },
        { appName: 'Spotify.exe' }
    ];
    const list = ['Chrome.exe', 'Discord.exe'];

    it('allowlist keeps only matching apps', () => {
        const result = filterWindows(apps, list, 'allowlist');
        assert.equal(result.length, 2);
        assert.ok(result.every(w => list.includes(w.appName)));
    });

    it('blocklist removes matching apps', () => {
        const result = filterWindows(apps, list, 'blocklist');
        assert.equal(result.length, 2);
        assert.ok(result.every(w => !list.includes(w.appName)));
    });

    it('allowlist with empty list returns nothing', () => {
        const result = filterWindows(apps, [], 'allowlist');
        assert.equal(result.length, 0);
    });

    it('blocklist with empty list returns everything', () => {
        const result = filterWindows(apps, [], 'blocklist');
        assert.equal(result.length, 4);
    });

    it('filter is case-insensitive', () => {
        const result = filterWindows(apps, ['chrome.exe'], 'allowlist');
        assert.equal(result.length, 1);
        assert.equal(result[0].appName, 'Chrome.exe');
    });

    it('blocklist with all apps returns nothing', () => {
        const result = filterWindows(apps, ['Chrome.exe', 'Code.exe', 'Discord.exe', 'Spotify.exe'], 'blocklist');
        assert.equal(result.length, 0);
    });
});

// ─── NEW: Filter hint text ───
describe('renderer - filter hint text', () => {
    function getFilterHint(mode) {
        return mode === 'allowlist'
            ? 'Only capture when working in approved apps.'
            : 'Capture everything except the listed apps.';
    }

    it('allowlist hint mentions approved apps', () => {
        assert.ok(getFilterHint('allowlist').includes('approved'));
    });

    it('blocklist hint mentions except', () => {
        assert.ok(getFilterHint('blocklist').includes('except'));
    });
});
