# 4Stem Band Player

A SvelteKit-based static web app for playing song stems.

## Songs

Song assets live in `static/songs/<SongFolder>/`.

Each song folder should include:

```text
song.json
lyrics.md
<SongFolder>_bass.mp3
<SongFolder>_drums.mp3
<SongFolder>_vocals.mp3
```

The required stems are `bass`, `drums`, and `vocals`. `other` and any additional stems are optional and are discovered automatically when they follow the same suffix pattern:

```text
<SongFolder>_other.mp3
<SongFolder>_keyboards.mp3
<SongFolder>_guitar.mp3
<SongFolder>_other2.mp3
```

Preferred stems render first in the player when present. Any future stems that are not in the preferred order still appear automatically after those stems.

To remove an optional stem from one song, delete its `.mp3` and matching `.peaks.json` file from `static/songs/<SongFolder>/`, then run `npm run songs:prepare` and `npm run build`.

After adding or replacing song files, run:

```bash
npm run songs:prepare
```

This detects BPM from each required drums stem, writes the rounded result back to `song.json` when detection succeeds, validates song metadata, generates missing waveform peak files, and regenerates `static/songs/manifest.json`. Detection warnings preserve the existing curated BPM value.

Use `--skip-bpm-detect` when you need to refresh validation, peaks, or the manifest without rewriting BPM metadata:

```bash
npm run songs:prepare -- --skip-bpm-detect
```

## Build

```bash
npm install
npm run build
```

## Browser preferences

The player remembers three local browser preferences:

- the selected light or dark theme
- the last selected song
- the low-memory ("Lite") mode setting (`on`, `off`, or `auto`)

All preferences are stored in `localStorage` on the user's browser. If a stored song is no longer present in the manifest, the player falls back to the first available song.

## Low-memory (Lite) mode

Stems are decoded to uncompressed PCM and held in memory while a song is loaded. At 44.1 kHz stereo this is roughly 75 MB per three-and-a-half-minute stem, so a six-stem song can occupy around 450 MB — enough to get a tab evicted on phones.

Lite mode shrinks that footprint by downmixing each stem to mono and resampling it to 22.05 kHz as it loads, which cuts the decoded size to about a quarter (a six-stem song drops to roughly 110 MB). The trade-off is reduced stereo image and high-frequency detail, which is usually acceptable for practice. Drums, transpose, and tempo behave exactly as before; only the stored buffer fidelity changes.

The `Lite` toggle lives in the header next to the theme switch. Its default is chosen automatically (`auto`) from device and network signals — data-saver mode, slow connections, low `deviceMemory`, or a coarse-pointer phone-sized screen all turn it on. Toggling it sets an explicit `on`/`off` preference and reloads the current song so the new decode profile takes effect. The conversion runs through an `OfflineAudioContext`; if that is unavailable the player falls back to the full-fidelity buffer rather than failing to load.

## Player controls

The transport panel displays the currently selected song title above two rows of command buttons. The first row contains Play, Stop, and Mixer. The second row contains Sections and Lyrics. Songs with section markers enable the Sections button; pressing it opens a floating panel below the transport controls with seek buttons for each marker. The Lyrics button opens a matching floating lyrics panel below the transport controls.

The Mixer button opens a compact floating mixer panel with a minimal DJ-style layout. Each stem gets a vertical volume fader, Mute and Solo buttons, a percentage readout, and live segmented LED meters driven by per-stem Web Audio analyser levels. Mixer controls stay synchronized with the matching full stem row: changing volume, mute, or solo in either place updates the same stem state.

On portrait phone screens, the mixer switches to tighter channel strips so all available stems fit inside the floating panel without horizontal scrolling. The full stem mixer remains visible below the transport area for waveform, mute, solo, and volume controls.

Each stem row starts collapsed. Use the right-aligned switch in the stem controls to expand or collapse the waveform and volume controls for that stem.

Use the global transpose buttons below the transport readouts to shift all non-drum stems up or down by a semitone. The current transpose amount is displayed between decrement (`-`) and increment (`+`) buttons, and the `Reset transpose` button resets the transpose back to 0. Transpose is global only — every non-drum stem moves together by the same amount, and drum stems stay at original pitch. (Per-stem transpose and the BPM/tempo controls were removed to keep the player lean; the engine still has the tempo capability internally but it is no longer exposed in the UI.)

Loading states use an indeterminate progress bar and skeleton placeholders while the song library, metadata, lyrics, stems, and waveforms are being prepared.

## Transpose approach

Transpose keeps the zero-cost playback path when no pitch shift is active. When pitch shift is active, the app routes affected non-drum stems through a SoundTouch AudioWorklet pitch processor in the Web Audio graph. Native `AudioBufferSourceNode.detune` is not used because detune changes playback rate and can desync stems.

To reduce audible clicks and clipping during live transpose changes, the engine reuses active pitch nodes when the routing is already in place and only fades the master output when pitch routing has to be inserted or removed. Output headroom is plain gain, not compression: `0.7` for unshifted or downward transpose, `0.62` for `+1`/`+2`, and `0.55` for `+3` or higher effective upward transpose.

## Playback transition safety

