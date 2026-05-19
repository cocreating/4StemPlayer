import {
  clampPitchSemitones,
  effectiveStemPitchSemitones,
  isPitchAdjustableStem,
  masterGainForPitchSemitones
} from './pitch';

export const STEM_ORDER = ['vocals', 'guitar', 'strings', 'drums', 'bass', 'fx', 'other'] as const;

export type StemName = string;

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
  meterLevel: number;
  pitchAdjustable: boolean;
  pitchCorrectionSemitones: number;
  effectivePitchSemitones: number;
  pitchShiftError: string | null;
}

export interface AudioEngineSnapshot {
  songId: string | null;
  title: string | null;
  globalTransposeSemitones: number;
  duration: number;
  position: number;
  tempoRatio: number;
  playing: boolean;
  loading: boolean;
  errors: string[];
  stems: Record<string, StemPlaybackState>;
}

interface EngineOptions {
  audioContext?: AudioContext;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  createPitchShiftNode?: (audioContext: AudioContext) => Promise<PitchShiftNodeLike>;
  driftCorrectionIntervalMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
}

interface LoadedStem extends StemPlaybackState {
  buffer: AudioBuffer | null;
  gainNode: GainNode;
  analyserNode: AnalyserNode | null;
  meterData: Uint8Array<ArrayBuffer> | null;
  pitchNode: PitchShiftNodeLike | null;
  sourceNode: AudioBufferSourceNode | null;
}

interface PitchShiftNodeLike {
  pitch?: AudioParam;
  pitchSemitones: AudioParam;
  playbackRate?: AudioParam;
  connect(destination: AudioNode): unknown;
  disconnect(): void;
}

const DEFAULT_RAMP_SECONDS = 0.018;
const DEFAULT_DRIFT_INTERVAL_MS = 80;
const LIVE_GRAPH_TRANSITION_SECONDS = 0.03;
const MIN_TEMPO_RATIO = 0.5;
const MAX_TEMPO_RATIO = 1.5;
const pitchShiftRegistration = new WeakMap<BaseAudioContext, Promise<void>>();

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
    effectiveGain: 1,
    meterLevel: 0,
    pitchAdjustable: isPitchAdjustableStem(name),
    pitchCorrectionSemitones: 0,
    effectivePitchSemitones: 0,
    pitchShiftError: null
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

async function defaultCreatePitchShiftNode(audioContext: AudioContext): Promise<PitchShiftNodeLike> {
  if (!('audioWorklet' in audioContext) || !audioContext.audioWorklet) {
    throw new Error('AudioWorklet is not available in this browser.');
  }

  const [{ SoundTouchNode }, processorUrlModule] = await Promise.all([
    import('@soundtouchjs/audio-worklet'),
    import('@soundtouchjs/audio-worklet/processor?url')
  ]);
  const processorUrl = (processorUrlModule as { default: string }).default;

  let registration = pitchShiftRegistration.get(audioContext);
  if (!registration) {
    registration = SoundTouchNode.register(audioContext, processorUrl);
    pitchShiftRegistration.set(audioContext, registration);
  }
  await registration;

  const node = new SoundTouchNode({ context: audioContext });
  node.pitch.value = 1;
  node.pitchSemitones.value = 0;
  node.playbackRate.value = 1;
  return node;
}

export class AudioEngine {
  private readonly audioContext: AudioContext;
  private readonly fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly createPitchShiftNode: (audioContext: AudioContext) => Promise<PitchShiftNodeLike>;
  private readonly driftCorrectionIntervalMs: number;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly masterGainNode: GainNode;
  private readonly listeners = new Set<(snapshot: AudioEngineSnapshot) => void>();
  private readonly stems = new Map<StemName, LoadedStem>();
  private driftTimer: ReturnType<typeof setInterval> | null = null;
  private songId: string | null = null;
  private title: string | null = null;
  private duration = 0;
  private position = 0;
  private startedAt = 0;
  private globalTransposeSemitones = 0;
  private tempoRatio = 1;
  private playing = false;
  private loading = false;
  private errors: string[] = [];

  constructor(options: EngineOptions = {}) {
    this.audioContext = options.audioContext ?? createBrowserAudioContext();
    this.fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer;
    this.createPitchShiftNode = options.createPitchShiftNode ?? defaultCreatePitchShiftNode;
    this.driftCorrectionIntervalMs =
      options.driftCorrectionIntervalMs ?? DEFAULT_DRIFT_INTERVAL_MS;
    this.wait =
      options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.masterGainNode = this.audioContext.createGain();
    this.configureMasterOutput();
  }

