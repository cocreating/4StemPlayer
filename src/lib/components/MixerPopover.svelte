<script lang="ts">
  import { type AudioEngineSnapshot, type StemName } from '$lib/audio/AudioEngine';
  import { orderedStemNames } from '$lib/songs';
  import type { SongManifestEntry } from '$lib/types';

  type Props = {
    snapshot: AudioEngineSnapshot;
    manifestEntry: SongManifestEntry;
    open?: boolean;
    disabled?: boolean;
    onClose?: () => void;
    onMute?: (name: StemName, muted: boolean) => void;
    onSolo?: (name: StemName, solo: boolean) => void;
    onVolume?: (name: StemName, volume: number) => void;
  };

  let {
    snapshot,
    manifestEntry,
    open = false,
    disabled = false,
    onClose = () => {},
    onMute = () => {},
    onSolo = () => {},
    onVolume = () => {}
  }: Props = $props();

  let stemNames = $derived(orderedStemNames(manifestEntry.stems));
  const LED_LEVELS = [0.03, 0.07, 0.12, 0.2, 0.34, 0.52, 0.74];

  function handleVolumeInput(stemName: StemName, event: Event) {
    onVolume(stemName, Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

{#if open}
  <section
    id="mixer-popover"
    class="mixer-popover mixer-popover-open panel"
    aria-labelledby="mixer-popover-title"
  >
    <div class="mixer-popover-header">
      <h2 id="mixer-popover-title">Mixer</h2>
      <button
        type="button"
        class="mixer-popover-close"
        aria-label="Close mixer"
        onclick={onClose}
      >
        Close
      </button>
    </div>

    <div class="mixer-deck">
      <div class="mixer-channel-bank" aria-label="Volume faders">
        {#each stemNames as stemName}
          {@const stem = snapshot.stems[stemName]}
          {#if stem}
            <div class:mixer-channel-muted={stem.muted} class:solo={stem.solo} class="mixer-channel-strip">
              <div class="mixer-led-meter" aria-hidden="true">
                {#each LED_LEVELS as level}
                  <span class:lit={stem.meterLevel >= level}></span>
                {/each}
              </div>
              <label for={`${stem.name}-mixer-volume`}>{stem.label}</label>
              <input
                id={`${stem.name}-mixer-volume`}
                class="mixer-channel-fader"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={stem.volume}
                disabled={disabled || !stem.loaded}
                aria-label={`${stem.label} volume`}
                oninput={(event) => handleVolumeInput(stemName, event)}
              />
              <output for={`${stem.name}-mixer-volume`}>{Math.round(stem.volume * 100)}%</output>
              <div class="mixer-channel-actions" aria-label={`${stem.label} mixer controls`}>
                <button
                  type="button"
                  class:active={stem.muted}
                  aria-pressed={stem.muted}
                  aria-label={`Mute ${stem.label}`}
                  title={`Mute ${stem.label}`}
                  disabled={disabled || !stem.loaded}
                  onclick={() => onMute(stemName, !stem.muted)}
                >
                  M
                </button>
                <button
                  type="button"
                  class:active={stem.solo}
                  aria-pressed={stem.solo}
                  aria-label={`Solo ${stem.label}`}
                  title={`Solo ${stem.label}`}
                  disabled={disabled || !stem.loaded}
                  onclick={() => onSolo(stemName, !stem.solo)}
                >
                  S
                </button>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </section>
{/if}
