import { describe, expect, it } from 'vitest';
import stemRowSource from './StemRow.svelte?raw';

describe('StemRow', () => {
  it('keeps the volume control inside the disclosure details', () => {
    const detailsIndex = stemRowSource.indexOf('class="stem-details"');
    const volumeIndex = stemRowSource.indexOf('class="volume-control"');

    expect(detailsIndex).toBeGreaterThanOrEqual(0);
    expect(volumeIndex).toBeGreaterThan(detailsIndex);
  });

  it('no longer exposes any per-stem transpose controls', () => {
    expect(stemRowSource).not.toContain('stem-pitch-control');
    expect(stemRowSource).not.toContain('onPitchCorrection');
    expect(stemRowSource).not.toContain('transpose one semitone');
  });
});
