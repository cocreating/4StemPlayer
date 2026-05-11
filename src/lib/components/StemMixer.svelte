 <script lang="ts">
  import { STEM_ORDER, type AudioEngineSnapshot, type StemName } from '$lib/audio/AudioEngine';
  import type { SongManifestEntry } from '$lib/types';
  import StemRow from './StemRow.svelte';

  export let snapshot: AudioEngineSnapshot;
  export let manifestEntry: SongManifestEntry;
  export let disabled = false;
  export let onMute: (name: StemName, muted: boolean) => void = () => {};
  export let onSolo: (name: StemName, solo: boolean) => void = () => {};
  export let onVolume: (name: StemName, volume: number) => void = () => {};
  export let onSeek: (time: number) => void = () => {};
</script>

<section class="stem-mixer" aria-label="Stem mixer">
  {#each STEM_ORDER as stemName}
    <StemRow
      stem={snapshot.stems[stemName]}
      duration={snapshot.duration}
      position={snapshot.position}
      disabled={disabled}
      peaksUrl={manifestEntry.peaks?.[stemName]}
      onMute={(muted) => onMute(stemName, muted)}
      onSolo={(solo) => onSolo(stemName, solo)}
      onVolume={(volume) => onVolume(stemName, volume)}
      onSeek={onSeek}
    />
  {/each}
</section>
