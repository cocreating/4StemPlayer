<script lang="ts">
  import type { SongManifestEntry } from '$lib/types';

  type Props = {
    songs?: SongManifestEntry[];
    selectedId?: string;
    loading?: boolean;
    onSelect?: (songId: string) => void;
  };

  let {
    songs = [],
    selectedId = '',
    loading = false,
    onSelect = () => {}
  }: Props = $props();

  function handleChange(event: Event) {
    onSelect((event.currentTarget as HTMLSelectElement).value);
  }
</script>

<div class="song-selector">
  <label for="song-select">Song</label>
  <select
    id="song-select"
    value={selectedId}
    disabled={loading || songs.length === 0}
    onchange={handleChange}
  >
    {#each songs as song}
      <option value={song.id}>{song.title} - {song.artist}</option>
    {/each}
  </select>
</div>
