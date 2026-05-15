import { describe, expect, it } from 'vitest';
import { stemDisclosureLabel } from './stemDisclosure';

describe('stemDisclosureLabel', () => {
  it('labels an expanded stem switch as a collapse action', () => {
    expect(stemDisclosureLabel('Vocals', true)).toBe('Collapse Vocals details');
  });

  it('labels a collapsed stem switch as an expand action', () => {
    expect(stemDisclosureLabel('Drums', false)).toBe('Expand Drums details');
  });
});
