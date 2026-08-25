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
  effectivePitchSemitones: number;
  pitchShiftError: string | null;
}

export interface LoopRange {
  start: number;
  end: number;
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
  /** True while stems are being re-rendered offline after a transpose/tempo change. */
  rendering: boolean;
  /** Progress of the in-flight offline render (`done` of `total` stems). */
  renderProgress: { done: number; total: number };
  errors: string[];
  loop: LoopRange | null;
  stems: Record<string, StemPlaybackState>;
}

export type PitchTempoMode = 'realtime' | 'render';

export interface RenderTransform {
  pitchSemitones: number;
  playbackRate: number;
}

export type RenderedBufferFactory = (
  input: AudioBuffer,
  transform: RenderTransform
) => Promise<AudioBuffer>;

export interface DecodeProfile {
  /** Downmix every stem to a single channel to roughly halve decoded memory. */
  mono: boolean;
  /** Resample decoded stems to this rate (Hz). `null` keeps the source rate. */
  sampleRate: number | null;
}

interface OfflineRenderContextLike {
  createBufferSource(): AudioBufferSourceNode;
  readonly destination: AudioNode;
  startRendering(): Promise<AudioBuffer>;
}

interface EngineOptions {
  audioContext?: AudioContext;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  createPitchShiftNode?: (audioContext: AudioContext) => Promise<PitchShiftNodeLike>;
  driftCorrectionIntervalMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
  /**
   * When set, decoded stems are downmixed/resampled to shrink their in-memory
   * footprint (a 6-stem song drops from ~450 MB to ~110 MB at mono/22.05 kHz).
   * Omit it to keep full-fidelity buffers (the default desktop behaviour).
   */
  decodeProfile?: DecodeProfile | null;
  createOfflineAudioContext?: (
    channels: number,
    length: number,
    sampleRate: number
  ) => OfflineRenderContextLike;
  /**
   * `realtime` (default) routes transpose/tempo through per-stem SoundTouch
   * worklets that process audio live — fine on desktop. `render` instead
   * pre-renders each stem offline whenever the pitch/tempo changes and plays
   * plain buffers, so playback carries no real-time DSP cost. Use `render` on
   * phones, where running several worklets at once underruns and desyncs.
   */
  pitchTempoMode?: PitchTempoMode;
  createRenderedBuffer?: RenderedBufferFactory;
}

async function defaultCreateRenderedBuffer(
  input: AudioBuffer,
  transform: RenderTransform
): Promise<AudioBuffer> {
  const [{ processOffline }, processorUrlModule] = await Promise.all([
    import('@soundtouchjs/audio-worklet'),
    import('@soundtouchjs/audio-worklet/processor?url')
  ]);
  const processorUrl = (processorUrlModule as { default: string }).default;
  // The non-quick WSOLA search is ~1.8x slower. Its quality benefit only shows
  // on large pitch shifts, so reserve it for those and use the fast search for
  // small transposes (and the pitch-0 drums pass) to keep rendering quick.
  const gentle = transform.playbackRate === 1 && Math.abs(transform.pitchSemitones) <= 2;
  return processOffline({
    input,
    processorUrl,
    pitchSemitones: transform.pitchSemitones,
    playbackRate: transform.playbackRate,
    interpolationStrategy: 'lanczos',
    stretchParameters: { quickSeek: gentle, overlapMs: gentle ? 8 : 12 }
  });
}

