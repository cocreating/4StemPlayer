interface KeyboardShortcutEvent {
  code?: string;
  key?: string;
  repeat: boolean;
  target?: unknown;
}

const editableTagNames = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

function isEditableTarget(target: unknown) {
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
