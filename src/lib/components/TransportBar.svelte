<script lang="ts">
  import { formatPitchSemitones } from '$lib/audio/pitch';
  import { formatDurationSeconds, formatTime } from '$lib/songs';
  import { displayTransportSongTitle } from '$lib/transport';

  type Props = {
    songTitle?: string;
    playing?: boolean;
    position?: number;
    duration?: number;
    transposeSemitones?: number;
    sectionsOpen?: boolean;
    mixerOpen?: boolean;
    lyricsOpen?: boolean;
    hasSections?: boolean;
    hasMixer?: boolean;
    hasLyrics?: boolean;
    disabled?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onSeek?: (time: number) => void;
    onTranspose?: (delta: number) => void;
    onTransposeReset?: () => void;
    onSectionsToggle?: () => void;
    onMixerToggle?: () => void;
    onLyricsToggle?: () => void;
  };

  let {
    songTitle = '',
    playing = false,
    position = 0,
    duration = 0,
    transposeSemitones = 0,
    sectionsOpen = false,
    mixerOpen = false,
    lyricsOpen = false,
    hasSections = false,
    hasMixer = false,
    hasLyrics = false,
    disabled = false,
    onPlay = () => {},
    onPause = () => {},
    onStop = () => {},
    onSeek = () => {},
    onTranspose = () => {},
    onTransposeReset = () => {},
    onSectionsToggle = () => {},
    onMixerToggle = () => {},
    onLyricsToggle = () => {}
  }: Props = $props();

  let currentSongTitle = $derived(displayTransportSongTitle(songTitle));
  let progressLabel = $derived(`${formatTime(position)} of ${formatTime(duration)}`);
  let positionSecondsLabel = $derived(`${formatDurationSeconds(position)} seconds`);
  let transposeLabel = $derived(formatPitchSemitones(transposeSemitones));

  function handleSeekInput(event: Event) {
    onSeek(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<section class="transport-bar panel" aria-label="Transport controls">
  <div class="transport-command-stack">
    {#if currentSongTitle}
      <h2 class="transport-song-title">{currentSongTitle}</h2>
    {/if}

    <div class="transport-actions" aria-label="Playback panels">
      <div class="transport-actions-primary">
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
        <button
          type="button"
          class:mixer-action-open={mixerOpen}
          disabled={disabled || !hasMixer}
          aria-controls="mixer-popover"
          aria-expanded={mixerOpen}
          onclick={onMixerToggle}
        >
          Mixer
        </button>
      </div>
      <div class="transport-actions-secondary">
        <button
          type="button"
          class:sections-action-open={sectionsOpen}
          disabled={disabled || !hasSections}
          aria-controls="sections-popover"
          aria-expanded={sectionsOpen}
          onclick={onSectionsToggle}
        >
          Sections
        </button>
        <button
          type="button"
          class:lyrics-action-open={lyricsOpen}
          disabled={disabled || !hasLyrics}
          aria-controls="lyrics-popover"
          aria-expanded={lyricsOpen}
          onclick={onLyricsToggle}
        >
          Lyrics
        </button>
      </div>
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

    <div class="transpose-control" aria-label="Global transpose for non-drum tracks">
      <button type="button" disabled={disabled} aria-label="Transpose down one semitone" onclick={() => onTranspose(-1)}>
        -
      </button>
      <button type="button" disabled={disabled} aria-label="Transpose up one semitone" onclick={() => onTranspose(1)}>
        +
      </button>
      <button type="button" disabled={disabled} aria-label="Reset global transpose" title="Reset global transpose" onclick={onTransposeReset}>
        0
      </button>
      <output aria-label="Global transpose">{transposeLabel}</output>
    </div>
  </div>
</section>
