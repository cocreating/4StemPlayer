import { describe, expect, it } from 'vitest';
import { displayTransportSongTitle } from './transport';

describe('displayTransportSongTitle', () => {
  it('uses the current song title in the transport bar', () => {
    expect(displayTransportSongTitle('Glory Box')).toBe('Glory Box');
  });

  it('does not render empty title text for a missing song', () => {
    expect(displayTransportSongTitle('   ')).toBe('');
  });
});