Inserting or removing pitch routing is asynchronous: the SoundTouch AudioWorklet can take tens of milliseconds to initialize, and the live graph swap also awaits a short master fade. The audio engine guards these awaits so a transition that the user has since superseded can never restart audio against a stale playhead.

Each playback-changing action (`stop`, `pause`, `seek`, loading a new song, and starting a fresh `play`) advances an internal playback epoch. Asynchronous graph work — both starting playback and rebuilding the pitch graph after a transpose or tempo change — captures the current epoch and re-checks it after every `await`. If the epoch has moved on, the operation aborts instead of starting sources. A start guard prevents a second `play` from launching duplicate sources while the worklet is still initializing, and graph rebuilds are serialized so two back-to-back transpose or tempo changes cannot interleave into overlapping source sets.

This prevents a previously observed defect where transposing and then pressing Play or Stop while the pitch worklet was loading could leave orphaned audio sources running while the transport reported a stopped, frozen playhead — which surfaced as the position readout jumping or the playback appearing to accelerate uncontrollably.

## Tempo approach

Dynamic BPM changes keep section markers, waveforms, and seeking on the original song timeline. The audio engine stores the detected metadata BPM as the source BPM and applies a global tempo ratio during playback. When the ratio is not `1`, all stems run through the same SoundTouch path used for transpose so playback speed can change while preserving pitch/key. Drums are only pitch-compensated for tempo changes; they are still excluded from transpose.

## Pitch/tempo on mobile (render mode)

The real-time approach above runs one SoundTouch AudioWorklet per affected stem. On a desktop CPU that is fine, but on a phone, four to six live time-stretch worklets at once overrun the audio deadline: the worklets underrun, so the audio falls behind a wall-clock playhead (it sounds like the song accelerates), dropouts crackle like clipping, and live graph swaps feel unstable.

The engine therefore supports two pitch/tempo strategies, selected by the `pitchTempoMode` option:

- `realtime` (default, desktop): per-stem SoundTouch worklets process audio live, so transpose/tempo changes are instant.
- `render` (auto-enabled on phones): whenever the transpose or tempo changes, each stem is pre-rendered once through SoundTouch in an `OfflineAudioContext` (via the library's `processOffline`) into a plain buffer, and playback then carries **no real-time DSP** at all. This removes the underruns, so the playhead stays locked to the audio and there is no transpose crackle.

SoundTouch adds a small, pitch-dependent constant time offset to whatever it processes (roughly 8 ms at +0, ~13 ms at +2, growing with the interval). To keep the stems phase-locked, render mode routes **every** stem through the same offline pass while any transform is active — including drums, at pitch 0 — rather than leaving drums un-processed and a few-to-tens of milliseconds ahead of the pitched stems. When the transpose is back to 0 and the tempo to 1, all stems revert to their original buffers and no render runs.

Render mode keeps the original decoded buffers so every re-render starts from clean audio, and it keeps the original-timeline model: a baked-in tempo change shortens the rendered buffer, so the engine maps the playhead through the baked tempo ratio when starting and seeking. Changing the key or BPM triggers a brief offline render; the UI shows an "Applying key & tempo…" indicator while it runs, after which playback resumes glitch-free from the same position. Render mode auto-enables on the same device signals as Lite mode (coarse-pointer phone screens, data-saver, slow networks, low device memory).

The mode is chosen per device automatically; desktop keeps the instant real-time path. On mobile the snapshot/meter loop is also throttled to lighten the main thread.

Because the offline render is not CPU-bound, it uses the engine's highest-quality settings: `lanczos` resampling and full (non-`quickSeek`) WSOLA time-stretch with a wider overlap. SoundTouch's default `quickSeek` is what makes harmonic stems such as bass sound detuned/dissonant after a transpose, so it is disabled for the render. The real-time desktop path keeps the lighter defaults to stay responsive.

## Output limiting

The master bus runs through a `DynamicsCompressorNode` configured as a fast brickwall limiter (threshold −1.5 dB, ratio 20, knee 0) before the destination. Summing several stems — especially with time-stretch peak overshoot — can exceed 0 dBFS; the limiter catches those peaks instead of letting the device hard-clip. The per-transpose headroom gain (`0.55`–`0.7`) is retained on top of the limiter.

## Installable app (PWA)

The player ships a web app manifest (`static/manifest.webmanifest`) with maskable icons, so it can be installed to a phone home screen and launched standalone (no browser chrome). `src/service-worker.ts` precaches the built app shell and all static assets on install, and runtime-caches `/songs/*` cache-first, so a song that has been played once stays available offline. The worker is registered from the app shell in production only.

While a song is loaded, the app publishes Media Session metadata and transport handlers, so the lock screen, Bluetooth headset, and car controls can play/pause/stop and seek, and show the current title/artist and artwork. Playback also holds a screen Wake Lock so the phone does not sleep mid-song; the lock is re-acquired when the tab returns to the foreground and released when playback stops.

## Vercel deployment

This project uses a static build output configured to `build/`.

- Build command: `npm run build`
- Output directory: `public`

A `vercel.json` file is included to tell Vercel to use `@vercel/static-build` and the `build` directory.

## Notes

- The application is built with SvelteKit and `@sveltejs/adapter-static`.
- Static site files are written to `public/`.
- `npm run build` copies the current `static/songs` content into `public/songs` for deployment.
