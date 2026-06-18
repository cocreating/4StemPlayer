<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { dev } from '$app/environment';
  import {
    AudioEngine,
    type AudioEngineSnapshot,
    type DecodeProfile
  } from '$lib/audio/AudioEngine';
  import { buildMediaMetadataInit, mediaPositionState } from '$lib/pwa';
  import { shouldHandlePlaybackShortcut } from '$lib/keyboard';
  import { loadingFeedbackText } from '$lib/loadingFeedback';
  import {
    detectLowMemoryDefault,
    readLowMemoryPreference,
    readStoredTheme,
    resolveInitialSongId,
    resolveLowMemoryActive,
    saveLowMemoryPreference,
    saveSelectedSongId,
    saveThemePreference,
    type ThemeMode
  } from '$lib/preferences';
  import { loadSongBundle, loadSongManifest, orderedStemNames, stemLabel } from '$lib/songs';
  import type { SongBundle, SongManifestEntry } from '$lib/types';
  import LoadingPanel from './LoadingPanel.svelte';
  import SongSelector from './SongSelector.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import MixerPopover from './MixerPopover.svelte';
  import LowMemoryToggle from './LowMemoryToggle.svelte';
  import StemMixer from './StemMixer.svelte';
  import TransportBar from './TransportBar.svelte';
  import SectionsPopover from './SectionsPopover.svelte';
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
  let lowMemoryActive = $state(false);
  // On phones, route transpose/tempo through offline pre-rendering instead of
  // several live SoundTouch worklets (which underrun and desync on mobile CPUs).
  let renderModeActive = $state(false);
  const LOW_MEMORY_DECODE_PROFILE: DecodeProfile = { mono: true, sampleRate: 22050 };
  const MOBILE_SNAPSHOT_INTERVAL_MS = 150;
  let sectionsOpen = $state(false);
  let mixerOpen = $state(false);
  let lyricsOpen = $state(false);
  let manifestFeedback = $derived(loadingFeedbackText('manifest'));
  let songFeedback = $derived(loadingFeedbackText('song', selectedEntry?.title));
  let sectionMarkers = $derived(songBundle?.metadata.sections ?? []);
  let lyricsText = $derived(songBundle?.lyricsMarkdown || songBundle?.metadata.lyrics || '');
  let applyingTransform = $derived(engineSnapshot?.rendering ?? false);
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  function isMobileViewport() {
    return typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 820px)').matches ?? false);
  }

  async function revealPanelOnMobile(panelId: string) {
    if (!isMobileViewport()) {
      return;
    }
    await tick();
    requestAnimationFrame(() => {
      document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function scrollToTopOnMobile() {
    if (!isMobileViewport()) {
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

  function toggleLowMemory() {
    const nextActive = !lowMemoryActive;
    lowMemoryActive = nextActive;
    saveLowMemoryPreference(getBrowserStorage(), nextActive ? 'on' : 'off');

    // Buffers are already decoded at the previous fidelity, so re-load the
    // current song to apply the new decode profile.
    if (selectedSongId) {
      void selectSong(selectedSongId);
    }
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
    sectionsOpen = false;
    mixerOpen = false;
    lyricsOpen = false;
    saveSelectedSongId(getBrowserStorage(), songId);

    unsubscribe?.();
    engine?.destroy();
    engine = new AudioEngine({
      decodeProfile: lowMemoryActive ? LOW_MEMORY_DECODE_PROFILE : null,
      pitchTempoMode: renderModeActive ? 'render' : 'realtime',
      driftCorrectionIntervalMs: renderModeActive ? MOBILE_SNAPSHOT_INTERVAL_MS : undefined
    });
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

  function toggleSections() {
    if (sectionMarkers.length === 0) {
      return;
    }
    sectionsOpen = !sectionsOpen;
    mixerOpen = false;
    lyricsOpen = false;
    if (sectionsOpen) {
      void revealPanelOnMobile('sections-popover');
    } else {
      scrollToTopOnMobile();
    }
  }

  function closeSections() {
    sectionsOpen = false;
    scrollToTopOnMobile();
  }

  function toggleMixer() {
    if (selectedEntry && engineSnapshot) {
      mixerOpen = !mixerOpen;
      sectionsOpen = false;
      lyricsOpen = false;
      if (mixerOpen) {
        void revealPanelOnMobile('mixer-popover');
      } else {
        scrollToTopOnMobile();
      }
    }
  }

  function closeMixer() {
    mixerOpen = false;
    scrollToTopOnMobile();
  }

  function toggleLyrics() {
    if (songBundle) {
      lyricsOpen = !lyricsOpen;
      sectionsOpen = false;
      mixerOpen = false;
      if (lyricsOpen) {
        void revealPanelOnMobile('lyrics-popover');
      } else {
        scrollToTopOnMobile();
      }
    }
  }

  function closeLyrics() {
    lyricsOpen = false;
    scrollToTopOnMobile();
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

  function registerServiceWorker() {
    if (dev || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Service worker is a progressive enhancement; ignore registration errors.
    });
  }

  // --- Screen Wake Lock: keep the phone awake while a song is playing. ---
  let wakeLock: WakeLockSentinel | null = null;

  async function acquireWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator) || wakeLock) {
      return;
    }
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    const current = wakeLock;
    wakeLock = null;
    try {
      await current?.release();
    } catch {
      // Ignore release errors (already released / unsupported).
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && engineSnapshot?.playing) {
      void acquireWakeLock();
    }
  }

  // --- Media Session: lock-screen / Bluetooth / headset transport controls. ---
  function getMediaSession(): MediaSession | null {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return null;
    }
    return navigator.mediaSession;
  }

  function setupMediaSessionHandlers() {
    const session = getMediaSession();
    if (!session) {
      return;
    }
    session.setActionHandler('play', () => play());
    session.setActionHandler('pause', () => pause());
    session.setActionHandler('stop', () => stop());
    session.setActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset ?? 10;
      seek(Math.max(0, (engineSnapshot?.position ?? 0) - offset));
    });
    session.setActionHandler('seekforward', (details) => {
      const offset = details.seekOffset ?? 10;
      const duration = engineSnapshot?.duration ?? 0;
      seek(Math.min(duration, (engineSnapshot?.position ?? 0) + offset));
    });
    try {
      session.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          seek(details.seekTime);
        }
      });
    } catch {
      // 'seekto' is not supported everywhere.
    }
  }

  // Update metadata when the song changes.
  $effect(() => {
    const session = getMediaSession();
    const entry = selectedEntry;
    if (!session || !entry) {
      return;
    }
    try {
      session.metadata = new MediaMetadata(
        buildMediaMetadataInit(songBundle?.metadata.title ?? entry.title, entry.artist)
      );
    } catch {
      // MediaMetadata may be unavailable; ignore.
    }
  });

  // Reflect playback state, position, and wake lock from the engine snapshot.
  $effect(() => {
    const snapshot = engineSnapshot;
    const session = getMediaSession();
    if (session) {
      session.playbackState = snapshot?.playing ? 'playing' : 'paused';
      const positionState = mediaPositionState(snapshot?.duration ?? 0, snapshot?.position ?? 0);
      if (positionState) {
        try {
          session.setPositionState(positionState);
        } catch {
          // Ignore invalid position-state updates.
        }
      }
    }

    if (snapshot?.playing) {
      void acquireWakeLock();
    } else {
      void releaseWakeLock();
    }
  });

  onMount(() => {
    applyTheme(readStoredTheme(getBrowserStorage()));
    lowMemoryActive = resolveLowMemoryActive(readLowMemoryPreference(getBrowserStorage()));
    renderModeActive = detectLowMemoryDefault();
    registerServiceWorker();
    setupMediaSessionHandlers();
    void boot();
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  onDestroy(() => {
    unsubscribe?.();
    engine?.destroy();
    void releaseWakeLock();
  });
</script>

<main class="app-shell" class:app-reconfiguring={applyingTransform}>
  <header class="app-header" aria-labelledby="app-title">
    <div>
      <p class="eyebrow">🐧PENGUINS🌈</p>
      <h1 id="app-title">4Stem Band Player</h1>
    </div>
    <div class="app-header-side">
      <p class="app-version" title="Build version">{appVersion}</p>
      <div class="app-header-actions">
      <div class="app-header-toggles">
        <ThemeToggle {theme} toggle={toggleTheme} />
        <LowMemoryToggle active={lowMemoryActive} toggle={toggleLowMemory} />
      </div>
      <SongSelector
        {songs}
        selectedId={selectedSongId}
        loading={manifestLoading || songLoading}
        onSelect={selectSong}
      />
      </div>
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
        <div class="transport-shell">
          <TransportBar
            songTitle={selectedEntry?.title ?? ''}
            playing={engineSnapshot?.playing ?? false}
            position={engineSnapshot?.position ?? 0}
            duration={engineSnapshot?.duration ?? 0}
            transposeSemitones={engineSnapshot?.globalTransposeSemitones ?? 0}
            sectionsOpen={sectionsOpen}
            mixerOpen={mixerOpen}
            lyricsOpen={lyricsOpen}
            hasSections={sectionMarkers.length > 0}
            hasMixer={Boolean(selectedEntry && engineSnapshot)}
            hasLyrics={Boolean(songBundle)}
            disabled={!engineSnapshot || songLoading || (engineSnapshot.errors.length > 0)}
            onPlay={play}
            onPause={pause}
            onStop={stop}
            onSeek={seek}
            onTranspose={transpose}
            onTransposeReset={resetTranspose}
            onSectionsToggle={toggleSections}
            onMixerToggle={toggleMixer}
            onLyricsToggle={toggleLyrics}
          />
          {#if applyingTransform}
            <p class="applying-indicator" role="status" aria-live="polite">
              <span class="applying-spinner" aria-hidden="true"></span>
              Applying transpose…
            </p>
          {/if}
          <SectionsPopover
            sections={sectionMarkers}
            open={sectionsOpen}
            onClose={closeSections}
            onSeek={seek}
          />
          {#if selectedEntry && engineSnapshot}
            <MixerPopover
              snapshot={engineSnapshot}
              manifestEntry={selectedEntry}
              open={mixerOpen}
              disabled={songLoading}
              onClose={closeMixer}
              onMute={(name, muted) => engine?.setMuted(name, muted)}
              onSolo={(name, solo) => engine?.setSolo(name, solo)}
              onVolume={(name, volume) => engine?.setVolume(name, volume)}
            />
          {/if}
          {#if songBundle}
            <LyricsViewer lyrics={lyricsText} open={lyricsOpen} onClose={closeLyrics} />
          {/if}
        </div>

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
          <SongInfoPanel metadata={songBundle.metadata} engineDuration={engineSnapshot?.duration} />
        {:else}
          <LoadingPanel title={songFeedback.title} description={songFeedback.description} />
        {/if}
      </aside>
    </section>
  {/if}

  {#if applyingTransform}
    <div class="reconfig-overlay" role="status" aria-live="polite" aria-label="Applying transpose">
      <span class="visually-hidden">Applying transpose…</span>
    </div>
  {/if}
</main>
