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
});
