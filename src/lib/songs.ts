import type { SongBundle, SongManifest, SongManifestEntry, SongMetadata } from './types';

export async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function loadSongManifest(): Promise<SongManifest> {
  return fetchJson<SongManifest>('/songs/manifest.json');
}

export async function loadSongBundle(entry: SongManifestEntry): Promise<SongBundle> {
  const [metadata, lyricsMarkdown] = await Promise.all([
    fetchJson<SongMetadata>(entry.songJsonUrl),
    fetchText(entry.lyricsUrl)
  ]);

  return {
    manifestEntry: entry,
    metadata,
    lyricsMarkdown
  };
}

export function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function stemLabel(stem: string) {
  return stem.slice(0, 1).toUpperCase() + stem.slice(1);
}
