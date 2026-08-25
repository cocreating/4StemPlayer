export interface KeyboardShortcutEvent {
  code?: string;
  key?: string;
  repeat: boolean;
  shiftKey?: boolean;
  target?: unknown;
}

const editableTagNames = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

export function isEditableTarget(target: unknown) {
  if (!(target instanceof HTMLElement)) {
    const maybeElement = target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
    return Boolean(
      maybeElement?.isContentEditable ||
        (maybeElement?.tagName && editableTagNames.has(maybeElement.tagName.toUpperCase()))
    );
  }

  return editableTagNames.has(target.tagName) || target.isContentEditable;
}

export function shouldHandlePlaybackShortcut(event: KeyboardShortcutEvent) {
  const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
  return isSpace && !event.repeat && !isEditableTarget(event.target);
}

export type KeyboardAction =
  | { type: 'play-pause' }
  | { type: 'seek'; delta: number }
  | { type: 'seek-to'; position: number }
  | { type: 'escape' }
  | { type: 'transpose'; delta: number }
  | { type: 'loop-toggle' }
  | null;

export function resolveKeyboardAction(event: KeyboardShortcutEvent): KeyboardAction {
  if (event.repeat || isEditableTarget(event.target)) {
    return null;
  }

  const key = event.key;
  const code = event.code;

  if (code === 'Space' || key === ' ' || key === 'Spacebar') {
    return { type: 'play-pause' };
  }

  if (key === 'Escape' || code === 'Escape') {
    return { type: 'escape' };
  }

  if (key === 'l' || key === 'L' || code === 'KeyL') {
    return { type: 'loop-toggle' };
  }

  if (key === 'ArrowLeft' || code === 'ArrowLeft') {
    return { type: 'seek', delta: event.shiftKey ? -15 : -5 };
  }

  if (key === 'ArrowRight' || code === 'ArrowRight') {
    return { type: 'seek', delta: event.shiftKey ? 15 : 5 };
  }

  if (key === 'Home' || code === 'Home' || key === '0' || code === 'Digit0') {
    return { type: 'seek-to', position: 0 };
  }

  if (key === '[' || code === 'BracketLeft') {
    return { type: 'transpose', delta: -1 };
  }

  if (key === ']' || code === 'BracketRight') {
    return { type: 'transpose', delta: 1 };
  }

  return null;
}
