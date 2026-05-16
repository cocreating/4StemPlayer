<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { AudioEngine, type AudioEngineSnapshot, type StemName } from '$lib/audio/AudioEngine';
  import { shouldHandlePlaybackShortcut } from '$lib/keyboard';
  import { loadingFeedbackText } from '$lib/loadingFeedback';
  import {
    readStoredTheme,
    resolveInitialSongId,
    saveSelectedSongId,
    saveThemePreference,
    type ThemeMode
  } from '$lib/preferences';
  import { loadSongBundle, loadSongManifest, orderedStemNames, stemLabel } from '$lib/songs';
  import type { SongBundle, SongManifestEntry } from '$lib/types';
  import LoadingPanel from './LoadingPanel.svelte';
  import SongSelector from './SongSelector.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
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
  let theme = $state<ThemeMode>('light');
  let manifestFeedback = $derived(loadingFeedbackText('manifest'));
  let songFeedback = $derived(loadingFeedbackText('song', selectedEntry?.title));

  function getBrowserStorage() {
    try {
      return typeof window === 'undefined' ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  }

  function applyTheme(nextTheme: ThemeMode) {
    theme = nextTheme;

    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = nextTheme;
    }
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    saveThemePreference(getBrowserStorage(), nextTheme);
  }

  async function boot() {
    manifestLoading = true;
    appError = '';

    try {
      const manifest = await loadSongManifest();
      songs = manifest.songs;
      const initialSongId = resolveInitialSongId(songs, getBrowserStorage());
      if (initialSongId) {
        await selectSong(initialSongId);
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
    saveSelectedSongId(getBrowserStorage(), songId);

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

  function transpose(delta: number) {
    void engine?.adjustGlobalTransposeSemitones(delta);
  }

  function resetTranspose() {
    void engine?.setGlobalTransposeSemitones(0);
  }

  function correctStemPitch(name: StemName, delta: number) {
    void engine?.adjustStemPitchCorrection(name, delta);
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
    applyTheme(readStoredTheme(getBrowserStorage()));
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
    <div class="app-header-actions">
      <ThemeToggle {theme} toggle={toggleTheme} />
      <SongSelector
        {songs}
        selectedId={selectedSongId}
        loading={manifestLoading || songLoading}
        onSelect={selectSong}
      />
    </div>
  </header>

  {#if appError}
    <section class="status status-error" role="alert" aria-live="assertive">
      <strong>Load error</strong>
      <p>{appError}</p>
    </section>
  {/if}

  {#if manifestLoading}
    <LoadingPanel title={manifestFeedback.title} description={manifestFeedback.description} />
  {:else if songs.length === 0}
    <section class="status" role="status">No songs were found in /songs/manifest.json.</section>
  {:else}
    <section class="player-grid" aria-label="Stem player">
      <div class="player-stack">
        <TransportBar
          songTitle={selectedEntry?.title ?? ''}
          playing={engineSnapshot?.playing ?? false}
          position={engineSnapshot?.position ?? 0}
          duration={engineSnapshot?.duration ?? 0}
          transposeSemitones={engineSnapshot?.globalTransposeSemitones ?? 0}
          disabled={!engineSnapshot || songLoading || (engineSnapshot.errors.length > 0)}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onSeek={seek}
          onTranspose={transpose}
          onTransposeReset={resetTranspose}
        />

        {#if selectedEntry && engineSnapshot}
          <StemMixer
            snapshot={engineSnapshot}
            manifestEntry={selectedEntry}
            disabled={songLoading}
            onMute={(name, muted) => engine?.setMuted(name, muted)}
            onSolo={(name, solo) => engine?.setSolo(name, solo)}
            onVolume={(name, volume) => engine?.setVolume(name, volume)}
            onPitchCorrection={correctStemPitch}
            onSeek={seek}
          />
        {/if}
      </div>

      <aside class="info-stack" aria-label="Song information">
        {#if songBundle}
          <SongInfoPanel metadata={songBundle.metadata} engineDuration={engineSnapshot?.duration} onSeek={seek} />
          <LyricsViewer lyrics={songBundle.lyricsMarkdown || songBundle.metadata.lyrics || ''} />
        {:else}
          <LoadingPanel title={songFeedback.title} description={songFeedback.description} />
        {/if}
      </aside>
    </section>
  {/if}
</main>
