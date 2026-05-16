<script lang="ts">
  import { type AudioEngineSnapshot, type StemName } from '$lib/audio/AudioEngine';
  import { orderedStemNames } from '$lib/songs';
  import type { SongManifestEntry } from '$lib/types';
  import StemRow from './StemRow.svelte';

  type Props = {
    snapshot: AudioEngineSnapshot;
    manifestEntry: SongManifestEntry;
    disabled?: boolean;
    onMute?: (name: StemName, muted: boolean) => void;
    onSolo?: (name: StemName, solo: boolean) => void;
    onVolume?: (name: StemName, volume: number) => void;
    onPitchCorrection?: (name: StemName, delta: number) => void;
    onSeek?: (time: number) => void;
  };

  let {
    snapshot,
    manifestEntry,
    disabled = false,
    onMute = () => {},
    onSolo = () => {},
    onVolume = () => {},
    onPitchCorrection = () => {},
    onSeek = () => {}
  }: Props = $props();

  let stemNames = $derived(orderedStemNames(manifestEntry.stems));
</script>

<section class="stem-mixer" aria-label="Stem mixer">
  {#each stemNames as stemName}
    {@const stem = snapshot.stems[stemName]}
    {#if stem}
      <StemRow
        {stem}
        duration={snapshot.duration}
        position={snapshot.position}
        disabled={disabled}
        peaksUrl={manifestEntry.peaks?.[stemName]}
        onMute={(muted) => onMute(stemName, muted)}
        onSolo={(solo) => onSolo(stemName, solo)}
        onVolume={(volume) => onVolume(stemName, volume)}
        onPitchCorrection={(delta) => onPitchCorrection(stemName, delta)}
        onSeek={onSeek}
      />
    {/if}
  {/each}
</section>
