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

function makeEngine() {
  const context = new FakeAudioContext();
  const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));
  const engine = new AudioEngine({
    audioContext: context as unknown as AudioContext,
    fetchArrayBuffer
  });
  return { context, engine, fetchArrayBuffer };
}

describe('AudioEngine', () => {
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

    const [vocalsGain, drumsGain, bassGain, otherGain] = context.gains;
    expect(vocalsGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 0 });
    expect(drumsGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 1 });
    expect(bassGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 0 });
    expect(otherGain.gain.events.at(-1)).toMatchObject({ type: 'ramp', value: 0 });
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
    const firstGains = [...context.gains];

    await engine.loadSong({
      id: 'second',
      title: 'Second Song',
      stems: stemNames.map((name) => ({ name, label: name, url: `second-${name}.mp3` }))
    });

    expect(firstSources.every((source) => source.stopped)).toBe(true);
    expect(firstGains.every((gain) => gain.disconnected)).toBe(true);
  });
});
