import { describe, expect, it } from 'vitest';
import { buildMediaMetadataInit, mediaPositionState } from './pwa';

describe('buildMediaMetadataInit', () => {
  it('uses the song title and artist when present', () => {
    const meta = buildMediaMetadataInit('Glory Box', 'Portishead');
    expect(meta.title).toBe('Glory Box');
    expect(meta.artist).toBe('Portishead');
    expect(meta.artwork.map((a) => a.src)).toContain('/icons/icon-512.png');
  });

  it('falls back to the app name and empty artist when missing', () => {
    const meta = buildMediaMetadataInit('  ', undefined);
    expect(meta.title).toBe('4Stem Band Player');
    expect(meta.artist).toBe('');
  });
});

describe('mediaPositionState', () => {
  it('clamps the position into the valid range', () => {
    expect(mediaPositionState(100, 150)).toEqual({ duration: 100, position: 100, playbackRate: 1 });
    expect(mediaPositionState(100, -5)).toEqual({ duration: 100, position: 0, playbackRate: 1 });
  });

  it('returns null for an unusable duration', () => {
    expect(mediaPositionState(0, 0)).toBeNull();
    expect(mediaPositionState(Number.NaN, 1)).toBeNull();
  });

  it('keeps a positive custom playback rate and rejects bad ones', () => {
    expect(mediaPositionState(60, 30, 1.25)?.playbackRate).toBe(1.25);
    expect(mediaPositionState(60, 30, 0)?.playbackRate).toBe(1);
  });
});
