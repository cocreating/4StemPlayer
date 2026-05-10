<script lang="ts">
  import { formatTime } from '$lib/songs';
  import type { SongMetadata } from '$lib/types';

  export let metadata: SongMetadata;
  export let onSeek: (time: number) => void = () => {};
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
  </dl>

  {#if metadata.chords}
    <section class="info-section" aria-labelledby="chords-title">
      <h3 id="chords-title">Chords</h3>
      <pre>{metadata.chords}</pre>
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
          <button type="button" class="section-marker" on:click={() => onSeek(section.start)}>
            <span>{section.label}</span>
            <span>{formatTime(section.start)}</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</section>
