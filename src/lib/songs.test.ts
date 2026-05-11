import { describe, expect, it } from 'vitest';
import { formatChords, formatDurationSeconds, formatMetadataDuration } from './songs';

describe('formatChords', () => {
  it('formats structured chord sections for display', () => {
    expect(
      formatChords({
        intro: { progression: 'Dm | Dm/C | Bm7b5 | Bbmaj7' },
        verse: { label: 'Verse 1', progression: 'Gm | Bb | Eb | D', notes: 'Repeat twice.' },
        chorus: { progression: 'Eb | F | Gm | Gm' }
      })
    ).toBe(
      [
        'Intro: Dm | Dm/C | Bm7b5 | Bbmaj7',
        'Verse 1: Gm | Bb | Eb | D',
        'Repeat twice.',
        'Chorus: Eb | F | Gm | Gm'
      ].join('\n')
    );
  });

  it('keeps legacy string chords readable', () => {
    expect(formatChords('Verse: Gm | Bb | Eb | D')).toBe('Verse: Gm | Bb | Eb | D');
  });
});

describe('duration metadata helpers', () => {
  it('formats a readable duration from durationSeconds when duration is missing', () => {
    expect(formatMetadataDuration({ durationSeconds: 306 })).toBe('5:06');
  });

  it('prefers explicit readable duration metadata', () => {
    expect(formatMetadataDuration({ duration: '5:06', durationSeconds: 306 })).toBe('5:06');
  });

  it('formats durationSeconds as seconds only', () => {
    expect(formatDurationSeconds(306)).toBe('306');
  });

  it('formats fractional transport positions as whole seconds only', () => {
    expect(formatDurationSeconds(42.7)).toBe('43');
  });
});