function defaultCreateOfflineAudioContext(
  channels: number,
  length: number,
  sampleRate: number
): OfflineRenderContextLike {
  const OfflineCtor =
    (typeof globalThis !== 'undefined' &&
      ((globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
        .OfflineAudioContext ??
        (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext)) ||
    undefined;
  if (!OfflineCtor) {
    throw new Error('OfflineAudioContext is not available in this browser.');
  }
  return new OfflineCtor(channels, length, sampleRate) as unknown as OfflineRenderContextLike;
}

interface LoadedStem extends StemPlaybackState {
  /** The buffer currently fed to playback (original, or an offline-rendered copy). */
  buffer: AudioBuffer | null;
  /** The unmodified decoded buffer, kept so renders always start from clean audio. */
  originalBuffer: AudioBuffer | null;
  /** The pitch/tempo transform currently baked into `buffer` (null = original). */
  renderedTransform: RenderTransform | null;
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
// How many stems to render offline at once. Caps peak memory while still
// overlapping the per-stem offline passes.
const RENDER_CONCURRENCY = 3;
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
  private readonly ownsAudioContext: boolean;
  private readonly audioContext: AudioContext;
  private readonly fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly createPitchShiftNode: (audioContext: AudioContext) => Promise<PitchShiftNodeLike>;
  private readonly driftCorrectionIntervalMs: number;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly decodeProfile: DecodeProfile | null;
  private readonly createOfflineAudioContext: (
    channels: number,
    length: number,
    sampleRate: number
  ) => OfflineRenderContextLike;
  private readonly pitchTempoMode: PitchTempoMode;
  private readonly createRenderedBuffer: RenderedBufferFactory;
  private readonly masterGainNode: GainNode;
  private readonly masterLimiterNode: DynamicsCompressorNode | null;
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
  private starting = false;
  private playbackEpoch = 0;
  private graphMutation: Promise<void> = Promise.resolve();
  private rendering = false;
  private renderProgress = { done: 0, total: 0 };
  /** Tempo ratio baked into the current playback buffers (render mode). */
  private renderedTempoRatio = 1;
  private loop: LoopRange | null = null;

  constructor(options: EngineOptions = {}) {
    this.ownsAudioContext = !options.audioContext;
    this.audioContext = options.audioContext ?? createBrowserAudioContext();
    this.fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer;
    this.createPitchShiftNode = options.createPitchShiftNode ?? defaultCreatePitchShiftNode;
    this.driftCorrectionIntervalMs =
      options.driftCorrectionIntervalMs ?? DEFAULT_DRIFT_INTERVAL_MS;
    this.wait =
      options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.decodeProfile = options.decodeProfile ?? null;
    this.createOfflineAudioContext =
      options.createOfflineAudioContext ?? defaultCreateOfflineAudioContext;
    this.pitchTempoMode = options.pitchTempoMode ?? 'realtime';
    this.createRenderedBuffer = options.createRenderedBuffer ?? defaultCreateRenderedBuffer;
    this.masterGainNode = this.audioContext.createGain();
    this.masterLimiterNode = this.createMasterLimiter();
    this.configureMasterOutput();
  }

  private get renderMode() {
    return this.pitchTempoMode === 'render';
  }

  private createMasterLimiter(): DynamicsCompressorNode | null {
    if (!('createDynamicsCompressor' in this.audioContext)) {
      return null;
    }
    // A fast, high-ratio compressor acts as a brickwall limiter so summed
    // stems and time-stretch overshoot cannot hard-clip the output.
    const limiter = this.audioContext.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    return limiter;
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
      rendering: this.rendering,
      renderProgress: { ...this.renderProgress },
      errors: [...this.errors],
      loop: this.loop ? { ...this.loop } : null,
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
    // Duration is always the original timeline; rendered buffers may be shorter
    // when a tempo change is baked in.
    this.duration = Math.max(
      0,
      ...[...this.stems.values()].map((stem) => stem.originalBuffer?.duration ?? 0)
    );

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
    if (this.playing || this.starting || this.stems.size === 0 || this.errors.length > 0) {
      return;
    }

    this.starting = true;
    const epoch = ++this.playbackEpoch;

    try {
      await this.runExclusive(async () => {
        await this.audioContext.resume?.();
        await this.syncPitchNodes();
        // The user may have pressed Stop/Play or seeked while the pitch worklet
        // was initializing. If so, abandon this start instead of launching
        // orphaned sources that would play while the engine reports "stopped".
        if (this.playbackEpoch !== epoch) {
          return;
        }
        this.position = clamp(this.position, 0, this.duration);
        this.startedAt = this.audioContext.currentTime;
        this.playing = true;
        this.startSources(this.position);
        this.startDriftCorrection();
        this.emit();
      });
    } finally {
      this.starting = false;
    }
  }

  pause() {
    if (!this.playing) {
      return;
    }

    this.position = this.getPosition();
    this.stopSources();
    this.playing = false;
    this.playbackEpoch += 1;
    // Restore master gain in case this interrupted a render/transition fade.
    this.applyMasterGainForStoppedPlayback();
    this.stopDriftCorrection();
    this.emit();
  }

  stop() {
    this.stopSources();
    this.playing = false;
    this.position = 0;
    this.playbackEpoch += 1;
    this.applyMasterGainForStoppedPlayback();
    this.stopDriftCorrection();
    this.emit();
  }

  seek(time: number) {
    this.position = clamp(Number.isFinite(time) ? time : 0, 0, this.duration || Number.MAX_SAFE_INTEGER);
    this.playbackEpoch += 1;
    if (this.playing) {
      this.stopSources();
      this.startedAt = this.audioContext.currentTime;
      this.startSources(this.position);
      // Re-assert master gain in case a transition fade was interrupted.
      this.rampMasterGain(this.currentMasterGainTarget());
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
    this.updateEffectivePitchState();
    this.applyMasterGainForStoppedPlayback();
    await this.applyPitchGraphForPlayback();
    this.emit();
  }

  async adjustGlobalTransposeSemitones(delta: number) {
    await this.setGlobalTransposeSemitones(this.globalTransposeSemitones + delta);
  }

  setLoop(start: number, end: number) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      this.loop = null;
    } else {
      const maxDuration = this.duration > 0 ? this.duration : Math.max(end, start + 0.1);
      const safeStart = clamp(start, 0, maxDuration);
      const safeEnd = clamp(end, safeStart + 0.1, maxDuration);
      this.loop = { start: safeStart, end: safeEnd };
    }
    this.emit();
  }

  clearLoop() {
    this.loop = null;
    this.emit();
  }

  toggleLoopRange(start: number, end: number) {
    if (this.loop && Math.abs(this.loop.start - start) < 0.1 && Math.abs(this.loop.end - end) < 0.1) {
      this.clearLoop();
    } else {
      this.setLoop(start, end);
    }
  }

  destroy() {
    this.loop = null;
    this.playbackEpoch += 1;
    this.starting = false;
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
    this.renderedTempoRatio = 1;
    this.rendering = false;
    this.renderProgress = { done: 0, total: 0 };
    this.masterGainNode.gain.value = masterGainForPitchSemitones(0);
    this.playing = false;
    this.loading = false;
    this.errors = [];
    if (this.ownsAudioContext && typeof this.audioContext.close === 'function') {
      void this.audioContext.close().catch(() => {});
    }
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
      buffer: null,
      originalBuffer: null,
      renderedTransform: null
    };
    this.stems.set(stem.name, loadedStem);
    this.emit();

    try {
      const audioData = await this.fetchArrayBuffer(stem.url);
      const decoded = await this.audioContext.decodeAudioData(audioData.slice(0));
      loadedStem.originalBuffer = await this.processDecodedBuffer(decoded);
      loadedStem.buffer = loadedStem.originalBuffer;
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

  private async processDecodedBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
    const profile = this.decodeProfile;
    if (!profile) {
      return buffer;
    }

    const targetSampleRate = profile.sampleRate ?? buffer.sampleRate;
    const targetChannels = profile.mono ? 1 : buffer.numberOfChannels;

    // Nothing to gain if the buffer already matches the requested profile.
    if (targetSampleRate >= buffer.sampleRate && targetChannels >= buffer.numberOfChannels) {
      return buffer;
    }

    const length = Math.max(1, Math.ceil(buffer.duration * targetSampleRate));

    try {
      const offline = this.createOfflineAudioContext(targetChannels, length, targetSampleRate);
      const source = offline.createBufferSource();
      source.buffer = buffer;
      // Connecting a stereo source to a mono destination performs a spec
      // downmix; the offline context resamples to the target rate on render.
      source.connect(offline.destination);
      source.start();
      return await offline.startRendering();
    } catch {
      // If offline rendering is unavailable, fall back to the full-fidelity
      // buffer rather than failing to load the stem.
      return buffer;
    }
  }

  private startSources(offset: number) {
    for (const stem of this.stems.values()) {
      if (!stem.buffer) {
        continue;
      }
      const source = this.audioContext.createBufferSource();
      source.buffer = stem.buffer;

      let bufferOffset: number;
      let destination: AudioNode;
      if (this.renderMode) {
        // Tempo is baked into the rendered buffer, so it plays at native rate
        // and the original-timeline playhead maps through the baked ratio.
        source.playbackRate.value = 1;
        const ratio = this.renderedTempoRatio || 1;
        bufferOffset = clamp(offset / ratio, 0, stem.buffer.duration);
        destination = stem.gainNode;
      } else {
        source.playbackRate.value = this.tempoRatio;
        bufferOffset = clamp(offset, 0, stem.buffer.duration);
        destination =
          this.stemNeedsPitchNode(stem) && stem.pitchNode
            ? (stem.pitchNode as unknown as AudioNode)
            : stem.gainNode;
      }

      source.connect(destination);
      source.onended = () => {
        if (this.playing) {
          if (this.loop && this.getPosition() >= this.loop.end - 0.05) {
            this.seek(this.loop.start);
          } else if (this.getPosition() >= this.duration - 0.05) {
            if (this.loop) {
              this.seek(this.loop.start);
            } else {
              this.stop();
            }
          }
        }
      };
      source.start(0, bufferOffset);
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
    // Freeze the playhead while an offline re-render is in flight so the
    // transport visibly pauses during the reconfig instead of drifting.
    if (!this.playing || this.rendering) {
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

  private updateEffectivePitch(stem: LoadedStem) {
    stem.pitchAdjustable = isPitchAdjustableStem(stem.name);
    stem.effectivePitchSemitones = stem.pitchAdjustable
      ? effectiveStemPitchSemitones(stem.name, this.globalTransposeSemitones)
      : 0;
  }

  private async applyPitchGraphForPlayback() {
    if (this.renderMode) {
      // Render mode pre-renders even while stopped so the next play is instant.
      const renderEpoch = this.playbackEpoch;
      await this.runExclusive(() => this.reconcileRenderedBuffers(renderEpoch));
      return;
    }

    if (!this.playing) {
      return;
    }

    const epoch = this.playbackEpoch;
    await this.runExclusive(() => this.reconcilePitchGraph(epoch));
  }

  private anyTransformActive(): boolean {
    if (this.tempoRatio !== 1) {
      return true;
    }
    for (const stem of this.stems.values()) {
      if (stem.pitchAdjustable && stem.effectivePitchSemitones !== 0) {
        return true;
      }
    }
    return false;
  }

  private stemRenderTransform(stem: LoadedStem): RenderTransform | null {
    // When any stem is transposed/time-stretched, route EVERY stem (including
    // drums, at pitch 0) through the same offline SoundTouch pass. The processor
    // adds a small constant time offset to whatever it touches; rendering all
    // stems keeps them on the identical path so they stay phase-locked, instead
    // of leaving drums un-processed and a few–tens of ms ahead of the rest.
    if (!this.anyTransformActive()) {
      return null;
    }
    const pitchSemitones = stem.pitchAdjustable ? stem.effectivePitchSemitones : 0;
    return { pitchSemitones, playbackRate: this.tempoRatio };
  }

  private static transformsEqual(a: RenderTransform | null, b: RenderTransform | null) {
    if (a === null || b === null) {
      return a === b;
    }
    return a.pitchSemitones === b.pitchSemitones && a.playbackRate === b.playbackRate;
  }

  private async reconcileRenderedBuffers(epoch: number) {
    if (this.playbackEpoch !== epoch) {
      return;
    }

    this.updateEffectivePitchState();

    const targets = [...this.stems.values()].map((stem) => ({
      stem,
      desired: this.stemRenderTransform(stem)
    }));
    const needsWork = targets.some(
      ({ stem, desired }) => !AudioEngine.transformsEqual(desired, stem.renderedTransform)
    );
    if (!needsWork) {
      this.renderedTempoRatio = this.tempoRatio;
      this.applyMasterGainForStoppedPlayback();
      return;
    }

    const wasPlaying = this.playing;
    const resumePosition = wasPlaying ? this.getPosition() : this.position;

    if (wasPlaying) {
      // Pin the playhead at the current spot so it holds steady during render.
      this.position = resumePosition;
      await this.fadeMasterGain(0);
      if (this.playbackEpoch !== epoch) {
        return;
      }
      this.stopSources();
    }

    const pending = targets.filter(
      ({ stem, desired }) =>
        stem.originalBuffer && !AudioEngine.transformsEqual(desired, stem.renderedTransform)
    );

    this.rendering = true;
    this.renderProgress = { done: 0, total: pending.length };
    this.emit();

    try {
      // Render stems concurrently (capped) so a six-stem song does not wait
      // through six sequential offline passes. The cap bounds peak memory.
      await this.mapWithConcurrency(pending, RENDER_CONCURRENCY, async ({ stem, desired }) => {
        if (!desired) {
          stem.buffer = stem.originalBuffer;
          stem.renderedTransform = null;
          stem.pitchShiftError = null;
        } else {
          try {
            stem.buffer = await this.createRenderedBuffer(stem.originalBuffer!, desired);
            stem.renderedTransform = desired;
            stem.pitchShiftError = null;
          } catch (error) {
            stem.buffer = stem.originalBuffer;
            stem.renderedTransform = null;
            stem.pitchShiftError = error instanceof Error ? error.message : String(error);
          }
        }
        this.renderProgress = { done: this.renderProgress.done + 1, total: pending.length };
        this.emit();
      });
    } finally {
      this.rendering = false;
      this.renderProgress = { done: 0, total: 0 };
    }

    if (this.playbackEpoch !== epoch) {
      return;
    }

    this.renderedTempoRatio = this.tempoRatio;

    if (wasPlaying && this.isPlaybackCurrent(epoch)) {
      this.position = resumePosition;
      this.startedAt = this.audioContext.currentTime;
      this.startSources(resumePosition);
      this.rampMasterGain(this.currentMasterGainTarget());
    } else {
      this.applyMasterGainForStoppedPlayback();
    }
    this.emit();
  }

  private async reconcilePitchGraph(epoch: number) {
    // A newer transition (stop, pause, seek, new song, or a fresh play) has
    // superseded the change that scheduled this reconcile. Bail so we never
    // restart sources against a stale playhead.
    if (!this.isPlaybackCurrent(epoch)) {
      return;
    }

    if (!this.pitchRoutingNeedsRestart()) {
      await this.syncPitchNodes();
      if (!this.isPlaybackCurrent(epoch)) {
        return;
      }
      this.updateActiveSourcePlaybackRates();
      this.rampMasterGain(this.currentMasterGainTarget());
      return;
    }

    await this.fadeMasterGain(0);
    if (!this.isPlaybackCurrent(epoch)) {
      return;
    }

    const nextPosition = this.getPosition();
    this.stopSources();
    await this.syncPitchNodes();
    // The pitch worklet can take tens of milliseconds to initialize. If the
    // user stopped/seeked during that window, abort instead of launching
    // sources the engine would otherwise treat as stopped.
    if (!this.isPlaybackCurrent(epoch)) {
      return;
    }
    this.position = nextPosition;
    this.startedAt = this.audioContext.currentTime;
    this.startSources(nextPosition);
    this.rampMasterGain(this.currentMasterGainTarget());
  }

  private isPlaybackCurrent(epoch: number) {
    return this.playing && this.playbackEpoch === epoch;
  }

  private async mapWithConcurrency<T>(
    items: readonly T[],
    limit: number,
    task: (item: T) => Promise<void>
  ): Promise<void> {
    const queue = [...items];
    const runWorker = async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await task(item);
      }
    };
    const workerCount = Math.max(1, Math.min(limit, queue.length));
    await Promise.all(Array.from({ length: workerCount }, runWorker));
  }

  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.graphMutation.then(task, task);
    this.graphMutation = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private stemNeedsPitchNode(stem: LoadedStem) {
    if (this.renderMode) {
      // Pitch/tempo are baked into rendered buffers; no real-time nodes exist.
      return false;
    }
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
    if (this.masterLimiterNode) {
      this.masterGainNode.connect(this.masterLimiterNode);
      this.masterLimiterNode.connect(this.audioContext.destination);
    } else {
      this.masterGainNode.connect(this.audioContext.destination);
    }
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
      if (this.loop && currentPosition >= this.loop.end) {
        this.seek(this.loop.start);
        return;
      }
      if (currentPosition >= this.duration) {
        if (this.loop) {
          this.seek(this.loop.start);
        } else {
          this.stop();
        }
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
