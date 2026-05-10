export const STEM_ORDER = ['vocals', 'drums', 'bass', 'other'] as const;

export type StemName = (typeof STEM_ORDER)[number];

export interface LoadableStem {
  name: StemName;
  label: string;
  url: string;
}

export interface LoadableSong {
  id: string;
  title: string;
  stems: LoadableStem[];
}

export interface StemPlaybackState {
  name: StemName;
  label: string;
  url: string;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  muted: boolean;
  solo: boolean;
  volume: number;
  effectiveGain: number;
}

export interface AudioEngineSnapshot {
  songId: string | null;
  title: string | null;
  duration: number;
  position: number;
  playing: boolean;
  loading: boolean;
  errors: string[];
  stems: Record<StemName, StemPlaybackState>;
}

interface EngineOptions {
  audioContext?: AudioContext;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  driftCorrectionIntervalMs?: number;
}

interface LoadedStem extends StemPlaybackState {
  buffer: AudioBuffer | null;
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode | null;
}

const DEFAULT_RAMP_SECONDS = 0.018;
const DEFAULT_DRIFT_INTERVAL_MS = 500;

function createEmptyStem(name: StemName): StemPlaybackState {
  return {
    name,
    label: name,
    url: '',
    loading: false,
    loaded: false,
    error: null,
    muted: false,
    solo: false,
    volume: 1,
    effectiveGain: 1
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isBrowserAudioContextAvailable() {
  return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
}

function createBrowserAudioContext(): AudioContext {
  if (!isBrowserAudioContextAvailable()) {
    throw new Error('Web Audio API is not available in this browser.');
  }

  const AudioContextConstructor =
    window.AudioContext ??
    ((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  return new AudioContextConstructor();
}

async function defaultFetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

function emptyStemRecord(): Record<StemName, StemPlaybackState> {
  return STEM_ORDER.reduce(
    (record, name) => {
      record[name] = createEmptyStem(name);
      return record;
    },
    {} as Record<StemName, StemPlaybackState>
  );
}

export class AudioEngine {
  private readonly audioContext: AudioContext;
  private readonly fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly driftCorrectionIntervalMs: number;
  private readonly listeners = new Set<(snapshot: AudioEngineSnapshot) => void>();
  private readonly stems = new Map<StemName, LoadedStem>();
  private driftTimer: ReturnType<typeof setInterval> | null = null;
  private songId: string | null = null;
  private title: string | null = null;
  private duration = 0;
  private position = 0;
  private startedAt = 0;
  private playing = false;
  private loading = false;
  private errors: string[] = [];

  constructor(options: EngineOptions = {}) {
    this.audioContext = options.audioContext ?? createBrowserAudioContext();
    this.fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer;
    this.driftCorrectionIntervalMs =
      options.driftCorrectionIntervalMs ?? DEFAULT_DRIFT_INTERVAL_MS;
  }

  subscribe(listener: (snapshot: AudioEngineSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AudioEngineSnapshot {
    const stems = emptyStemRecord();
    for (const [name, stem] of this.stems) {
      stems[name] = {
        name: stem.name,
        label: stem.label,
        url: stem.url,
        loading: stem.loading,
        loaded: stem.loaded,
        error: stem.error,
        muted: stem.muted,
        solo: stem.solo,
        volume: stem.volume,
        effectiveGain: stem.effectiveGain
      };
    }

    return {
      songId: this.songId,
      title: this.title,
      duration: this.duration,
      position: this.getPosition(),
      playing: this.playing,
      loading: this.loading,
      errors: [...this.errors],
      stems
    };
  }

  async loadSong(song: LoadableSong) {
    this.destroy();
    this.songId = song.id;
    this.title = song.title;
    this.loading = true;
    this.errors = [];
    this.emit();

    const missingStems = STEM_ORDER.filter(
      (requiredStem) => !song.stems.some((stem) => stem.name === requiredStem)
    );
    if (missingStems.length > 0) {
      this.errors = missingStems.map((stem) => `${stem}: missing stem definition`);
      this.loading = false;
      this.emit();
      throw new Error(this.errors.join('\n'));
    }

    const loadResults = await Promise.allSettled(song.stems.map((stem) => this.loadStem(stem)));
    this.loading = false;
    this.duration = Math.max(0, ...[...this.stems.values()].map((stem) => stem.buffer?.duration ?? 0));

    const errors = loadResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

    this.errors = errors;
    this.applyGainState(false);
    this.emit();

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }

  async play() {
    if (this.playing || this.stems.size === 0 || this.errors.length > 0) {
      return;
    }

    await this.audioContext.resume?.();
    this.position = clamp(this.position, 0, this.duration);
    this.startedAt = this.audioContext.currentTime - this.position;
    this.playing = true;
    this.startSources(this.position);
    this.startDriftCorrection();
    this.emit();
  }

  pause() {
    if (!this.playing) {
      return;
    }

    this.position = this.getPosition();
    this.stopSources();
    this.playing = false;
    this.stopDriftCorrection();
    this.emit();
  }

  stop() {
    this.stopSources();
    this.playing = false;
    this.position = 0;
    this.stopDriftCorrection();
    this.emit();
  }

  seek(time: number) {
    this.position = clamp(Number.isFinite(time) ? time : 0, 0, this.duration || Number.MAX_SAFE_INTEGER);
    if (this.playing) {
      this.stopSources();
      this.startedAt = this.audioContext.currentTime - this.position;
      this.startSources(this.position);
    }
    this.emit();
  }

  setMuted(name: StemName, muted: boolean) {
    const stem = this.requireStem(name);
    stem.muted = muted;
    this.applyGainState();
    this.emit();
  }

  setSolo(name: StemName, solo: boolean) {
    const stem = this.requireStem(name);
    stem.solo = solo;
    this.applyGainState();
    this.emit();
  }

  setVolume(name: StemName, volume: number) {
    const stem = this.requireStem(name);
    stem.volume = clamp(volume, 0, 1);
    this.applyGainState();
    this.emit();
  }

  destroy() {
    this.stopDriftCorrection();
    this.stopSources();
    for (const stem of this.stems.values()) {
      stem.gainNode.disconnect();
    }
    this.stems.clear();
    this.songId = null;
    this.title = null;
    this.duration = 0;
    this.position = 0;
    this.startedAt = 0;
    this.playing = false;
    this.loading = false;
    this.errors = [];
    this.emit();
  }

  private async loadStem(stem: LoadableStem) {
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);

    const loadedStem: LoadedStem = {
      ...createEmptyStem(stem.name),
      label: stem.label,
      url: stem.url,
      loading: true,
      gainNode,
      sourceNode: null,
      buffer: null
    };
    this.stems.set(stem.name, loadedStem);
    this.emit();

    try {
      const audioData = await this.fetchArrayBuffer(stem.url);
      loadedStem.buffer = await this.audioContext.decodeAudioData(audioData.slice(0));
      loadedStem.loaded = true;
      loadedStem.error = null;
    } catch (error) {
      loadedStem.error = error instanceof Error ? error.message : String(error);
      throw new Error(`${stem.label}: ${loadedStem.error}`);
    } finally {
      loadedStem.loading = false;
      this.emit();
    }
  }

  private startSources(offset: number) {
    for (const stem of this.stems.values()) {
      if (!stem.buffer) {
        continue;
      }
      const source = this.audioContext.createBufferSource();
      source.buffer = stem.buffer;
      source.connect(stem.gainNode);
      source.onended = () => {
        if (this.playing && this.getPosition() >= this.duration - 0.05) {
          this.stop();
        }
      };
      source.start(0, clamp(offset, 0, stem.buffer.duration));
      stem.sourceNode = source;
    }
  }

  private stopSources() {
    for (const stem of this.stems.values()) {
      if (!stem.sourceNode) {
        continue;
      }

      stem.sourceNode.onended = null;
      try {
        stem.sourceNode.stop();
      } catch {
        // AudioBufferSourceNode.stop() throws if the source already stopped.
      }
      stem.sourceNode.disconnect();
      stem.sourceNode = null;
    }
  }

  private getPosition() {
    if (!this.playing) {
      return this.position;
    }
    return clamp(this.audioContext.currentTime - this.startedAt, 0, this.duration);
  }

  private applyGainState(ramped = true) {
    const anySolo = [...this.stems.values()].some((stem) => stem.solo);
    for (const stem of this.stems.values()) {
      const targetGain = stem.muted || (anySolo && !stem.solo) ? 0 : stem.volume;
      stem.effectiveGain = targetGain;
      this.setGain(stem.gainNode.gain, targetGain, ramped);
    }
  }

  private setGain(param: AudioParam, value: number, ramped: boolean) {
    const now = this.audioContext.currentTime;
    param.cancelScheduledValues(now);

    if (!ramped) {
      param.setValueAtTime(value, now);
      return;
    }

    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + DEFAULT_RAMP_SECONDS);
  }

  private requireStem(name: StemName) {
    const stem = this.stems.get(name);
    if (!stem) {
      throw new Error(`${name}: stem is not loaded`);
    }
    return stem;
  }

  private startDriftCorrection() {
    this.stopDriftCorrection();
    this.driftTimer = setInterval(() => {
      if (!this.playing) {
        return;
      }

      this.position = this.getPosition();
      if (this.position >= this.duration) {
        this.stop();
        return;
      }

      this.emit();
    }, this.driftCorrectionIntervalMs);
  }

  private stopDriftCorrection() {
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = null;
    }
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
