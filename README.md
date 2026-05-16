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

This validates song metadata, generates missing waveform peak files, and regenerates `static/songs/manifest.json`.

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

The transport panel displays the currently selected song title above the main Play and Stop buttons.

Each stem row starts collapsed. Use the right-aligned switch in the stem controls to expand or collapse the waveform and volume controls for that stem.

Use the global transpose buttons in the transport panel to shift non-drum stems up or down by semitone. Each non-drum stem row also has pitch correction buttons, so a track can be offset after the global transpose is applied. Drum stems stay at original pitch and do not receive global transpose or individual pitch correction.

Loading states use an indeterminate progress bar and skeleton placeholders while the song library, metadata, lyrics, stems, and waveforms are being prepared.

## Transpose approach

Transpose keeps the zero-cost playback path when no pitch shift is active. When pitch shift is active, the app routes affected non-drum stems through a SoundTouch AudioWorklet pitch processor in the Web Audio graph. Native `AudioBufferSourceNode.detune` is not used because detune changes playback rate and can desync stems.

## Vercel deployment

This project uses a static build output configured to `build/`.

- Build command: `npm run build`
- Output directory: `public`

A `vercel.json` file is included to tell Vercel to use `@vercel/static-build` and the `build` directory.

## Notes

- The application is built with SvelteKit and `@sveltejs/adapter-static`.
- Static site files are written to `public/`.
- `npm run build` copies the current `static/songs` content into `public/songs` for deployment.
