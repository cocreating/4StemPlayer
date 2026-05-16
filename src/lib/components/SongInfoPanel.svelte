<script lang="ts">
  import { formatChords, formatDurationSeconds, formatMetadataDuration, formatTime } from '$lib/songs';
  import type { SongMetadata } from '$lib/types';

  type Props = {
    metadata: SongMetadata;
    engineDuration?: number;
  };

  let { metadata, engineDuration = 0 }: Props = $props();

  let chordText = $derived(formatChords(metadata.chords));
  let durationText = $derived(metadata.duration || (engineDuration > 0 ? formatTime(engineDuration) : ''));
  let durationSecondsText = $derived(
    metadata.durationSeconds !== undefined
      ? formatDurationSeconds(metadata.durationSeconds)
      : engineDuration > 0
        ? formatDurationSeconds(engineDuration)
        : ''
  );
</script>

<section class="panel song-info" aria-labelledby="song-info-title">
  <div class="song-heading">
    <h2 id="song-info-title">{metadata.title}</h2>
    <p>{metadata.artist}</p>
  </div>

  <dl class="metadata-grid">
    <div>
      <dt>Key</dt>
      <dd>{metadata.key}</dd>
    </div>
    <div>
      <dt>BPM</dt>
      <dd>{metadata.bpm}</dd>
    </div>
    <div>
      <dt>Time</dt>
      <dd>{metadata.timeSignature}</dd>
    </div>
    {#if durationText}
      <div>
        <dt>Duration</dt>
        <dd>{durationText}</dd>
      </div>
    {/if}
    {#if durationSecondsText}
      <div>
        <dt>Seconds</dt>
        <dd>{durationSecondsText}</dd>
      </div>
    {/if}
  </dl>

  {#if chordText}
    <section class="info-section" aria-labelledby="chords-title">
      <h3 id="chords-title">Chords</h3>
      <pre>{chordText}</pre>
    </section>
  {/if}

  {#if metadata.notes}
    <section class="info-section" aria-labelledby="notes-title">
      <h3 id="notes-title">Notes</h3>
      <p>{metadata.notes}</p>
    </section>
  {/if}
</section>
