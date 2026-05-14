export function stemDisclosureLabel(stemLabel: string, expanded: boolean) {
  return `${expanded ? 'Collapse' : 'Expand'} ${stemLabel} details`;
}
