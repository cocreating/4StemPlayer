import { describe, expect, it } from 'vitest';
import stemRowSource from './StemRow.svelte?raw';

describe('StemRow', () => {
  it('keeps stem transpose controls hidden in details after volume', () => {
    const detailsIndex = stemRowSource.indexOf('class="stem-details"');
    const volumeIndex = stemRowSource.indexOf('class="volume-control"');
    const pitchIndex = stemRowSource.indexOf('class="stem-pitch-control"');

    expect(detailsIndex).toBeGreaterThanOrEqual(0);
    expect(volumeIndex).toBeGreaterThan(detailsIndex);
    expect(pitchIndex).toBeGreaterThan(volumeIndex);
  });

  it('places stem transpose buttons together before the stem transpose output', () => {
    const lowerIndex = stemRowSource.indexOf('aria-label={`Lower ${stem.label} transpose one semitone`}');
    const raiseIndex = stemRowSource.indexOf('aria-label={`Raise ${stem.label} transpose one semitone`}');
    const outputIndex = stemRowSource.indexOf('<output aria-label={`${stem.label} transpose`}');

    expect(lowerIndex).toBeGreaterThanOrEqual(0);
    expect(raiseIndex).toBeGreaterThan(lowerIndex);
    expect(outputIndex).toBeGreaterThan(raiseIndex);
  });
});
