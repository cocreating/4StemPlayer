<script lang="ts">
  import type { StemPlaybackState } from '$lib/audio/AudioEngine';
  import WaveformView from './WaveformView.svelte';

  export let stem: StemPlaybackState;
  export let position = 0;
  export let duration = 0;
  export let disabled = false;
  export let peaksUrl: string | undefined = undefined;
  export let onMute: (muted: boolean) => void = () => {};
  export let onSolo: (solo: boolean) => void = () => {};
  export let onVolume: (volume: number) => void = () => {};
  export let onSeek: (time: number) => void = () => {};

  $: volumeId = `${stem.name}-volume`;
</script>

<article class:error-row={Boolean(stem.error)} class="stem-row">
  <div class="stem-controls">
    <div class="stem-title">
      <h2>{stem.label}</h2>
      {#if stem.loading}
        <span class="stem-state" role="status">Loading</span>
      {:else if stem.error}
        <span class="stem-state error-text">Error</span>
      {:else if stem.loaded}
        <span class="stem-state">Ready</span>
      {/if}
    </div>

    <div class="stem-buttons" aria-label={`${stem.label} controls`}>
      <button
        type="button"
        class:active={stem.muted}
        aria-pressed={stem.muted}
        disabled={disabled || !stem.loaded}
        on:click={() => onMute(!stem.muted)}
      >
        Mute
      </button>
      <button
        type="button"
        class:active={stem.solo}
        aria-pressed={stem.solo}
        disabled={disabled || !stem.loaded}
        on:click={() => onSolo(!stem.solo)}
      >
        Solo
      </button>
    </div>
  </div>

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
      on:input={(event) => onVolume(Number((event.currentTarget as HTMLInputElement).value))}
    />
    <output for={volumeId}>{Math.round(stem.volume * 100)}%</output>
  </div>

  {#if stem.error}
    <p class="stem-error" role="alert">{stem.error}</p>
  {/if}
</article>
