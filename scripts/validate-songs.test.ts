import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSongManifest } from './generate-song-manifest';
import { validateSongs } from './validate-songs';

const songJson = {
  title: 'Glory Box',
  artist: 'Portishead',
  key: 'G minor',
  bpm: 82,
  timeSignature: '4/4',
  notes: 'Synthetic test stems for the technical spike.',
  sections: [
    { label: 'Intro', start: 0 },
    { label: 'Verse', start: 8 }
  ]
};

async function writeValidSong(root: string, folder = 'GloryBox') {
  const songDir = join(root, folder);
  await mkdir(songDir, { recursive: true });
  await writeFile(join(songDir, 'song.json'), JSON.stringify(songJson, null, 2));
  await writeFile(join(songDir, 'lyrics.md'), '# Glory Box\n\nGive me a reason\n');
  for (const stem of ['bass', 'drums', 'vocals', 'other']) {
    await writeFile(join(songDir, `${folder}_${stem}.mp3`), 'fake mp3');
  }
  return songDir;
}

async function writeValidSongWithTitlePrefixedStems(root: string, folder = 'GloryBox') {
  const songDir = join(root, folder);
  await mkdir(songDir, { recursive: true });
  await writeFile(join(songDir, 'song.json'), JSON.stringify(songJson, null, 2));
  await writeFile(join(songDir, 'lyrics.md'), '# Glory Box\n\nGive me a reason\n');
  for (const stem of ['bass', 'drums', 'vocals', 'other']) {
    await writeFile(join(songDir, `${songJson.title}_${stem}.mp3`), 'fake mp3');
  }
  return songDir;
}

describe('song scripts', () => {
  it('creates a manifest entry for each complete song folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'songs-'));
    await writeValidSong(root);

    const manifest = await createSongManifest(root);

    expect(manifest.songs).toEqual([
      {
        id: 'GloryBox',
        folder: 'GloryBox',
        title: 'Glory Box',
        artist: 'Portishead',
        bpm: 82,
        key: 'G minor',
        timeSignature: '4/4',
        songJsonUrl: '/songs/GloryBox/song.json',
        lyricsUrl: '/songs/GloryBox/lyrics.md',
        stems: {
          bass: '/songs/GloryBox/GloryBox_bass.mp3',
          drums: '/songs/GloryBox/GloryBox_drums.mp3',
          vocals: '/songs/GloryBox/GloryBox_vocals.mp3',
          other: '/songs/GloryBox/GloryBox_other.mp3'
        }
      }
    ]);
  });

  it('reports clear validation errors when required files are missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'songs-'));
    const songDir = await writeValidSong(root);
    await writeFile(join(songDir, 'GloryBox_bass.mp3'), '');
    await writeFile(join(songDir, 'song.json'), JSON.stringify({ title: 'Broken' }));

    const result = await validateSongs(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('GloryBox/song.json: missing artist');
    expect(result.errors).toContain('GloryBox/song.json: missing bpm');
    expect(result.errors).toContain('GloryBox/GloryBox_bass.mp3: file is empty');
  });

  it('accepts real stem files prefixed with the song title and writes URL-safe paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'songs-'));
    await writeValidSongWithTitlePrefixedStems(root);

    const result = await validateSongs(root);
    const manifest = await createSongManifest(root);

    expect(result.ok).toBe(true);
    expect(manifest.songs[0]?.stems).toEqual({
      bass: '/songs/GloryBox/Glory%20Box_bass.mp3',
      drums: '/songs/GloryBox/Glory%20Box_drums.mp3',
      vocals: '/songs/GloryBox/Glory%20Box_vocals.mp3',
      other: '/songs/GloryBox/Glory%20Box_other.mp3'
    });
  });

  it('reports expected filename options when a stem file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'songs-'));
    const songDir = join(root, 'GloryBox');
    await mkdir(songDir, { recursive: true });
    await writeFile(join(songDir, 'song.json'), JSON.stringify(songJson, null, 2));
    await writeFile(join(songDir, 'lyrics.md'), '# Glory Box\n\nGive me a reason\n');

    const result = await validateSongs(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'GloryBox: missing bass stem mp3; expected GloryBox_bass.mp3 or Glory Box_bass.mp3'
    );
  });

  it('writes manifest.json into the songs root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'songs-'));
    await writeValidSong(root);

    await createSongManifest(root, { writeFile: true });

    const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
    expect(manifest.generatedAt).toEqual(expect.any(String));
    expect(manifest.songs).toHaveLength(1);
  });
});
