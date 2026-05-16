import { describe, expect, it, vi } from 'vitest';
import { AudioEngine, type StemName } from './AudioEngine';

class FakeAudioParam {
  value: number;
  events: Array<{ type: string; value: number; time: number }> = [];

  constructor(value: number) {
    this.value = value;
  }

  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', value: this.value, time });
  }

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'ramp', value, time });
  }
}

class FakeGainNode {
  gain = new FakeAudioParam(1);
  connectedTo: unknown[] = [];
  disconnected = false;

  connect(destination: unknown) {
    this.connectedTo.push(destination);
    return destination;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakePitchShiftNode {
  pitch = new FakeAudioParam(1);
  pitchSemitones = new FakeAudioParam(0);
  playbackRate = new FakeAudioParam(1);
  connectedTo: unknown[] = [];
  disconnected = false;

  connect(destination: unknown) {
    this.connectedTo.push(destination);
    return destination;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null;
  startCalls: Array<{ when: number; offset: number }> = [];
  stopped = false;
  connectedTo: unknown[] = [];
  onended: (() => void) | null = null;

  connect(destination: unknown) {
    this.connectedTo.push(destination);
    return destination;
  }

  start(when: number, offset: number) {
    this.startCalls.push({ when, offset });
  }

  stop() {
    this.stopped = true;
  }

  disconnect() {
    this.connectedTo = [];
  }
}

class FakeAudioContext {
  currentTime = 10;
  destination = {};
  sources: FakeBufferSourceNode[] = [];
  gains: FakeGainNode[] = [];
  decodedBuffers = 0;
  resumed = false;

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createBufferSource() {
    const source = new FakeBufferSourceNode();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  async decodeAudioData() {
    this.decodedBuffers += 1;
    return { duration: 24 } as AudioBuffer;
  }

  async resume() {
    this.resumed = true;
  }
}

const stemNames: StemName[] = ['vocals', 'drums', 'bass', 'other'];
const masterGain = (context: FakeAudioContext) => context.gains[0];
const stemGains = (context: FakeAudioContext) => context.gains.slice(1);

function makeEngine() {
  const context = new FakeAudioContext();
  const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));
  const engine = new AudioEngine({
    audioContext: context as unknown as AudioContext,
    fetchArrayBuffer
  });
  return { context, engine, fetchArrayBuffer };
}

function makeEngineWithPitchShift() {
  const context = new FakeAudioContext();
  const pitchNodes: FakePitchShiftNode[] = [];
  const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));
  const createPitchShiftNode = vi.fn(async () => {
    const node = new FakePitchShiftNode();
    pitchNodes.push(node);
    return node;
  });
  const engine = new AudioEngine({
    audioContext: context as unknown as AudioContext,
    fetchArrayBuffer,
    createPitchShiftNode
  } as unknown as ConstructorParameters<typeof AudioEngine>[0]);
  return { context, engine, fetchArrayBuffer, createPitchShiftNode, pitchNodes };
}

