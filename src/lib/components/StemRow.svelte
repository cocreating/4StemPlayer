<script lang="ts">
  import type { StemPlaybackState } from '$lib/audio/AudioEngine';
  import { stemDisclosureLabel } from '$lib/stemDisclosure';
  import WaveformView from './WaveformView.svelte';

  type Props = {
    stem: StemPlaybackState;
    position?: number;
    duration?: number;
    disabled?: boolean;
    peaksUrl?: string;
    onMute?: (muted: boolean) => void;
    onSolo?: (solo: boolean) => void;
    onVolume?: (volume: number) => void;
    onSeek?: (time: number) => void;
  };

  let {
    stem,
    position = 0,
    duration = 0,
    disabled = false,
    peaksUrl,
    onMute = () => {},
    onSolo = () => {},
    onVolume = () => {},
    onSeek = () => {}
  }: Props = $props();

  let volumeId = $derived(`${stem.name}-volume`);
  let expanded = $state(true);
  let disclosureLabel = $derived(stemDisclosureLabel(stem.label, expanded));
  let detailsId = $derived(`${stem.name}-details`);

  function handleVolumeInput(event: Event) {
    onVolume(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<article class:error-row={Boolean(stem.error)} class="stem-row">
  <div class="stem-controls">
    <div class="stem-title">
      <h2>{stem.label}</h2>
    </div>

    <div class="stem-buttons" aria-label={`${stem.label} controls`}>
      <button
        type="button"
        class:active={stem.muted}
        aria-pressed={stem.muted}
        disabled={disabled || !stem.loaded}
        onclick={() => onMute(!stem.muted)}
      >
        Mute
      </button>
      <button
        type="button"
        class:active={stem.solo}
        aria-pressed={stem.solo}
        disabled={disabled || !stem.loaded}
        onclick={() => onSolo(!stem.solo)}
      >
        Solo
      </button>
    </div>

    <div class="stem-control-state">
      <button
        type="button"
        class="stem-disclosure"
        class:stem-disclosure-expanded={expanded}
        role="switch"
        aria-checked={expanded}
        aria-controls={detailsId}
        aria-label={disclosureLabel}
        title={disclosureLabel}
        onclick={() => {
          expanded = !expanded;
        }}
      >
        <span aria-hidden="true"></span>
      </button>

      {#if stem.loading}
        <span class="stem-state" role="status">Loading</span>
      {:else if stem.error}
        <span class="stem-state error-text">Error</span>
      {:else if stem.loaded}
        <span class="stem-state">Ready</span>
      {/if}
    </div>
  </div>

  <div id={detailsId} class="stem-details" hidden={!expanded}>
    <WaveformView
      stemName={stem.name}
      url={stem.url}
      {peaksUrl}
      {position}
      {duration}
      loading={stem.loading}
      error={stem.error}
      onSeek={onSeek}
    />

    <div class="volume-control">
      <label for={volumeId}>{stem.label} volume</label>
      <input
        id={volumeId}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={stem.volume}
        disabled={disabled || !stem.loaded}
        oninput={handleVolumeInput}
      />
      <output for={volumeId}>{Math.round(stem.volume * 100)}%</output>
    </div>
  </div>

  {#if stem.error}
    <p class="stem-error" role="alert">{stem.error}</p>
  {/if}
</article>
