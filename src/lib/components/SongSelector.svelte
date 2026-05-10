<script lang="ts">
  import type { SongManifestEntry } from '$lib/types';

  export let songs: SongManifestEntry[] = [];
  export let selectedId = '';
  export let loading = false;
  export let onSelect: (songId: string) => void = () => {};
</script>

<div class="song-selector">
  <label for="song-select">Song</label>
  <select
    id="song-select"
    value={selectedId}
    disabled={loading || songs.length === 0}
    on:change={(event) => onSelect((event.currentTarget as HTMLSelectElement).value)}
  >
    {#each songs as song}
      <option value={song.id}>{song.title} - {song.artist}</option>
    {/each}
  </select>
</div>
