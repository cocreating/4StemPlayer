import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type SongManifest,
  REQUIRED_STEMS,
  listSongFolders,
  pathExists,
  publicSongPath,
  readSongJson,
  resolveStemFile,
  stemPeakFileName,
  writeJson
} from './song-utils';

interface CreateManifestOptions {
  writeFile?: boolean;
}

export async function createSongManifest(
  songsRoot = resolve('static/songs'),
  options: CreateManifestOptions = {}
): Promise<SongManifest> {
  const folders = await listSongFolders(songsRoot);
  const songs = await Promise.all(
    folders.map(async (folder) => {
      const songJson = await readSongJson(join(songsRoot, folder, 'song.json'));
      const songDir = join(songsRoot, folder);
      const stemFiles = await Promise.all(
        REQUIRED_STEMS.map(async (stem) => [stem, await resolveStemFile(songDir, folder, songJson.title, stem)] as const)
      );
      const stems = Object.fromEntries(
        stemFiles.map(([stem, fileName]) => {
          if (!fileName) {
            throw new Error(`${folder}: missing ${stem} stem`);
          }
          return [stem, publicSongPath(folder, fileName)];
        })
      ) as Record<(typeof REQUIRED_STEMS)[number], string>;

      const peaksEntries = await Promise.all(
        stemFiles.map(async ([stem, stemFile]) => {
          if (!stemFile) {
            return null;
          }
          const peaksFile = stemPeakFileName(stemFile);
          const peaksPath = join(songsRoot, folder, peaksFile);
          return (await pathExists(peaksPath)) ? [stem, publicSongPath(folder, peaksFile)] : null;
        })
      );

      return {
        id: folder,
        folder,
        title: songJson.title,
        artist: songJson.artist,
        bpm: songJson.bpm,
        key: songJson.key,
        timeSignature: songJson.timeSignature,
        songJsonUrl: publicSongPath(folder, 'song.json'),
        lyricsUrl: publicSongPath(folder, 'lyrics.md'),
        stems,
        ...(peaksEntries.some(Boolean)
          ? {
              peaks: Object.fromEntries(peaksEntries.filter(Boolean) as Array<[string, string]>)
            }
          : {})
      };
    })
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    songs
  };

  if (options.writeFile) {
    await writeJson(join(songsRoot, 'manifest.json'), manifest);
  }

  return manifest;
}

async function main() {
  const songsRoot = resolve(process.argv[2] ?? 'static/songs');
  const manifest = await createSongManifest(songsRoot, { writeFile: true });
  console.log(`Wrote ${join(songsRoot, 'manifest.json')} with ${manifest.songs.length} song(s).`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
