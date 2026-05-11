<script lang="ts">
  import { formatChords, formatDurationSeconds, formatMetadataDuration, formatTime } from '$lib/songs';
  import type { SongMetadata } from '$lib/types';

  type Props = {
    metadata: SongMetadata;
    onSeek?: (time: number) => void;
  };

  let { metadata, onSeek = () => {} }: Props = $props();

  let chordText = $derived(formatChords(metadata.chords));
  let durationText = $derived(formatMetadataDuration(metadata));
  let durationSecondsText = $derived(formatDurationSeconds(metadata.durationSeconds));
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

  {#if metadata.sections?.length}
    <section class="info-section" aria-labelledby="sections-title">
      <h3 id="sections-title">Sections</h3>
      <div class="section-list">
        {#each metadata.sections as section}
          <button type="button" class="section-marker" onclick={() => onSeek(section.start)}>
            <span>{section.label}</span>
            <span>{formatTime(section.start)}</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</section>
