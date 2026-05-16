import { describe, expect, it } from 'vitest';
import { shouldToggleStemDisclosureFromClick, stemDisclosureLabel } from './stemDisclosure';

describe('stemDisclosureLabel', () => {
  it('labels an expanded stem switch as a collapse action', () => {
    expect(stemDisclosureLabel('Vocals', true)).toBe('Collapse Vocals details');
  });

  it('labels a collapsed stem switch as an expand action', () => {
    expect(stemDisclosureLabel('Drums', false)).toBe('Expand Drums details');
  });
});

describe('shouldToggleStemDisclosureFromClick', () => {
  function createStemRow() {
    const row = document.createElement('article');
    row.className = 'stem-row';
    row.innerHTML = `
      <div class="stem-controls">
        <div class="stem-title"><h2>Vocals</h2></div>
        <div class="stem-buttons">
          <button type="button">Mute</button>
          <button type="button">Solo</button>
        </div>
        <button type="button" class="stem-disclosure" role="switch"></button>
      </div>
      <div class="stem-details">
        <input type="range" />
        <div class="waveform-canvas"></div>
      </div>
    `;
    document.body.append(row);
    return row;
  }

  it('toggles when the row heading is clicked', () => {
    const row = createStemRow();
    const heading = row.querySelector('h2');

    expect(shouldToggleStemDisclosureFromClick(heading, row)).toBe(true);

    row.remove();
  });

  it('toggles when the disclosure switch is clicked', () => {
    const row = createStemRow();
    const disclosure = row.querySelector('.stem-disclosure');

    expect(shouldToggleStemDisclosureFromClick(disclosure, row)).toBe(true);

    row.remove();
  });

  it('ignores mute and solo button clicks', () => {
    const row = createStemRow();
    const [muteButton, soloButton] = row.querySelectorAll('.stem-buttons button');

    expect(shouldToggleStemDisclosureFromClick(muteButton, row)).toBe(false);
    expect(shouldToggleStemDisclosureFromClick(soloButton, row)).toBe(false);

    row.remove();
  });

  it('ignores detail control clicks', () => {
    const row = createStemRow();
    const volume = row.querySelector('input');
    const waveform = row.querySelector('.waveform-canvas');

    expect(shouldToggleStemDisclosureFromClick(volume, row)).toBe(false);
    expect(shouldToggleStemDisclosureFromClick(waveform, row)).toBe(false);

    row.remove();
  });
});
