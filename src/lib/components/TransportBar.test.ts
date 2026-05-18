import { describe, expect, it } from 'vitest';
import transportBarSource from './TransportBar.svelte?raw';

describe('TransportBar', () => {
  it('places a lyrics toggle directly after the sections toggle', () => {
    const sectionsButtonIndex = transportBarSource.indexOf('Sections');
    const lyricsButtonIndex = transportBarSource.indexOf('Lyrics');

    expect(sectionsButtonIndex).toBeGreaterThanOrEqual(0);
    expect(lyricsButtonIndex).toBeGreaterThan(sectionsButtonIndex);
    expect(transportBarSource).toContain('aria-controls="lyrics-popover"');
    expect(transportBarSource).toContain('aria-expanded={lyricsOpen}');
    expect(transportBarSource).toContain('onclick={onLyricsToggle}');
  });

  it('places global transpose controls after the transport readouts', () => {
    const actionsIndex = transportBarSource.indexOf('class="transport-actions"');
    const seekIndex = transportBarSource.indexOf('class="transport-seek"');
    const readoutsIndex = transportBarSource.indexOf('class="transport-readouts"');
    const transposeIndex = transportBarSource.indexOf('class="transpose-control"');

    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(seekIndex).toBeGreaterThan(actionsIndex);
    expect(readoutsIndex).toBeGreaterThan(seekIndex);
    expect(transposeIndex).toBeGreaterThan(readoutsIndex);
  });

  it('places global transpose buttons together before the global transpose output', () => {
    const lowerIndex = transportBarSource.indexOf('aria-label="Transpose down one semitone"');
    const raiseIndex = transportBarSource.indexOf('aria-label="Transpose up one semitone"');
    const resetIndex = transportBarSource.indexOf('aria-label="Reset global transpose"');
    const outputIndex = transportBarSource.indexOf('aria-label="Global transpose"');

    expect(lowerIndex).toBeGreaterThanOrEqual(0);
    expect(raiseIndex).toBeGreaterThan(lowerIndex);
    expect(resetIndex).toBeGreaterThan(raiseIndex);
    expect(outputIndex).toBeGreaterThan(resetIndex);
  });
});
