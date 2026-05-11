import { describe, expect, it } from 'vitest';
import { shouldHandlePlaybackShortcut } from './keyboard';

describe('shouldHandlePlaybackShortcut', () => {
  it('handles Space key presses for playback', () => {
    expect(shouldHandlePlaybackShortcut({ code: 'Space', repeat: false })).toBe(true);
  });

  it('handles Space by key value when code is unavailable', () => {
    expect(shouldHandlePlaybackShortcut({ key: ' ', repeat: false })).toBe(true);
  });

  it('ignores repeated Space keydown events', () => {
    expect(shouldHandlePlaybackShortcut({ code: 'Space', repeat: true })).toBe(false);
  });

  it('ignores non-Space key presses', () => {
    expect(shouldHandlePlaybackShortcut({ code: 'Enter', repeat: false })).toBe(false);
  });

  it('handles Space when focus is on a button', () => {
    expect(
      shouldHandlePlaybackShortcut({
        code: 'Space',
        repeat: false,
        target: { tagName: 'BUTTON' }
      })
    ).toBe(true);
  });

  it('ignores Space when focus is inside form controls or editable content', () => {
    for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) {
      expect(
        shouldHandlePlaybackShortcut({
          code: 'Space',
          repeat: false,
          target: { tagName }
        })
      ).toBe(false);
    }

    expect(
      shouldHandlePlaybackShortcut({
        code: 'Space',
        repeat: false,
        target: { tagName: 'DIV', isContentEditable: true }
      })
    ).toBe(false);
  });
});
