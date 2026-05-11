import { mkdtemp, mkdir, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePeaksForSongs } from './generate-peaks';

const songJson = {
  title: 'Demo Song',
  artist: 'Demo Artist',
  key: 'C major',
  bpm: 100,
  timeSignature: '4/4'
};

describe('generatePeaksForSongs', () => {
  it('skips stems when matching peak files are newer than the mp3 files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peaks-'));
    const songDir = join(root, 'DemoSong');
    await mkdir(songDir, { recursive: true });
    await writeFile(join(songDir, 'song.json'), JSON.stringify(songJson));

    const oldTime = new Date('2026-01-01T00:00:00.000Z');
    const newTime = new Date('2026-01-02T00:00:00.000Z');

    for (const stem of ['bass', 'drums', 'vocals', 'other']) {
      const stemPath = join(songDir, `Demo Song_${stem}.mp3`);
      const peaksPath = join(songDir, `Demo Song_${stem}.peaks.json`);
      await writeFile(stemPath, 'fake mp3');
      await writeFile(peaksPath, JSON.stringify({ sampleRate: 8000, samplesPerPixel: 512, peaks: [] }));
      await utimes(stemPath, oldTime, oldTime);
      await utimes(peaksPath, newTime, newTime);
    }

    await expect(generatePeaksForSongs(root)).resolves.toEqual([]);
  });
});