describe('AudioEngine', () => {
  it('routes stem gains through plain master headroom before output', () => {
    const { context } = makeEngine();

    expect(masterGain(context).gain.value).toBe(0.7);
    expect(masterGain(context).connectedTo[0]).toBe(context.destination);
  });

  it('lowers master gain more for upward transpose than downward transpose', async () => {
    const { context, engine } = makeEngineWithPitchShift();
    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });

    await engine.setGlobalTransposeSemitones(2);
    expect(masterGain(context).gain.value).toBe(0.62);

    await engine.setGlobalTransposeSemitones(-2);
    expect(masterGain(context).gain.value).toBe(0.7);

    await engine.setGlobalTransposeSemitones(2);
    await engine.setStemPitchCorrection('bass', 1);
    expect(masterGain(context).gain.value).toBe(0.55);
  });

  it('loads four stems and starts them from one shared playhead', async () => {
    const { context, engine, fetchArrayBuffer } = makeEngine();

    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({
        name,
        label: name,
        url: `/songs/GloryBox/GloryBox_${name}.mp3`
      }))
    });

    await engine.play();

    expect(fetchArrayBuffer).toHaveBeenCalledTimes(4);
    expect(context.decodedBuffers).toBe(4);
    expect(context.sources).toHaveLength(4);
    expect(context.sources.map((source) => source.startCalls[0])).toEqual([
      { when: 0, offset: 0 },
      { when: 0, offset: 0 },
      { when: 0, offset: 0 },
      { when: 0, offset: 0 }
    ]);
  });

  it('loads and exposes optional stems supplied by a song', async () => {
    const { context, engine, fetchArrayBuffer } = makeEngine();

    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: [...stemNames, 'keyboards'].map((name) => ({
        name,
        label: name,
        url: `/songs/GloryBox/GloryBox_${name}.mp3`
      }))
    });

    const snapshot = engine.getSnapshot();

    expect(fetchArrayBuffer).toHaveBeenCalledTimes(5);
    expect(context.decodedBuffers).toBe(5);
    expect(snapshot.stems.keyboards).toMatchObject({
      name: 'keyboards',
      label: 'keyboards',
      loaded: true
    });
  });

  it('seeks every loaded stem through the AudioEngine while preserving sync', async () => {
    const { context, engine } = makeEngine();
    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });
    await engine.play();

    engine.seek(7.5);

    const latestSources = context.sources.slice(-4);
    expect(latestSources.map((source) => source.startCalls[0])).toEqual([
      { when: 0, offset: 7.5 },
      { when: 0, offset: 7.5 },
      { when: 0, offset: 7.5 },
      { when: 0, offset: 7.5 }
    ]);
  });

  it('applies volume, mute, and solo with ramped GainNode changes', async () => {
    const { context, engine } = makeEngine();
    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });

    engine.setVolume('vocals', 0.4);
    engine.setMuted('vocals', true);
    engine.setSolo('drums', true);

    const [vocalsGain, drumsGain, bassGain, otherGain] = stemGains(context);
    expect(vocalsGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 0 });
    expect(drumsGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 1 });
    expect(bassGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 0 });
    expect(otherGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 0 });
  });

  it('combines global transpose with per-stem correction but keeps drums at original pitch', async () => {
    const { engine } = makeEngineWithPitchShift();
    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });

    await engine.setGlobalTransposeSemitones(2);
    await engine.setStemPitchCorrection('bass', -1);
    await engine.setStemPitchCorrection('drums', 5);

    const snapshot = engine.getSnapshot();
    expect(snapshot.globalTransposeSemitones).toBe(2);
    expect(snapshot.stems.vocals).toMatchObject({
      pitchAdjustable: true,
      pitchCorrectionSemitones: 0,
      effectivePitchSemitones: 2
    });
    expect(snapshot.stems.bass).toMatchObject({
      pitchAdjustable: true,
      pitchCorrectionSemitones: -1,
      effectivePitchSemitones: 1
    });
    expect(snapshot.stems.drums).toMatchObject({
      pitchAdjustable: false,
      pitchCorrectionSemitones: 0,
      effectivePitchSemitones: 0
    });
  });

  it('realigns individual stem transpose values when global transpose changes', async () => {
    const { engine } = makeEngineWithPitchShift();
    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });

    await engine.setGlobalTransposeSemitones(2);
    await engine.setStemPitchCorrection('bass', 1);
    expect(engine.getSnapshot().stems.bass).toMatchObject({
      pitchCorrectionSemitones: 1,
      effectivePitchSemitones: 3
    });

    await engine.setGlobalTransposeSemitones(-1);

    const snapshot = engine.getSnapshot();
    expect(snapshot.globalTransposeSemitones).toBe(-1);
    expect(snapshot.stems.vocals).toMatchObject({
      pitchCorrectionSemitones: 0,
      effectivePitchSemitones: -1
    });
    expect(snapshot.stems.bass).toMatchObject({
      pitchCorrectionSemitones: 0,
      effectivePitchSemitones: -1
    });
    expect(snapshot.stems.drums).toMatchObject({
      pitchCorrectionSemitones: 0,
      effectivePitchSemitones: 0
    });

    await engine.adjustStemPitchCorrection('bass', 1);
    expect(engine.getSnapshot().stems.bass).toMatchObject({
      pitchCorrectionSemitones: 1,
      effectivePitchSemitones: 0
    });
  });

  it('routes only non-drum stems with active pitch through pitch shift nodes', async () => {
    const { context, engine, createPitchShiftNode, pitchNodes } = makeEngineWithPitchShift();
    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });

    await engine.setGlobalTransposeSemitones(2);
    await engine.play();

    expect(createPitchShiftNode).toHaveBeenCalledTimes(3);
    expect(pitchNodes.map((node) => node.pitchSemitones.value)).toEqual([2, 2, 2]);
    expect(context.sources[0]?.connectedTo[0]).toBe(pitchNodes[0]);
    expect(context.sources[1]?.connectedTo[0]).toBe(stemGains(context)[1]);
    expect(context.sources[2]?.connectedTo[0]).toBe(pitchNodes[1]);
    expect(context.sources[3]?.connectedTo[0]).toBe(pitchNodes[2]);
    expect(pitchNodes.map((node) => node.connectedTo[0])).toEqual([
      stemGains(context)[0],
      stemGains(context)[2],
      stemGains(context)[3]
    ]);
  });

  it('fades the master output around live pitch graph updates', async () => {
    const context = new FakeAudioContext();
    const waits: number[] = [];
    const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    const createPitchShiftNode = vi.fn(async () => new FakePitchShiftNode());
    const engine = new AudioEngine({
      audioContext: context as unknown as AudioContext,
      fetchArrayBuffer,
      createPitchShiftNode,
      wait: async (milliseconds: number) => {
        waits.push(milliseconds);
      }
    } as unknown as ConstructorParameters<typeof AudioEngine>[0]);

    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });
    await engine.play();
    await engine.setGlobalTransposeSemitones(2);

    expect(waits).toEqual([30]);
    expect(masterGain(context).gain.events.filter((event) => event.type === 'ramp')).toMatchObject([
      { value: 0 },
      { value: 0.62 }
    ]);
  });

  it('updates active pitch nodes without restarting sources when routing is unchanged', async () => {
    const context = new FakeAudioContext();
    const waits: number[] = [];
    const pitchNodes: FakePitchShiftNode[] = [];
    const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    const createPitchShiftNode = vi.fn(async () => {
      const node = new FakePitchShiftNode();
      pitchNodes.push(node);
      return node;
    });
    const engine = new AudioEngine({
      audioContext: context as unknown as AudioContext,
      fetchArrayBuffer,
      createPitchShiftNode,
      wait: async (milliseconds: number) => {
        waits.push(milliseconds);
      }
    } as unknown as ConstructorParameters<typeof AudioEngine>[0]);

    await engine.loadSong({
      id: 'glorybox',
      title: 'Glory Box',
      stems: stemNames.map((name) => ({ name, label: name, url: `${name}.mp3` }))
    });
    await engine.play();
    await engine.setGlobalTransposeSemitones(1);
    waits.length = 0;
    const sourceCount = context.sources.length;

    await engine.setGlobalTransposeSemitones(2);

    expect(waits).toEqual([]);
    expect(context.sources).toHaveLength(sourceCount);
    expect(createPitchShiftNode).toHaveBeenCalledTimes(3);
    expect(pitchNodes.map((node) => node.pitchSemitones.value)).toEqual([2, 2, 2]);
  });

  it('destroys previous audio resources before loading a new song', async () => {
    const { context, engine } = makeEngine();
    await engine.loadSong({
      id: 'first',
      title: 'First Song',
      stems: stemNames.map((name) => ({ name, label: name, url: `first-${name}.mp3` }))
    });
    await engine.play();
    const firstSources = [...context.sources];
    const firstGains = [...stemGains(context)];

    await engine.loadSong({
      id: 'second',
      title: 'Second Song',
      stems: stemNames.map((name) => ({ name, label: name, url: `second-${name}.mp3` }))
    });

    expect(firstSources.every((source) => source.stopped)).toBe(true);
    expect(firstGains.every((gain) => gain.disconnected)).toBe(true);
  });
});
