import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { detectBpmForSongs, estimateBpmFromSamples } from './detect-bpm';

const baseSongJson = {
  title: 'Demo Song',
  artist: 'Demo Artist',
  key: 'C',
  bpm: 90,
  timeSignature: '4/4'
};

async function makeSongRoot() {
  const root = await mkdtemp(join(tmpdir(), 'bpm-detect-'));
  const songDir = join(root, 'DemoSong');
  await mkdir(songDir, { recursive: true });
  await writeFile(join(songDir, 'song.json'), JSON.stringify(baseSongJson, null, 2));
  for (const stem of ['bass', 'drums', 'vocals']) {
    await writeFile(join(songDir, `Demo Song_${stem}.mp3`), 'fake mp3');
  }
  return { root, songDir };
}

describe('estimateBpmFromSamples', () => {
  it('estimates BPM from regular drum pulses', () => {
    const sampleRate = 1000;
    const samples = new Float32Array(sampleRate * 6);
    for (let index = 0; index < samples.length; index += 500) {
      samples[index] = 1;
      samples[index + 1] = -1;
    }

    expect(estimateBpmFromSamples(samples, sampleRate)).toBe(120);
  });
});

describe('detectBpmForSongs', () => {
  it('detects BPM from the drums stem and rewrites song metadata', async () => {
    const { root, songDir } = await makeSongRoot();
    const readSamples = vi.fn(async () => ({
      samples: new Float32Array([0, 1, 0, 1]),
      sampleRate: 1000
    }));
    const estimateBpm = vi.fn(() => 118.4);

    const result = await detectBpmForSongs(root, { readSamples, estimateBpm });

    const updated = JSON.parse(await readFile(join(songDir, 'song.json'), 'utf8'));
    expect(readSamples).toHaveBeenCalledWith(join(songDir, 'Demo Song_drums.mp3'));
    expect(result.updated).toEqual([join(songDir, 'song.json')]);
    expect(updated.bpm).toBe(118);
  });

  it('warns and preserves metadata when BPM detection fails', async () => {
    const { root, songDir } = await makeSongRoot();
    const readSamples = vi.fn(async () => {
      throw new Error('ffmpeg failed');
    });

    const result = await detectBpmForSongs(root, { readSamples });

    const unchanged = JSON.parse(await readFile(join(songDir, 'song.json'), 'utf8'));
    expect(result.updated).toEqual([]);
    expect(result.warnings[0]).toContain('DemoSong');
    expect(unchanged.bpm).toBe(90);
  });
});
