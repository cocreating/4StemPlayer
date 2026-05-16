export function stemDisclosureLabel(stemLabel: string, expanded: boolean) {
  return `${expanded ? 'Collapse' : 'Expand'} ${stemLabel} details`;
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="switch"]',
  '[role="slider"]'
].join(',');

export function shouldToggleStemDisclosureFromClick(
  target: EventTarget | null,
  currentTarget: EventTarget | null
) {
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }

  if (!currentTarget.contains(target)) {
    return false;
  }

  const disclosure = target.closest('.stem-disclosure');
  if (disclosure && currentTarget.contains(disclosure)) {
    return true;
  }

  const interactive = target.closest(INTERACTIVE_SELECTOR);
  if (interactive && currentTarget.contains(interactive)) {
    return false;
  }

  const details = target.closest('.stem-details');
  if (details && currentTarget.contains(details)) {
    return false;
  }

  return true;
}
