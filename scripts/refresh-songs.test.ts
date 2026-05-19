import { describe, expect, it, vi } from 'vitest';
import { parseRefreshSongsArgs, refreshSongs, type RefreshSongsDeps } from './refresh-songs';

function makeDeps(overrides: Partial<RefreshSongsDeps> = {}): RefreshSongsDeps {
  return {
    validateSongs: vi.fn(async () => ({ ok: true, errors: [], warnings: [] })),
    detectBpmForSongs: vi.fn(async () => ({
      updated: ['static/songs/Demo/song.json'],
      warnings: []
    })),
    generatePeaksForSongs: vi.fn(async () => ['static/songs/Demo/Demo_bass.peaks.json']),
    createSongManifest: vi.fn(async () => ({
      generatedAt: '2026-05-11T00:00:00.000Z',
      songs: []
    })),
    runCommand: vi.fn(async () => {}),
    log: vi.fn(),
    warn: vi.fn(),
    ...overrides
  };
}

describe('refreshSongs', () => {
  it('prepares songs by validating, generating peaks, and writing the manifest', async () => {
    const deps = makeDeps();

    await refreshSongs({ songsRoot: 'static/songs' }, deps);

    expect(deps.detectBpmForSongs).toHaveBeenCalledWith('static/songs');
    expect(deps.validateSongs).toHaveBeenCalledWith('static/songs');
    expect(deps.generatePeaksForSongs).toHaveBeenCalledWith('static/songs', { force: false });
    expect(deps.createSongManifest).toHaveBeenCalledWith('static/songs', { writeFile: true });
    expect(deps.runCommand).not.toHaveBeenCalled();
  });

  it('runs checks, tests, and build in release mode', async () => {
    const deps = makeDeps();

    await refreshSongs({ release: true }, deps);

    expect(deps.runCommand).toHaveBeenNthCalledWith(1, 'npm', ['run', 'check']);
    expect(deps.runCommand).toHaveBeenNthCalledWith(2, 'npm', ['test']);
    expect(deps.runCommand).toHaveBeenNthCalledWith(3, 'npm', ['run', 'build']);
  });

  it('supports skipping peak generation and release build', async () => {
    const deps = makeDeps();

    await refreshSongs({ release: true, skipPeaks: true, skipBuild: true }, deps);

    expect(deps.generatePeaksForSongs).not.toHaveBeenCalled();
    expect(deps.runCommand).toHaveBeenCalledTimes(2);
    expect(deps.runCommand).toHaveBeenNthCalledWith(1, 'npm', ['run', 'check']);
    expect(deps.runCommand).toHaveBeenNthCalledWith(2, 'npm', ['test']);
  });

  it('supports skipping BPM detection', async () => {
    const deps = makeDeps();

    await refreshSongs({ skipBpmDetect: true }, deps);

    expect(deps.detectBpmForSongs).not.toHaveBeenCalled();
    expect(deps.validateSongs).toHaveBeenCalled();
  });

  it('stops before generating assets when validation fails', async () => {
    const deps = makeDeps({
      validateSongs: vi.fn(async () => ({
        ok: false,
        errors: ['Demo: missing vocals stem mp3'],
        warnings: []
      }))
    });

    await expect(refreshSongs({}, deps)).rejects.toThrow('Song validation failed.');

    expect(deps.generatePeaksForSongs).not.toHaveBeenCalled();
    expect(deps.createSongManifest).not.toHaveBeenCalled();
    expect(deps.runCommand).not.toHaveBeenCalled();
  });
});

describe('parseRefreshSongsArgs', () => {
  it('parses CLI flags for release workflows', () => {
    expect(
      parseRefreshSongsArgs([
        '--release',
        '--skip-peaks',
        '--skip-bpm-detect',
        '--force-peaks',
        '--skip-build',
        '--songs-root',
        'fixtures/songs'
      ])
    ).toEqual({
      release: true,
      skipPeaks: true,
      skipBpmDetect: true,
      forcePeaks: true,
      skipBuild: true,
      songsRoot: 'fixtures/songs'
    });
  });
});