  subscribe(listener: (snapshot: AudioEngineSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AudioEngineSnapshot {
    this.updateMeterLevels();
    const stems: Record<string, StemPlaybackState> = {};
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
        effectiveGain: stem.effectiveGain,
        meterLevel: stem.meterLevel,
        pitchAdjustable: stem.pitchAdjustable,
        pitchCorrectionSemitones: stem.pitchCorrectionSemitones,
        effectivePitchSemitones: stem.effectivePitchSemitones,
        pitchShiftError: stem.pitchShiftError
      };
    }

    return {
      songId: this.songId,
      title: this.title,
      globalTransposeSemitones: this.globalTransposeSemitones,
      duration: this.duration,
      position: this.getPosition(),
      tempoRatio: this.tempoRatio,
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
    await this.syncPitchNodes();
    this.position = clamp(this.position, 0, this.duration);
    this.startedAt = this.audioContext.currentTime;
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
      this.startedAt = this.audioContext.currentTime;
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

  async setTempoRatio(value: number) {
    const nextTempoRatio = clamp(Number.isFinite(value) ? value : 1, MIN_TEMPO_RATIO, MAX_TEMPO_RATIO);
    if (nextTempoRatio === this.tempoRatio) {
      this.emit();
      return;
    }

    if (this.playing) {
      this.position = this.getPosition();
      this.startedAt = this.audioContext.currentTime;
    }

    this.tempoRatio = nextTempoRatio;
    await this.applyPitchGraphForPlayback();
    this.emit();
  }

  async resetTempoRatio() {
    await this.setTempoRatio(1);
  }

  async setGlobalTransposeSemitones(value: number) {
    this.globalTransposeSemitones = clampPitchSemitones(value);
    this.resetStemPitchCorrections();
    this.updateEffectivePitchState();
    this.applyMasterGainForStoppedPlayback();
    await this.applyPitchGraphForPlayback();
    this.emit();
  }

  async adjustGlobalTransposeSemitones(delta: number) {
    await this.setGlobalTransposeSemitones(this.globalTransposeSemitones + delta);
  }

  async setStemPitchCorrection(name: StemName, value: number) {
    const stem = this.requireStem(name);
    if (!stem.pitchAdjustable) {
      stem.pitchCorrectionSemitones = 0;
      stem.effectivePitchSemitones = 0;
      this.emit();
      return;
    }

    stem.pitchCorrectionSemitones = clampPitchSemitones(value);
    this.updateEffectivePitch(stem);
    this.applyMasterGainForStoppedPlayback();
    await this.applyPitchGraphForPlayback();
    this.emit();
  }

  async adjustStemPitchCorrection(name: StemName, delta: number) {
    const stem = this.requireStem(name);
    await this.setStemPitchCorrection(name, stem.pitchCorrectionSemitones + delta);
  }

  destroy() {
    this.stopDriftCorrection();
    this.stopSources();
    for (const stem of this.stems.values()) {
      stem.pitchNode?.disconnect();
      stem.analyserNode?.disconnect();
      stem.gainNode.disconnect();
    }
    this.stems.clear();
    this.songId = null;
    this.title = null;
    this.duration = 0;
    this.position = 0;
    this.startedAt = 0;
    this.globalTransposeSemitones = 0;
    this.tempoRatio = 1;
    this.masterGainNode.gain.value = masterGainForPitchSemitones(0);
    this.playing = false;
    this.loading = false;
    this.errors = [];
    this.emit();
  }

  private async loadStem(stem: LoadableStem) {
    const gainNode = this.audioContext.createGain();
    const analyserNode = this.createStemAnalyser();
    let meterData: Uint8Array<ArrayBuffer> | null = null;

    if (analyserNode) {
      meterData = new Uint8Array(new ArrayBuffer(analyserNode.fftSize));
      gainNode.connect(analyserNode);
      analyserNode.connect(this.masterGainNode);
    } else {
      gainNode.connect(this.masterGainNode);
    }

    const loadedStem: LoadedStem = {
      ...createEmptyStem(stem.name),
      label: stem.label,
      url: stem.url,
      loading: true,
      gainNode,
      analyserNode,
      meterData,
      sourceNode: null,
      pitchNode: null,
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
      source.playbackRate.value = this.tempoRatio;
      const destination =
        this.stemNeedsPitchNode(stem) && stem.pitchNode ? stem.pitchNode : stem.gainNode;
      source.connect(destination as unknown as AudioNode);
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
    return clamp(this.position + ((this.audioContext.currentTime - this.startedAt) * this.tempoRatio), 0, this.duration);
  }

  private applyGainState(ramped = true) {
    const anySolo = [...this.stems.values()].some((stem) => stem.solo);
    for (const stem of this.stems.values()) {
      const targetGain = stem.muted || (anySolo && !stem.solo) ? 0 : stem.volume;
      stem.effectiveGain = targetGain;
      this.setGain(stem.gainNode.gain, targetGain, ramped);
    }
  }

  private createStemAnalyser() {
    if (!('createAnalyser' in this.audioContext)) {
      return null;
    }

    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    return analyser;
  }

  private updateMeterLevels() {
    for (const stem of this.stems.values()) {
      if (!this.playing || stem.effectiveGain <= 0 || !stem.analyserNode || !stem.meterData) {
        stem.meterLevel = 0;
        continue;
      }

      stem.analyserNode.getByteTimeDomainData(stem.meterData);
      let sumSquares = 0;
      for (const value of stem.meterData) {
        const normalized = (value - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / stem.meterData.length);
      stem.meterLevel = clamp(rms * 8, 0, 1);
    }
  }

  private updateEffectivePitchState() {
    for (const stem of this.stems.values()) {
      this.updateEffectivePitch(stem);
    }
  }

  private resetStemPitchCorrections() {
    for (const stem of this.stems.values()) {
      stem.pitchCorrectionSemitones = 0;
    }
  }

  private updateEffectivePitch(stem: LoadedStem) {
    stem.pitchAdjustable = isPitchAdjustableStem(stem.name);
    if (!stem.pitchAdjustable) {
      stem.pitchCorrectionSemitones = 0;
      stem.effectivePitchSemitones = 0;
      return;
    }

    stem.effectivePitchSemitones = effectiveStemPitchSemitones(
      stem.name,
      this.globalTransposeSemitones,
      stem.pitchCorrectionSemitones
    );
  }

  private async applyPitchGraphForPlayback() {
    if (!this.playing) {
      return;
    }

    if (!this.pitchRoutingNeedsRestart()) {
      await this.syncPitchNodes();
      this.updateActiveSourcePlaybackRates();
      this.rampMasterGain(this.currentMasterGainTarget());
      return;
    }

    await this.fadeMasterGain(0);
    if (!this.playing) {
      return;
    }

    const nextPosition = this.getPosition();
    this.stopSources();
    await this.syncPitchNodes();
    this.position = nextPosition;
    this.startedAt = this.audioContext.currentTime;
    this.startSources(nextPosition);
    this.rampMasterGain(this.currentMasterGainTarget());
  }

  private stemNeedsPitchNode(stem: LoadedStem) {
    return this.tempoRatio !== 1 || (stem.pitchAdjustable && stem.effectivePitchSemitones !== 0);
  }

  private pitchRoutingNeedsRestart() {
    this.updateEffectivePitchState();
    for (const stem of this.stems.values()) {
      const wantsPitchNode = this.stemNeedsPitchNode(stem);
      if (wantsPitchNode !== Boolean(stem.pitchNode)) {
        return true;
      }
    }
    return false;
  }

  private configureMasterOutput() {
    this.masterGainNode.gain.value = masterGainForPitchSemitones(0);
    this.masterGainNode.connect(this.audioContext.destination);
  }

  private applyMasterGainForStoppedPlayback() {
    if (!this.playing) {
      this.masterGainNode.gain.value = this.currentMasterGainTarget();
    }
  }

  private currentMasterGainTarget() {
    const maxEffectivePitch = Math.max(
      0,
      ...[...this.stems.values()].map((stem) =>
        stem.pitchAdjustable ? stem.effectivePitchSemitones : 0
      )
    );
    return masterGainForPitchSemitones(maxEffectivePitch);
  }

  private updateActiveSourcePlaybackRates() {
    for (const stem of this.stems.values()) {
      stem.sourceNode?.playbackRate.setValueAtTime(this.tempoRatio, this.audioContext.currentTime);
    }
  }

  private async fadeMasterGain(value: number) {
    this.rampMasterGain(value);
    await this.wait(LIVE_GRAPH_TRANSITION_SECONDS * 1000);
  }

  private rampMasterGain(value: number) {
    const now = this.audioContext.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
    this.masterGainNode.gain.linearRampToValueAtTime(
      value,
      now + LIVE_GRAPH_TRANSITION_SECONDS
    );
  }

  private async syncPitchNodes() {
    this.updateEffectivePitchState();

    for (const stem of this.stems.values()) {
      if (!this.stemNeedsPitchNode(stem)) {
        stem.pitchShiftError = null;
        stem.pitchNode?.disconnect();
        stem.pitchNode = null;
        continue;
      }

      try {
        if (!stem.pitchNode) {
          stem.pitchNode = await this.createPitchShiftNode(this.audioContext);
          stem.pitchNode.connect(stem.gainNode);
        }
        stem.pitchNode.pitch?.setValueAtTime(1, this.audioContext.currentTime);
        stem.pitchNode.playbackRate?.setValueAtTime(this.tempoRatio, this.audioContext.currentTime);
        stem.pitchNode.pitchSemitones.setValueAtTime(
          stem.pitchAdjustable ? stem.effectivePitchSemitones : 0,
          this.audioContext.currentTime
        );
        stem.pitchShiftError = null;
      } catch (error) {
        stem.pitchNode?.disconnect();
        stem.pitchNode = null;
        stem.pitchShiftError = error instanceof Error ? error.message : String(error);
      }
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

      const currentPosition = this.getPosition();
      if (currentPosition >= this.duration) {
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
