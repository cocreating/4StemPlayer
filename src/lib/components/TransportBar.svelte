<script lang="ts">
  import { formatDurationSeconds, formatTime } from '$lib/songs';
  import { displayTransportSongTitle } from '$lib/transport';

  type Props = {
    songTitle?: string;
    playing?: boolean;
    position?: number;
    duration?: number;
    disabled?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onSeek?: (time: number) => void;
  };

  let {
    songTitle = '',
    playing = false,
    position = 0,
    duration = 0,
    disabled = false,
    onPlay = () => {},
    onPause = () => {},
    onStop = () => {},
    onSeek = () => {}
  }: Props = $props();

  let currentSongTitle = $derived(displayTransportSongTitle(songTitle));
  let progressLabel = $derived(`${formatTime(position)} of ${formatTime(duration)}`);
  let positionSecondsLabel = $derived(`${formatDurationSeconds(position)} seconds`);

  function handleSeekInput(event: Event) {
    onSeek(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<section class="transport-bar panel" aria-label="Transport controls">
  <div class="transport-command-stack">
    {#if currentSongTitle}
      <h2 class="transport-song-title">{currentSongTitle}</h2>
    {/if}

    <div class="transport-actions">
      {#if playing}
        <button type="button" class="primary-action" disabled={disabled} onclick={onPause}>
          Pause
        </button>
      {:else}
        <button type="button" class="primary-action" disabled={disabled} onclick={onPlay}>
          Play
        </button>
      {/if}
      <button type="button" disabled={disabled} onclick={onStop}>Stop</button>
    </div>
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
      oninput={handleSeekInput}
    />
    <div class="transport-readouts">
      <output for="transport-position">{progressLabel}</output>
      <output for="transport-position">{positionSecondsLabel}</output>
    </div>
  </div>
</section>
