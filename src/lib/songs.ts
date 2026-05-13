import { STEM_ORDER } from './audio/AudioEngine';
import type { ChordSection, SongBundle, SongChords, SongManifest, SongManifestEntry, SongMetadata } from './types';

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

export function formatMetadataDuration(metadata: Pick<SongMetadata, 'duration' | 'durationSeconds'>) {
  if (metadata.duration) {
    return metadata.duration;
  }

  if (typeof metadata.durationSeconds === 'number') {
    return formatTime(metadata.durationSeconds);
  }

  return '';
}

export function formatDurationSeconds(durationSeconds: number | undefined) {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
    return '';
  }

  return String(Math.round(durationSeconds));
}

export function stemLabel(stem: string) {
  return stem.slice(0, 1).toUpperCase() + stem.slice(1);
}

export function orderedStemNames(stems: Record<string, string>) {
  const availableStems = Object.keys(stems);
  const preferredStems = STEM_ORDER.filter((stem) => availableStems.includes(stem));
  const extraStems = availableStems
    .filter((stem) => !(STEM_ORDER as readonly string[]).includes(stem))
    .sort((left, right) => left.localeCompare(right));

  return [...preferredStems, ...extraStems];
}

function sectionLabel(sectionKey: string) {
  return sectionKey
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isChordSection(value: string | ChordSection): value is ChordSection {
  return typeof value === 'object' && value !== null;
}

export function formatChords(chords: SongChords | undefined) {
  if (!chords) {
    return '';
  }

  if (typeof chords === 'string') {
    return chords;
  }

  return Object.entries(chords)
    .flatMap(([key, value]) => {
      if (typeof value === 'string') {
        return [`${sectionLabel(key)} ${value}`];
      }

      if (!isChordSection(value)) {
        return [];
      }

      const lines = [`${value.label ?? sectionLabel(key)} ${value.progression}`];
      if (value.notes) {
        lines.push(value.notes);
      }
      return lines;
    })
    .join('\n');
}
