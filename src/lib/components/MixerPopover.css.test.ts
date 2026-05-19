import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appCss = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');

describe('MixerPopover responsive CSS', () => {
  it('tightens mixer channel strips for portrait phone screens', () => {
    const portraitRuleIndex = appCss.indexOf('@media (max-width: 32em) and (orientation: portrait)');
    const desktopRuleIndex = appCss.indexOf('@media (min-width: 37.5em)');

    expect(portraitRuleIndex).toBeGreaterThanOrEqual(0);
    expect(portraitRuleIndex).toBeLessThan(desktopRuleIndex);
    expect(appCss).toContain('grid-auto-columns: minmax(2.8rem, 1fr)');
    expect(appCss).toContain('grid-template-rows: 3.2rem minmax(1.65rem, auto) 5.6rem auto auto');
    expect(appCss).toContain('grid-template-columns: repeat(2, 1.35rem)');
    expect(appCss).toContain('font-size: 0.62rem');
  });
});
