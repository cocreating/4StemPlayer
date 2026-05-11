<script lang="ts">
  import { formatDurationSeconds, formatTime } from '$lib/songs';

  export let playing = false;
  export let position = 0;
  export let duration = 0;
  export let disabled = false;
  export let onPlay: () => void = () => {};
  export let onPause: () => void = () => {};
  export let onStop: () => void = () => {};
  export let onSeek: (time: number) => void = () => {};

  $: progressLabel = `${formatTime(position)} of ${formatTime(duration)}`;
  $: positionSecondsLabel = `${formatDurationSeconds(position)} seconds`;
</script>

<section class="transport-bar panel" aria-label="Transport controls">
  <div class="transport-actions">
    {#if playing}
      <button type="button" class="primary-action" disabled={disabled} on:click={onPause}>
        Pause
      </button>
    {:else}
      <button type="button" class="primary-action" disabled={disabled} on:click={onPlay}>
        Play
      </button>
    {/if}
    <button type="button" disabled={disabled} on:click={onStop}>Stop</button>
  </div>

  <div class="transport-seek">
    <label for="transport-position">Position</label>
    <input
      id="transport-position"
      type="range"
      min="0"
      max={Math.max(duration, 0.01)}
      step="0.01"
      value={position}
      disabled={disabled || duration === 0}
      aria-valuetext={progressLabel}
      on:input={(event) => onSeek(Number((event.currentTarget as HTMLInputElement).value))}
    />
    <div class="transport-readouts">
      <output for="transport-position">{progressLabel}</output>
      <output for="transport-position">{positionSecondsLabel}</output>
    </div>
  </div>
</section>
