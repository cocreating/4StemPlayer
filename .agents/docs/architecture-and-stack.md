# Architecture And Stack

Last reviewed: 2026-05-20

## Stack

| Area | Technology | Version or source |
| --- | --- | --- |
| App framework | SvelteKit | `@sveltejs/kit` 2.59.1 |
| UI runtime | Svelte | 5.55.5 |
| Build tool | Vite | 8.0.11 |
| Language | TypeScript | 6.0.3 |
| Static adapter | `@sveltejs/adapter-static` | 3.0.10 |
| Waveform rendering | `wavesurfer.js` | 7.12.6 |
| Tests | Vitest | 4.1.5 |
| Test DOM | jsdom | 29.1.1 |
| Script runner | `tsx` | 4.21.0 |
| Peak generation | `ffmpeg` | external CLI dependency |

The app uses plain Svelte components written with Svelte 5 runes syntax and global CSS in `src/app.css`. There is no Tailwind, component library, server database, API backend, auth layer, or persistent client storage.

## Runtime Shape

The SvelteKit route is static and prerendered:

- `src/routes/+layout.ts` exports `prerender = true` and `ssr = true`.
- `svelte.config.js` uses `adapter-static` with output in `build/`.
- Browser-only audio work is started from Svelte lifecycle code in `AppShell.svelte`, so SSR only renders the shell and the client loads audio after mount.
- Component props use `$props`, owned UI state uses `$state`, derived display values use `$derived`, and state-driven side effects use `$effect`.

Top-level boot sequence:

1. `AppShell.svelte` mounts.
2. `loadSongManifest()` fetches `/songs/manifest.json`.
3. The first song is selected automatically when the manifest has songs.
4. `loadSongBundle(entry)` fetches `song.json` and `lyrics.md`.
5. `AudioEngine.loadSong()` fetches and decodes all available stems.
6. Components render from `AudioEngineSnapshot` updates.

## State Ownership

| State | Owner | Notes |
| --- | --- | --- |
| Song list and selected song | `AppShell.svelte` | Loaded from `/songs/manifest.json` and stored in `$state`. |
| Loaded metadata and lyrics | `AppShell.svelte` | Stored as a `$state` `SongBundle`. |
| Audio buffers, gain nodes, source nodes | `AudioEngine` | Hidden inside the engine. |
| Transport position and playing state | `AudioEngine` | Exposed through snapshots. |
| Per-stem mute, solo, volume, load/error state | `AudioEngine` | Exposed as `snapshot.stems`. |
| Waveform visual state | `WaveformView.svelte` and WaveSurfer | Recreated through `$effect` when stem URL, peaks URL, or duration changes. |
| Keyboard shortcut decisions | `src/lib/keyboard.ts` | Handles Space bar play/pause while ignoring editable controls. |

## Audio Engine

`src/lib/audio/AudioEngine.ts` is the central playback module.

Important behavior:

- `STEM_ORDER` defines the preferred rendering order: `vocals`, `guitar`, `strings`, `drums`, `bass`, `fx`, `other`.
- `loadSong()` destroys previous resources, checks required stem definitions (`bass`, `drums`, `vocals`), loads available stems concurrently, decodes audio with `AudioContext.decodeAudioData()`, and sets duration to the maximum loaded buffer duration.
- `play()` resumes the audio context, calculates a shared offset, creates one `AudioBufferSourceNode` per loaded stem, and starts all stems from the same position.
- `pause()` stores the current playhead position and stops source nodes.
- `stop()` stops source nodes and resets position to zero.
- `seek()` clamps the requested position; if playing, it recreates source nodes from the new offset.
- `setVolume()`, `setMuted()`, and `setSolo()` update gain state through per-stem `GainNode`s.
- Gain changes use a short linear ramp to avoid clicks.
- `subscribe()` emits immutable snapshot-style state for Svelte components.

The engine is testable because its constructor accepts an injected `AudioContext` and custom `fetchArrayBuffer` function. `src/lib/audio/AudioEngine.test.ts` uses fake Web Audio classes to verify loading, seeking, gain behavior, and resource cleanup.

## UI Composition

`AppShell.svelte` is the orchestrator. It owns manifest loading, song selection, engine lifecycle, and error state. Child components are presentational and receive callback props.

Component flow:

- `SongSelector` changes the selected song.
- `TransportBar` calls `play`, `pause`, `stop`, and `seek`, and displays both `m:ss of m:ss` and a live seconds-only position.
- `StemMixer` renders a `StemRow` for each stem.
- `StemRow` controls mute, solo, and volume, and embeds `WaveformView`.
- `WaveformView` dynamically imports WaveSurfer in the browser and sends waveform interaction times back to `AppShell`.
- `SongInfoPanel` renders metadata and section markers that call `seek`.
- `LyricsViewer` displays lyrics text in a preserved whitespace block.
- `AppShell` registers a browser-only Space bar keydown listener from `onMount`; cleanup is returned from `onMount` to avoid SSR access to `window`.

Desktop layout is a normal responsive two-column grid. No player or info areas are sticky; the page scrolls as a standard document.

## Static Song Pipeline

Songs live under `static/songs/`. At runtime, the app only reads static files. The scripts prepare and validate those files:

- `scripts/validate-songs.ts` checks that every song folder has `song.json`, `lyrics.md`, and all required stems.
- `scripts/generate-song-manifest.ts` creates the browser-facing `manifest.json` with URL-encoded asset paths.
- `scripts/generate-peaks.ts` shells out to `ffmpeg`, converts each MP3 to mono float samples at 8000 Hz, computes peak magnitudes, and writes `*.peaks.json`. Current peak files are skipped unless forced.
- `scripts/refresh-songs.ts` orchestrates validation, peak generation, manifest regeneration, and optional release checks.

Stem filename resolution accepts:

- `<Folder>_<stem>.mp3`
- `<Song Title>_<stem>.mp3`
- Any file whose lowercase name ends with `_<stem>.mp3`

Primary workflow commands:

- `npm run songs:prepare`: validate songs, generate missing or outdated peaks, regenerate manifest.
- `npm run songs:release`: run `songs:prepare`, then `check`, `test`, and `build`.
- `npm run songs:release -- --skip-build`: run release validation without the production build.

## Testing

Current tests cover:

- Audio engine stem loading and synchronized starts.
- Seeking across all loaded stems.
- Gain behavior for volume, mute, and solo.
- Audio resource cleanup when switching songs.
- Song manifest creation.
- Song folder validation errors.
- URL-safe manifest paths for stem files with spaces.
- Refresh workflow orchestration and CLI flag parsing.
- Peak skipping when peak files are newer than stems.
- Structured chord formatting and duration metadata formatting.
- Keyboard shortcut guard behavior.

The test runner is configured in `vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']
}
```

## Deployment Model

The app is deployable as static files from `build/`. Static hosting must serve:

- `index.html`
- SvelteKit client assets under `_app/`
- MP3 stems under `songs/`
- JSON metadata and peak files under `songs/`
- Markdown lyrics under `songs/`

No server-side route or API is required after build.
