import { describe, expect, it } from 'vitest';
import transportBarSource from './TransportBar.svelte?raw';

describe('TransportBar', () => {
  it('places transport action buttons in two rows with mixer between stop and sections', () => {
    const primaryRowIndex = transportBarSource.indexOf('class="transport-actions-primary"');
    const secondaryRowIndex = transportBarSource.indexOf('class="transport-actions-secondary"');
    const playButtonIndex = transportBarSource.indexOf('>\n            Play', primaryRowIndex);
    const stopButtonIndex = transportBarSource.indexOf('>Stop</button>', primaryRowIndex);
    const mixerButtonIndex = transportBarSource.indexOf('>\n          Mixer', primaryRowIndex);
    const sectionsButtonIndex = transportBarSource.indexOf('>\n          Sections', secondaryRowIndex);
    const lyricsButtonIndex = transportBarSource.indexOf('>\n          Lyrics', secondaryRowIndex);

    expect(primaryRowIndex).toBeGreaterThanOrEqual(0);
    expect(secondaryRowIndex).toBeGreaterThan(primaryRowIndex);
    expect(playButtonIndex).toBeGreaterThan(primaryRowIndex);
    expect(stopButtonIndex).toBeGreaterThan(playButtonIndex);
    expect(mixerButtonIndex).toBeGreaterThan(stopButtonIndex);
    expect(mixerButtonIndex).toBeLessThan(secondaryRowIndex);
    expect(sectionsButtonIndex).toBeGreaterThan(secondaryRowIndex);
    expect(sectionsButtonIndex).toBeGreaterThanOrEqual(0);
    expect(lyricsButtonIndex).toBeGreaterThan(sectionsButtonIndex);
  });

  it('wires the mixer toggle to a floating mixer popover', () => {
    expect(transportBarSource).toContain('mixerOpen?: boolean');
    expect(transportBarSource).toContain('hasMixer?: boolean');
    expect(transportBarSource).toContain('onMixerToggle?: () => void');
    expect(transportBarSource).toContain('aria-controls="mixer-popover"');
    expect(transportBarSource).toContain('aria-expanded={mixerOpen}');
    expect(transportBarSource).toContain('onclick={onMixerToggle}');
  });

  it('wires the lyrics toggle after sections', () => {
    const sectionsButtonIndex = transportBarSource.indexOf('Sections');
    const lyricsButtonIndex = transportBarSource.indexOf('Lyrics');

    expect(transportBarSource).toContain('aria-controls="lyrics-popover"');
    expect(transportBarSource).toContain('aria-expanded={lyricsOpen}');
    expect(transportBarSource).toContain('onclick={onLyricsToggle}');
    expect(lyricsButtonIndex).toBeGreaterThan(sectionsButtonIndex);
  });

  it('places global transpose controls after the transport readouts', () => {
    const actionsIndex = transportBarSource.indexOf('class="transport-actions"');
    const seekIndex = transportBarSource.indexOf('class="transport-seek"');
    const readoutsIndex = transportBarSource.indexOf('class="transport-readouts"');
    const bpmIndex = transportBarSource.indexOf('class="bpm-control"');
    const transposeIndex = transportBarSource.indexOf('class="transpose-control"');

    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(seekIndex).toBeGreaterThan(actionsIndex);
    expect(readoutsIndex).toBeGreaterThan(seekIndex);
    expect(bpmIndex).toBeGreaterThan(readoutsIndex);
    expect(transposeIndex).toBeGreaterThan(bpmIndex);
  });

  it('wires target BPM controls to tempo callbacks', () => {
    expect(transportBarSource).toContain('sourceBpm?: number');
    expect(transportBarSource).toContain('tempoRatio?: number');
    expect(transportBarSource).toContain('onTempoRatio?: (ratio: number) => void');
    expect(transportBarSource).toContain('onTempoReset?: () => void');
    expect(transportBarSource).toContain('aria-label="Target BPM"');
    expect(transportBarSource).toContain('onclick={() => changeTargetBpm(-1)}');
    expect(transportBarSource).toContain('onclick={() => changeTargetBpm(1)}');
    expect(transportBarSource).toContain('onclick={onTempoReset}');
    expect(transportBarSource).toContain('oninput={handleTempoInput}');
    expect(transportBarSource).toContain('Current BPM');
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
