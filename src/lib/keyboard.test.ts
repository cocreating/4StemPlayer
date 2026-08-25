import { describe, expect, it } from 'vitest';
import { resolveKeyboardAction, shouldHandlePlaybackShortcut } from './keyboard';

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

describe('resolveKeyboardAction', () => {
  it('resolves Space to play-pause', () => {
    expect(resolveKeyboardAction({ code: 'Space', repeat: false })).toEqual({ type: 'play-pause' });
  });

  it('resolves Escape to escape action', () => {
    expect(resolveKeyboardAction({ code: 'Escape', key: 'Escape', repeat: false })).toEqual({
      type: 'escape'
    });
  });

  it('resolves ArrowLeft and ArrowRight to seek actions with shiftKey support', () => {
    expect(resolveKeyboardAction({ code: 'ArrowLeft', repeat: false })).toEqual({
      type: 'seek',
      delta: -5
    });
    expect(resolveKeyboardAction({ code: 'ArrowLeft', shiftKey: true, repeat: false })).toEqual({
      type: 'seek',
      delta: -15
    });
    expect(resolveKeyboardAction({ code: 'ArrowRight', repeat: false })).toEqual({
      type: 'seek',
      delta: 5
    });
    expect(resolveKeyboardAction({ code: 'ArrowRight', shiftKey: true, repeat: false })).toEqual({
      type: 'seek',
      delta: 15
    });
  });

  it('resolves Home or 0 to rewind to 0', () => {
    expect(resolveKeyboardAction({ code: 'Home', repeat: false })).toEqual({
      type: 'seek-to',
      position: 0
    });
    expect(resolveKeyboardAction({ code: 'Digit0', key: '0', repeat: false })).toEqual({
      type: 'seek-to',
      position: 0
    });
  });

  it('resolves brackets to transpose actions', () => {
    expect(resolveKeyboardAction({ code: 'BracketLeft', key: '[', repeat: false })).toEqual({
      type: 'transpose',
      delta: -1
    });
    expect(resolveKeyboardAction({ code: 'BracketRight', key: ']', repeat: false })).toEqual({
      type: 'transpose',
      delta: 1
    });
  });

  it('resolves L key to loop-toggle action', () => {
    expect(resolveKeyboardAction({ code: 'KeyL', key: 'l', repeat: false })).toEqual({
      type: 'loop-toggle'
    });
    expect(resolveKeyboardAction({ key: 'L', repeat: false })).toEqual({
      type: 'loop-toggle'
    });
  });

  it('returns null when repeating or targeting editable fields', () => {
    expect(resolveKeyboardAction({ code: 'Space', repeat: true })).toBeNull();
    expect(
      resolveKeyboardAction({
        code: 'Space',
        repeat: false,
        target: { tagName: 'INPUT' }
      })
    ).toBeNull();
  });
});
