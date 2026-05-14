<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { AudioEngine, type AudioEngineSnapshot } from '$lib/audio/AudioEngine';
  import { shouldHandlePlaybackShortcut } from '$lib/keyboard';
  import { loadSongBundle, loadSongManifest, orderedStemNames, stemLabel } from '$lib/songs';
  import type { SongBundle, SongManifestEntry } from '$lib/types';
  import SongSelector from './SongSelector.svelte';
  import StemMixer from './StemMixer.svelte';
  import TransportBar from './TransportBar.svelte';
  import SongInfoPanel from './SongInfoPanel.svelte';
  import LyricsViewer from './LyricsViewer.svelte';

  let songs = $state<SongManifestEntry[]>([]);
  let selectedSongId = $state('');
  let selectedEntry = $state<SongManifestEntry | null>(null);
  let songBundle = $state<SongBundle | null>(null);
  let engine: AudioEngine | null = null;
  let unsubscribe: (() => void) | null = null;
  let engineSnapshot = $state<AudioEngineSnapshot | null>(null);
  let manifestLoading = $state(true);
  let songLoading = $state(false);
  let appError = $state('');

  async function boot() {
    manifestLoading = true;
    appError = '';

    try {
      const manifest = await loadSongManifest();
      songs = manifest.songs;
      if (songs.length > 0) {
        await selectSong(songs[0].id);
      }
    } catch (error) {
      appError = error instanceof Error ? error.message : String(error);
    } finally {
      manifestLoading = false;
    }
  }

  async function selectSong(songId: string) {
    const nextEntry = songs.find((song) => song.id === songId);
    if (!nextEntry) {
      return;
    }

    songLoading = true;
    appError = '';
    selectedSongId = songId;
    selectedEntry = nextEntry;
    songBundle = null;

    unsubscribe?.();
    engine?.destroy();
    engine = new AudioEngine();
    unsubscribe = engine.subscribe((snapshot) => {
      engineSnapshot = snapshot;
    });

    try {
      const bundle = await loadSongBundle(nextEntry);
      songBundle = bundle;
      const stemNames = orderedStemNames(nextEntry.stems);
      await engine.loadSong({
        id: nextEntry.id,
        title: bundle.metadata.title,
        stems: stemNames.map((name) => ({
          name,
          label: stemLabel(name),
          url: nextEntry.stems[name]
        }))
      });
    } catch (error) {
      appError = error instanceof Error ? error.message : String(error);
    } finally {
      songLoading = false;
    }
  }

  function play() {
    void engine?.play();
  }

  function pause() {
    engine?.pause();
  }

  function stop() {
    engine?.stop();
  }

  function seek(time: number) {
    engine?.seek(time);
  }

  function togglePlayback() {
    if (!engineSnapshot || songLoading || engineSnapshot.errors.length > 0) {
      return;
    }

    if (engineSnapshot.playing) {
      pause();
    } else {
      play();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!shouldHandlePlaybackShortcut(event)) {
      return;
    }

    event.preventDefault();
    togglePlayback();
  }

  onMount(() => {
    void boot();
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  onDestroy(() => {
    unsubscribe?.();
    engine?.destroy();
  });
</script>

<main class="app-shell">
  <header class="app-header" aria-labelledby="app-title">
    <div>
      <p class="eyebrow">🐧PENGUINS🌈</p>
      <h1 id="app-title">4Stem Band Player</h1>
    </div>
    <SongSelector
      {songs}
      selectedId={selectedSongId}
      loading={manifestLoading || songLoading}
      onSelect={selectSong}
    />
  </header>

  {#if appError}
    <section class="status status-error" role="alert" aria-live="assertive">
      <strong>Load error</strong>
      <p>{appError}</p>
    </section>
  {/if}

  {#if manifestLoading}
    <section class="status" aria-live="polite">Loading song manifest...</section>
  {:else if songs.length === 0}
    <section class="status" role="status">No songs were found in /songs/manifest.json.</section>
  {:else}
    <section class="player-grid" aria-label="Stem player">
      <div class="player-stack">
        <TransportBar
          playing={engineSnapshot?.playing ?? false}
          position={engineSnapshot?.position ?? 0}
          duration={engineSnapshot?.duration ?? 0}
          disabled={!engineSnapshot || songLoading || (engineSnapshot.errors.length > 0)}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onSeek={seek}
        />

        {#if selectedEntry && engineSnapshot}
          <StemMixer
            snapshot={engineSnapshot}
            manifestEntry={selectedEntry}
            disabled={songLoading}
            onMute={(name, muted) => engine?.setMuted(name, muted)}
            onSolo={(name, solo) => engine?.setSolo(name, solo)}
            onVolume={(name, volume) => engine?.setVolume(name, volume)}
            onSeek={seek}
          />
        {/if}
      </div>

      <aside class="info-stack" aria-label="Song information">
        {#if songBundle}
          <SongInfoPanel metadata={songBundle.metadata} engineDuration={engineSnapshot?.duration} onSeek={seek} />
          <LyricsViewer lyrics={songBundle.lyricsMarkdown || songBundle.metadata.lyrics || ''} />
        {:else}
          <section class="panel">Loading song information...</section>
        {/if}
      </aside>
    </section>
  {/if}
</main>
