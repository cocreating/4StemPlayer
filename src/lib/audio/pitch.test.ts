import { describe, expect, it } from 'vitest';
import {
  PITCH_SEMITONE_MAX,
  PITCH_SEMITONE_MIN,
  clampPitchSemitones,
  effectiveStemPitchSemitones,
  formatPitchSemitones,
  isPitchAdjustableStem,
  masterGainForPitchSemitones
} from './pitch';

describe('pitch policy', () => {
  it('clamps transpose values to the supported musical range [-3, 3]', () => {
    expect(PITCH_SEMITONE_MIN).toBe(-3);
    expect(PITCH_SEMITONE_MAX).toBe(3);
    expect(clampPitchSemitones(PITCH_SEMITONE_MAX + 4)).toBe(3);
    expect(clampPitchSemitones(PITCH_SEMITONE_MIN - 4)).toBe(-3);
    expect(clampPitchSemitones(2)).toBe(2);
    expect(clampPitchSemitones(-2)).toBe(-2);
  });

  it('applies the global transpose to harmonic stems', () => {
    expect(effectiveStemPitchSemitones('vocals', 2)).toBe(2);
    expect(effectiveStemPitchSemitones('guitar', -3)).toBe(-3);
  });

  it('keeps drums at original pitch even when global transpose is set', () => {
    expect(isPitchAdjustableStem('drums')).toBe(false);
    expect(effectiveStemPitchSemitones('drums', 7)).toBe(0);
  });

  it('formats semitone values for compact controls', () => {
    expect(formatPitchSemitones(0)).toBe('0 st');
    expect(formatPitchSemitones(2)).toBe('+2 st');
    expect(formatPitchSemitones(-3)).toBe('-3 st');
  });

  it('applies stronger headroom for upward transpose than downward transpose', () => {
    expect(masterGainForPitchSemitones(0)).toBe(0.7);
    expect(masterGainForPitchSemitones(-2)).toBe(0.7);
    expect(masterGainForPitchSemitones(1)).toBe(0.62);
    expect(masterGainForPitchSemitones(2)).toBe(0.62);
    expect(masterGainForPitchSemitones(3)).toBe(0.55);
  });

  it('measures SoundTouch phase alignment with consistent stretch parameters', async () => {
    const { SoundTouch } = await import('@soundtouchjs/core');
    const sampleRate = 44100;
    const testLength = 44100;
    const inputL = new Float32Array(testLength);
    const inputR = new Float32Array(testLength);
    // Impulse at sample 5000
    inputL[5000] = 1.0;
    inputR[5000] = 1.0;

    function processST(semitones: number, overlapMs = 12, quickSeek = false) {
      const st = new SoundTouch({ sampleRate }) as unknown as {
        virtualPitch: number;
        stretch: { setParameters: (rate: number, a: number, b: number, overlap: number) => void; _quickSeek: boolean; process: () => void };
        transposer: { process: () => void };
        _inputBuffer: { putSamples: (samples: Float32Array, offset: number, count: number) => void };
        _outputBuffer: { frameCount: number; extract: (dest: Float32Array, offset: number, count: number) => void };
      };
      st.virtualPitch = Math.pow(2, semitones / 12);
      st.stretch.setParameters(sampleRate, 0, 0, overlapMs);
      st.stretch._quickSeek = quickSeek;
      
      const interleaved = new Float32Array(testLength * 2);
      for (let i = 0; i < testLength; i++) {
        interleaved[i * 2] = inputL[i];
        interleaved[i * 2 + 1] = inputR[i];
      }
      st._inputBuffer.putSamples(interleaved, 0, testLength);
      st.transposer.process();
      st.stretch.process();
      const outFrames = st._outputBuffer.frameCount;
      const outInterleaved = new Float32Array(outFrames * 2);
      st._outputBuffer.extract(outInterleaved, 0, outFrames);
      let maxIdx = -1;
      let maxVal = 0;
      for (let i = 0; i < outFrames; i++) {
        const val = Math.abs(outInterleaved[i * 2]);
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
      }
      return { outFrames, maxIdx, maxVal, delaySamples: maxIdx - 5000 };
    }

    const res0 = processST(0, 12, false);
    const resP1 = processST(1, 12, false);
    const resP2 = processST(2, 12, false);
    const resP3 = processST(3, 12, false);
    const resM1 = processST(-1, 12, false);
    const resM2 = processST(-2, 12, false);
    const resM3 = processST(-3, 12, false);

    expect(res0.maxIdx).toBe(resP1.maxIdx);
    expect(res0.maxIdx).toBe(resP2.maxIdx);
    expect(res0.maxIdx).toBe(resP3.maxIdx);
    expect(res0.maxIdx).toBe(resM1.maxIdx);
    expect(res0.maxIdx).toBe(resM2.maxIdx);
    expect(res0.maxIdx).toBe(resM3.maxIdx);
  });
});

