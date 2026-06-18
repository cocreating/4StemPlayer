# Changelog

All notable changes to 4Stem Band Player. The in-app version badge (top right)
shows the deployed commit so you can match what you're testing to an entry here.

## Unreleased

### Added
- **Installable PWA** (`900712f`): web app manifest with maskable/Apple icons,
  so the player installs to a phone home screen and runs standalone.
- **Offline support** (`900712f`): a service worker precaches the app shell and
  static assets, and runtime-caches `/songs/*` cache-first, so a song that has
  been played once replays without a connection.
- **Lock-screen / Bluetooth / car controls** (`900712f`): Media Session metadata
  (title, artist, artwork) plus play/pause/stop/seek handlers and position state.
- **Screen Wake Lock** (`900712f`): the screen stays awake while a song plays,
  re-acquired when the tab returns to the foreground and released on stop.
- **Low-memory "Lite" mode** (`a2b3b25`): decodes stems to mono at 22.05 kHz to
  cut a six-stem song from ~450 MB to ~110 MB of RAM so mobile tabs stop being
  evicted. Auto-enabled on phones with a header toggle; persisted preference.
- **Mobile pitch/tempo "render" mode** (`56ea395`): on phones, transpose/tempo
  is pre-rendered offline (SoundTouch `processOffline`) and played as plain
  buffers, removing the real-time worklet underruns that caused apparent
  acceleration and crackle. Includes an "Applying key & tempo…" indicator.
- **Master limiter** (`56ea395`): a brickwall `DynamicsCompressor` on the master
  bus so summed stems and time-stretch overshoot can't hard-clip.
- **Build version badge** (`f70e8ce`): shows the package version plus the deploy
  commit sha (top right), to identify exactly which build is live.
- **Reconfig feedback** (`f70e8ce`): while a key/tempo render runs, the playhead
  freezes and an animated red border surrounds the app.

### Changed
- **Cleaner transposed pitch** (`a6c4212`): the offline render now uses
  `lanczos` resampling with `quickSeek` disabled and a wider overlap, fixing the
  slight dissonance on harmonic stems (e.g. bass) after a transpose. The desktop
  real-time path keeps the lighter defaults.
- **Lite toggle** (`f70e8ce`): the active state is now a high-contrast filled
  accent so on/off is unmistakable.
- **Mobile panels** (`f70e8ce`): opening Sections/Lyrics/Mixer scrolls the panel
  into view; closing scrolls back to the top.
- **Lighter mobile main thread** (`56ea395`): the snapshot/meter loop is
  throttled on phones.

### Fixed
- **Inter-track sync on mobile transpose**: SoundTouch adds a small,
  pitch-dependent constant time offset to processed audio, so the un-processed
  drums sat a few-to-tens of milliseconds ahead of the pitched stems. Render
  mode now routes every stem (drums at pitch 0) through the same offline pass
  while any transform is active, keeping the stems phase-locked.
- **Transpose then play/stop runaway** (`d5c6a03`): guarded the async pitch-graph
  transitions with a playback epoch + serialization so a superseded change can
  no longer leave orphaned/duplicate sources running against a stale playhead
  (the uncontrolled "acceleration" / frozen-playhead defect).
