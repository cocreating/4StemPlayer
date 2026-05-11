<script lang="ts">
  import { STEM_ORDER, type AudioEngineSnapshot, type StemName } from '$lib/audio/AudioEngine';
  import type { SongManifestEntry } from '$lib/types';
  import StemRow from './StemRow.svelte';

  type Props = {
    snapshot: AudioEngineSnapshot;
    manifestEntry: SongManifestEntry;
    disabled?: boolean;
    onMute?: (name: StemName, muted: boolean) => void;
    onSolo?: (name: StemName, solo: boolean) => void;
    onVolume?: (name: StemName, volume: number) => void;
    onSeek?: (time: number) => void;
  };

  let {
    snapshot,
    manifestEntry,
    disabled = false,
    onMute = () => {},
    onSolo = () => {},
    onVolume = () => {},
    onSeek = () => {}
  }: Props = $props();
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
