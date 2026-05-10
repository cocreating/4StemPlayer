import type { StemName } from './audio/AudioEngine';

export interface SectionMarker {
  label: string;
  start: number;
  end?: number;
}

export interface SongMetadata {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  chords?: string;
  notes?: string;
  lyrics?: string;
  sections?: SectionMarker[];
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
  stems: Record<StemName, string>;
  peaks?: Partial<Record<StemName, string>>;
}

export interface SongManifest {
  generatedAt: string;
  songs: SongManifestEntry[];
}

export interface SongBundle {
  manifestEntry: SongManifestEntry;
  metadata: SongMetadata;
  lyricsMarkdown: string;
}
