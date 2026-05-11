import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

export const REQUIRED_STEMS = ['bass', 'drums', 'vocals', 'other'] as const;

export interface SongJson {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  duration?: string;
  durationSeconds?: number;
  chords?: string | Record<string, string | {
    label?: string;
    progression: string;
    notes?: string;
  }>;
  notes?: string;
  lyrics?: string;
  sections?: Array<{
    label: string;
    start: number;
    end?: number;
  }>;
}

export interface SongManifestEntry {
  id: string;
  folder: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  timeSignature: string;
  songJsonUrl: string;
  lyricsUrl: string;
  stems: Record<(typeof REQUIRED_STEMS)[number], string>;
  peaks?: Partial<Record<(typeof REQUIRED_STEMS)[number], string>>;
}

export interface SongManifest {
  generatedAt: string;
  songs: SongManifestEntry[];
}

export async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readSongJson(songJsonPath: string): Promise<SongJson> {
  return JSON.parse(await readFile(songJsonPath, 'utf8')) as SongJson;
}

export async function listSongFolders(songsRoot: string) {
  if (!(await pathExists(songsRoot))) {
    return [];
  }

  const entries = await readdir(songsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function fileSize(path: string) {
  const stats = await stat(path);
  return stats.size;
}

export function stemFileName(prefix: string, stem: string) {
  return `${prefix}_${stem}.mp3`;
}

export function publicSongPath(folder: string, fileName: string) {
  return `/songs/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}

export async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function stemPeakFileName(stemFile: string) {
  const extension = extname(stemFile);
  return `${stemFile.slice(0, -extension.length)}.peaks.json`;
}

export async function resolveStemFile(songDir: string, folder: string, title: string, stem: string) {
  const candidates = [stemFileName(folder, stem), stemFileName(title, stem)];

  for (const candidate of candidates) {
    if (await pathExists(join(songDir, candidate))) {
      return candidate;
    }
  }

  const lowerSuffix = `_${stem}.mp3`;
  const matches = (await readdir(songDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(lowerSuffix))
    .sort((a, b) => a.localeCompare(b));

  return matches[0] ?? null;
}

export function expectedStemFileNames(folder: string, title: string, stem: string) {
  return [stemFileName(folder, stem), stemFileName(title, stem)];
}
