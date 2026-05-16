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
  it('clamps transpose values to the supported musical range', () => {
    expect(clampPitchSemitones(PITCH_SEMITONE_MAX + 4)).toBe(PITCH_SEMITONE_MAX);
    expect(clampPitchSemitones(PITCH_SEMITONE_MIN - 4)).toBe(PITCH_SEMITONE_MIN);
    expect(clampPitchSemitones(3)).toBe(3);
  });

  it('combines global transpose and per-stem correction for harmonic stems', () => {
    expect(effectiveStemPitchSemitones('vocals', 2, -1)).toBe(1);
    expect(effectiveStemPitchSemitones('guitar', -2, 5)).toBe(3);
  });

  it('keeps drums at original pitch even when global transpose or correction is set', () => {
    expect(isPitchAdjustableStem('drums')).toBe(false);
    expect(effectiveStemPitchSemitones('drums', 7, -4)).toBe(0);
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
});
