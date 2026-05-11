# 4Stem Band Player Overview

Last reviewed: 2026-05-11

## What This App Does

4Stem Band Player is a browser-based technical spike for synchronized four-stem music playback. It loads a static song catalog, decodes four MP3 stems in the browser, and lets the user rehearse or inspect a song with transport controls, Space bar play/pause, per-stem mute/solo/volume controls, waveform seeking, lyrics, structured chords, notes, duration metadata, and section markers.

The supported stem set is fixed:

- `vocals`
- `drums`
- `bass`
- `other`

The current bundled song catalog contains one demo song:

- `GloryBox`: "Glory Box" by "Portishead"
- Four MP3 stems under `static/songs/GloryBox/`
- Four precomputed waveform peak files under `static/songs/GloryBox/`
- `song.json`, `lyrics.md`, and generated `manifest.json`

## Current State

- The app is a SvelteKit static site using Svelte 5, Vite, TypeScript, and Web Audio API.
- The UI is implemented as a single page at `src/routes/+page.svelte`, which renders `src/lib/components/AppShell.svelte`.
- Audio playback is handled by `src/lib/audio/AudioEngine.ts`.
- Waveforms are rendered with `wavesurfer.js`; precomputed peak files are used when available.
- Song metadata and asset URLs are loaded from `/songs/manifest.json`.
- Song utility scripts can validate song folders, generate missing or outdated peaks, regenerate the manifest, and run release checks.
- The app uses normal page scrolling. No player or info panels are sticky.
- This project is a Git repository with `origin` set to `https://github.com/cocreating/4StemPlayer.git`.
- Generated output lives in ignored `build/` and `.svelte-kit/` directories.

Validation performed during this review:

- `npm test`: 6 test files passed, 29 tests passed.
- `npm run check`: 0 Svelte errors, 0 warnings.
- `npm run songs:validate`: static song folder validated successfully.
- `npm run build`: static build completed and wrote the site to `build/`.

## Main Project Files

- `src/routes/+layout.svelte`: global CSS import.
- `src/routes/+layout.ts`: enables static prerendering.
- `src/routes/+page.svelte`: page entry point.
- `src/lib/components/AppShell.svelte`: application orchestration and top-level UI.
- `src/lib/components/TransportBar.svelte`: play, pause, stop, and global seek controls.
- `src/lib/components/StemMixer.svelte`: renders the four stem rows.
- `src/lib/components/StemRow.svelte`: per-stem status, mute, solo, volume, waveform, and errors.
- `src/lib/components/WaveformView.svelte`: WaveSurfer wrapper with optional peak loading.
- `src/lib/components/SongInfoPanel.svelte`: metadata, chords, notes, and section seek buttons.
- `src/lib/components/LyricsViewer.svelte`: lyrics display.
- `src/lib/components/SongSelector.svelte`: song dropdown.
- `src/lib/audio/AudioEngine.ts`: Web Audio loading, synchronization, gain, and transport logic.
- `src/lib/keyboard.ts`: Space bar shortcut guard for global play/pause.
- `src/lib/songs.ts`: fetch helpers, manifest loading, bundle loading, and display formatting helpers.
- `src/lib/types.ts`: song and manifest types used by the app.
- `scripts/refresh-songs.ts`: orchestrates song preparation and release checks.
- `scripts/song-utils.ts`: shared song file utilities.
- `scripts/validate-songs.ts`: validates song folder completeness.
- `scripts/generate-song-manifest.ts`: writes `static/songs/manifest.json`.
- `scripts/generate-peaks.ts`: creates waveform peak JSON files from MP3s using `ffmpeg`.

## Common Commands

```bash
npm run dev
npm run check
npm test
npm run songs:validate
npm run songs:prepare
npm run songs:release
npm run songs:manifest
npm run songs:peaks
npm run build
npm run preview
```

Notes:

- `npm run dev` and `npm run preview` bind to `0.0.0.0`.
- `npm run songs:prepare` validates songs, generates missing or outdated waveform peaks, and regenerates the manifest.
- `npm run songs:release` runs `songs:prepare`, then `check`, `test`, and `build`.
- `npm run songs:peaks` requires `ffmpeg` on `PATH`.
- `npm run songs:prepare -- --force-peaks` regenerates every peak file.
- `npm run songs:release -- --skip-build` runs validation, type checks, and tests without building.
- `npm run build` writes the deployable static site to `build/`.
- See `song-ingestion-workflow.md` for the full song-adding process.

## Known Constraints

- All four stems are required for a song to load successfully.
- Each stem is fully fetched and decoded into an `AudioBuffer`, so very large catalogs or long stems may create memory pressure.
- Playback depends on browser Web Audio API support and user-gesture audio resume behavior.
- There is no song upload/import UI. New songs are added by placing files in `static/songs/<Folder>/` and regenerating the manifest.
- There are unit tests for the audio engine, song scripts, metadata formatting, and keyboard shortcut guard, but no browser end-to-end test suite in the repo.
- `static/.DS_Store` and `build/.DS_Store` are present and should be treated as incidental macOS files, not app assets.
