import type { StemName } from './AudioEngine';

export const PITCH_SEMITONE_MIN = -12;
export const PITCH_SEMITONE_MAX = 12;

export function clampPitchSemitones(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(PITCH_SEMITONE_MAX, Math.max(PITCH_SEMITONE_MIN, Math.round(value)));
}

export function isPitchAdjustableStem(stemName: StemName) {
  return stemName !== 'drums';
}

export function effectiveStemPitchSemitones(
  stemName: StemName,
  globalTransposeSemitones: number,
  stemCorrectionSemitones: number
) {
  if (!isPitchAdjustableStem(stemName)) {
    return 0;
  }

  return clampPitchSemitones(globalTransposeSemitones + stemCorrectionSemitones);
}

export function formatPitchSemitones(value: number) {
  const semitones = clampPitchSemitones(value);
  return `${semitones > 0 ? '+' : ''}${semitones} st`;
}

export function masterGainForPitchSemitones(value: number) {
  const semitones = clampPitchSemitones(value);
  if (semitones >= 3) {
    return 0.55;
  }
  if (semitones > 0) {
    return 0.62;
  }
  return 0.7;
}
