import { describe, expect, it } from 'vitest';
import appShellSource from './AppShell.svelte?raw';
import mixerPopoverSource from './MixerPopover.svelte?raw';

describe('MixerPopover', () => {
  it('renders a dedicated compact mixer instead of the full stem mixer', () => {
    expect(mixerPopoverSource).not.toContain("import StemMixer");
    expect(mixerPopoverSource).toContain('class="mixer-deck"');
    expect(mixerPopoverSource).toContain('class="mixer-channel-fader"');
    expect(mixerPopoverSource).toContain('class="mixer-channel-actions"');
    expect(mixerPopoverSource).toContain('class="mixer-led-meter"');
    expect(mixerPopoverSource).toContain('stem.meterLevel >= level');
    expect(mixerPopoverSource).toContain('function handleVolumeInput');
    expect(mixerPopoverSource).toContain('oninput={(event) => handleVolumeInput(stemName, event)}');
    expect(mixerPopoverSource).toContain('onMute?: (name: StemName, muted: boolean) => void');
    expect(mixerPopoverSource).toContain('onSolo?: (name: StemName, solo: boolean) => void');
    expect(mixerPopoverSource).toContain('onclick={() => onMute(stemName, !stem.muted)}');
    expect(mixerPopoverSource).toContain('onclick={() => onSolo(stemName, !stem.solo)}');
    expect(mixerPopoverSource).not.toContain('onPitchCorrection');
    expect(mixerPopoverSource).not.toContain('WaveformView');
  });

  it('keeps the existing full stem mixer mounted in the main player stack', () => {
    const transportShellIndex = appShellSource.indexOf('class="transport-shell"');
    const mixerPopoverIndex = appShellSource.indexOf('<MixerPopover');
    const stemMixerIndex = appShellSource.indexOf('<StemMixer');
    const infoStackIndex = appShellSource.indexOf('class="info-stack"');

    expect(appShellSource).toContain("import StemMixer from './StemMixer.svelte'");
    expect(mixerPopoverIndex).toBeGreaterThan(transportShellIndex);
    expect(stemMixerIndex).toBeGreaterThan(mixerPopoverIndex);
    expect(stemMixerIndex).toBeLessThan(infoStackIndex);
    expect(appShellSource).toContain('onMute={(name, muted) => engine?.setMuted(name, muted)}');
    expect(appShellSource).toContain('onSolo={(name, solo) => engine?.setSolo(name, solo)}');
  });

  it('binds mixer controls to the same stem state as the track panels', () => {
    expect(mixerPopoverSource).toContain('value={stem.volume}');
    expect(mixerPopoverSource).toContain('aria-pressed={stem.muted}');
    expect(mixerPopoverSource).toContain('aria-pressed={stem.solo}');
    expect(mixerPopoverSource).toContain('aria-label={`Mute ${stem.label}`}');
    expect(mixerPopoverSource).toContain('aria-label={`Solo ${stem.label}`}');
    expect(mixerPopoverSource).toContain('oninput={(event) => handleVolumeInput(stemName, event)}');
    expect(appShellSource).toContain('onVolume={(name, volume) => engine?.setVolume(name, volume)}');
  });
});
