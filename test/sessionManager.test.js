const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let ss;
let sm;

before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenie-session-test-'));
    process.env.APPDATA = tmpDir;
    delete require.cache[require.resolve('../src/main/settingsStore')];
    delete require.cache[require.resolve('../src/main/sessionManager')];
    ss = require('../src/main/settingsStore');
    sm = require('../src/main/sessionManager');
});

after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.APPDATA;
});

describe('sessionManager', () => {
    beforeEach(() => {
        sm.finalizeCurrentSession();
        const sessions = sm.getSessions();
        for (const s of sessions) {
            sm.deleteSession(s.id);
        }
    });

    it('starts with empty session list', () => {
        assert.deepEqual(sm.getSessions(), []);
    });

    it('creates a new session', () => {
        const session = sm.startNewSession();
        assert.ok(session.id.startsWith('session_'));
        assert.equal(session.frameCount, 0);
        assert.ok(Array.isArray(session.frames));
        assert.deepEqual(session.appsUsed, []);
    });

    it('sets current session after startNewSession', () => {
        sm.startNewSession();
        const current = sm.getCurrentSession();
        assert.ok(current !== null);
        assert.ok(current.id.startsWith('session_'));
    });

    it('returns null current session after finalize', () => {
        sm.startNewSession();
        sm.finalizeCurrentSession();
        assert.equal(sm.getCurrentSession(), null);
    });

    it('lists sessions after creation', () => {
        sm.startNewSession();
        const buf = Buffer.from('data');
        sm.addFrame(buf, { appName: 'Test.exe', title: 'Test' });
        sm.finalizeCurrentSession();
        const sessions = sm.getSessions();
        assert.equal(sessions.length, 1);
        assert.equal(sessions[0].frameCount, 1);
    });

    it('adds frames to a session', () => {
        sm.startNewSession();
        const fakeBuffer = Buffer.from('fake-image-data');
        const result = sm.addFrame(fakeBuffer, { appName: 'Chrome.exe', title: 'Google' });
        assert.equal(result.filename, 'capture_00001.jpg');
        assert.equal(result.frameCount, 1);

        const result2 = sm.addFrame(fakeBuffer, { appName: 'Code.exe', title: 'editor' });
        assert.equal(result2.filename, 'capture_00002.jpg');
        assert.equal(result2.frameCount, 2);
    });

    it('tracks unique apps used', () => {
        sm.startNewSession();
        const buf = Buffer.from('data');
        sm.addFrame(buf, { appName: 'Chrome.exe', title: 'A' });
        sm.addFrame(buf, { appName: 'Chrome.exe', title: 'B' });
        sm.addFrame(buf, { appName: 'Code.exe', title: 'C' });

        const current = sm.getCurrentSession();
        assert.deepEqual(current.appsUsed, ['Chrome.exe', 'Code.exe']);
    });

    it('writes frame files to disk', () => {
        sm.startNewSession();
        const buf = Buffer.from('test-jpg-content');
        sm.addFrame(buf, { appName: 'Test.exe', title: 'Test' });

        const current = sm.getCurrentSession();
        const filePath = path.join(current.path, 'capture_00001.jpg');
        assert.ok(fs.existsSync(filePath));
        assert.equal(fs.readFileSync(filePath).toString(), 'test-jpg-content');
    });

    it('writes session metadata to disk', () => {
        sm.startNewSession();
        const current = sm.getCurrentSession();
        const metaPath = path.join(current.path, 'metadata.json');
        assert.ok(fs.existsSync(metaPath));
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        assert.equal(meta.id, current.id);
        assert.equal(meta.frameCount, 0);
    });

    it('gets session details by id', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });
        sm.finalizeCurrentSession();

        const details = sm.getSessionDetails(session.id);
        assert.ok(details !== null);
        assert.equal(details.id, session.id);
        assert.equal(details.frameCount, 1);
        assert.ok(details.frames.length === 1);
    });

    it('deletes a session', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });
        sm.finalizeCurrentSession();

        const deleted = sm.deleteSession(session.id);
        assert.equal(deleted, true);
        assert.deepEqual(sm.getSessions(), []);
    });

    it('returns false when deleting nonexistent session', () => {
        const result = sm.deleteSession('session_nonexistent');
        assert.equal(result, false);
    });

    it('finalizes with 0 frames cleans up folder', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        const sessionPath = session.path;
        assert.ok(fs.existsSync(sessionPath));

        sm.finalizeCurrentSession();
        assert.ok(!fs.existsSync(sessionPath));
    });

    it('finalizes with frames keeps folder', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });
        const sessionPath = session.path;

        sm.finalizeCurrentSession();
        assert.ok(fs.existsSync(sessionPath));
    });

    it('resumes an existing session', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('a'), { appName: 'A.exe', title: 'A' });
        sm.finalizeCurrentSession();

        const resumed = sm.resumeSession(session.id);
        assert.equal(resumed.id, session.id);
        assert.equal(resumed.frameCount, 1);

        sm.addFrame(Buffer.from('b'), { appName: 'B.exe', title: 'B' });
        const current = sm.getCurrentSession();
        assert.equal(current.frameCount, 2);
    });

    it('updates timelapse status', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });
        sm.finalizeCurrentSession();

        sm.updateSessionTimelapse(session.id, '/fake/timelapse.mp4');
        const details = sm.getSessionDetails(session.id);
        assert.equal(details.hasTimelapse, true);
        assert.equal(details.timelapsePath, '/fake/timelapse.mp4');
    });

    it('creates session directory on disk', () => {
        sm.startNewSession();
        const current = sm.getCurrentSession();
        assert.ok(fs.existsSync(current.path));
        assert.ok(fs.statSync(current.path).isDirectory());
    });

    it('generates session IDs with expected format', () => {
        sm.startNewSession();
        const id = sm.getCurrentSession().id;
        sm.addFrame(Buffer.from('a'), { appName: 'A.exe', title: 'A' });
        sm.finalizeCurrentSession();
        assert.ok(id.startsWith('session_'));
        assert.ok(id.length > 'session_'.length + 10);
    });

    // --- NEW: lastFrameFilename tracking ---

    it('tracks lastFrameFilename in index', () => {
        sm.startNewSession();
        sm.addFrame(Buffer.from('a'), { appName: 'A.exe', title: 'A' });
        sm.addFrame(Buffer.from('b'), { appName: 'B.exe', title: 'B' });
        sm.finalizeCurrentSession();

        const sessions = sm.getSessions();
        assert.equal(sessions[0].lastFrameFilename, 'capture_00002.jpg');
    });

    it('lastFrameFilename updates on each frame', () => {
        sm.startNewSession();
        sm.addFrame(Buffer.from('a'), { appName: 'A.exe', title: 'A' });
        const s1 = sm.getSessions().find(s => s.id === sm.getCurrentSession()?.id) || sm.getSessions()[0];
        // Check current session directly
        sm.addFrame(Buffer.from('b'), { appName: 'B.exe', title: 'B' });
        sm.finalizeCurrentSession();

        const sessions = sm.getSessions();
        assert.equal(sessions[0].lastFrameFilename, 'capture_00002.jpg');
    });

    // --- NEW: archive ---

    it('archive fails for nonexistent session', () => {
        const result = sm.archiveSession('session_nonexistent');
        assert.equal(result.success, false);
        assert.ok(result.error.includes('not found'));
    });

    it('archive fails when no timelapse rendered', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });
        sm.finalizeCurrentSession();

        const result = sm.archiveSession(session.id);
        assert.equal(result.success, false);
        assert.ok(result.error.includes('No timelapse'));
    });

    it('archive copies video and deletes session', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });

        // Create a fake timelapse file
        const fakeTimelapse = path.join(session.path, 'timelapse.mp4');
        fs.writeFileSync(fakeTimelapse, 'fake-video-data');
        sm.updateSessionTimelapse(session.id, fakeTimelapse);
        sm.finalizeCurrentSession();

        // Verify session exists before archive
        assert.ok(sm.getSessions().length === 1);

        const result = sm.archiveSession(session.id);
        assert.equal(result.success, true);
        assert.ok(result.archivePath.includes('archive'));

        // Verify archive file exists
        assert.ok(fs.existsSync(result.archivePath));
        assert.equal(fs.readFileSync(result.archivePath).toString(), 'fake-video-data');

        // Verify session deleted
        assert.equal(sm.getSessions().length, 0);
        assert.ok(!fs.existsSync(session.path));
    });

    // --- NEW: storage size ---

    it('getStorageSize returns zero for empty sessions', () => {
        const size = sm.getStorageSize();
        assert.equal(typeof size.totalBytes, 'number');
        assert.equal(typeof size.sessionCount, 'number');
        assert.equal(size.sessionCount, 0);
    });

    it('getStorageSize counts sessions and bytes', () => {
        sm.startNewSession();
        sm.addFrame(Buffer.from('hello world'), { appName: 'Test.exe', title: 'Test' });
        sm.addFrame(Buffer.from('more data here'), { appName: 'Test.exe', title: 'Test' });
        sm.finalizeCurrentSession();

        const size = sm.getStorageSize();
        assert.ok(size.sessionCount >= 1);
        assert.ok(size.totalBytes > 0);
    });

    it('getStorageSize includes archive folder', () => {
        sm.startNewSession();
        const session = sm.getCurrentSession();
        sm.addFrame(Buffer.from('x'), { appName: 'X.exe', title: 'X' });
        const fakeTimelapse = path.join(session.path, 'timelapse.mp4');
        fs.writeFileSync(fakeTimelapse, 'video-data');
        sm.updateSessionTimelapse(session.id, fakeTimelapse);
        sm.finalizeCurrentSession();

        sm.archiveSession(session.id);

        const size = sm.getStorageSize();
        assert.ok(size.totalBytes > 0);
    });
});
