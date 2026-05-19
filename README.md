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

The player remembers two local browser preferences:

- the selected light or dark theme
- the last selected song

Both preferences are stored in `localStorage` on the user's browser. If a stored song is no longer present in the manifest, the player falls back to the first available song.

## Player controls

The transport panel displays the currently selected song title above two rows of command buttons. The first row contains Play, Stop, and Mixer. The second row contains Sections and Lyrics. Songs with section markers enable the Sections button; pressing it opens a floating panel below the transport controls with seek buttons for each marker. The Lyrics button opens a matching floating lyrics panel below the transport controls.

The Mixer button opens a compact floating mixer panel with a minimal DJ-style layout. Each stem gets a vertical volume fader, Mute and Solo buttons, a percentage readout, and live segmented LED meters driven by per-stem Web Audio analyser levels. Mixer controls stay synchronized with the matching full stem row: changing volume, mute, or solo in either place updates the same stem state.

On portrait phone screens, the mixer switches to tighter channel strips so all available stems fit inside the floating panel without horizontal scrolling. The full stem mixer remains visible below the transport area for waveform, mute, solo, volume, and pitch controls.

Each stem row starts collapsed. Use the right-aligned switch in the stem controls to expand or collapse the waveform and volume controls for that stem.

Use the BPM controls below the transport readouts to adjust the target playback BPM. The current target BPM is displayed between decrement (`-`) and increment (`+`) buttons, and the `Reset BPM` button returns the playback to the original source tempo.

Use the global transpose buttons below the BPM controls to shift non-drum stems up or down by a semitone. The current transpose amount is displayed between decrement (`-`) and increment (`+`) buttons, and the `Reset transpose` button resets the transpose back to 0. Changing the global transpose realigns every non-drum stem to that new value. Each non-drum stem row can then be expanded and transposed individually after its volume control. Drum stems stay at original pitch and do not receive global transpose or individual pitch correction.

Loading states use an indeterminate progress bar and skeleton placeholders while the song library, metadata, lyrics, stems, and waveforms are being prepared.

## Transpose approach

Transpose keeps the zero-cost playback path when no pitch shift is active. When pitch shift is active, the app routes affected non-drum stems through a SoundTouch AudioWorklet pitch processor in the Web Audio graph. Native `AudioBufferSourceNode.detune` is not used because detune changes playback rate and can desync stems.

To reduce audible clicks and clipping during live transpose changes, the engine reuses active pitch nodes when the routing is already in place and only fades the master output when pitch routing has to be inserted or removed. Output headroom is plain gain, not compression: `0.7` for unshifted or downward transpose, `0.62` for `+1`/`+2`, and `0.55` for `+3` or higher effective upward transpose.

## Tempo approach

Dynamic BPM changes keep section markers, waveforms, and seeking on the original song timeline. The audio engine stores the detected metadata BPM as the source BPM and applies a global tempo ratio during playback. When the ratio is not `1`, all stems run through the same SoundTouch path used for transpose so playback speed can change while preserving pitch/key. Drums are only pitch-compensated for tempo changes; they are still excluded from transpose.

## Vercel deployment

This project uses a static build output configured to `build/`.

- Build command: `npm run build`
- Output directory: `public`

A `vercel.json` file is included to tell Vercel to use `@vercel/static-build` and the `build` directory.

## Notes

- The application is built with SvelteKit and `@sveltejs/adapter-static`.
- Static site files are written to `public/`.
- `npm run build` copies the current `static/songs` content into `public/songs` for deployment.
