# Svelte 5 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for behavior-affecting changes and `superpowers:verification-before-completion` before claiming completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Svelte UI from legacy-compatible Svelte 4 syntax to idiomatic Svelte 5 runes syntax without changing player behavior.

**Status:** Implemented on 2026-05-11 after checkpoint commit `f966585`. The legacy-surface inventory below records the pre-migration state that this plan addressed.

**Architecture:** Migrate from the leaves inward so small, mostly-presentational components prove the syntax pattern before touching the stateful player shell. Keep the existing callback-prop architecture because it already matches Svelte 5 guidance better than `createEventDispatcher`. Treat `WaveformView.svelte` as the only high-risk component because it coordinates DOM binding, WaveSurfer lifecycle, async peak loading, and transport synchronization.

**Tech Stack:** Svelte 5.55.5, SvelteKit 2.59.1, TypeScript 6.0.3, Vite 8, Vitest, svelte-check, WaveSurfer 7.

---

## Source Guidance

- Official Svelte 5 migration guide: use `$state`, `$derived`, `$effect`, `$props`, event attributes, and render snippets.
- Svelte 5 still supports legacy syntax, so this can be migrated component-by-component.
- The official migration script can automate some changes, but it may leave `svelte/legacy` helpers behind. Because this app has a small Svelte surface, use manual edits for clearer final code.
- `onMount` and `onDestroy` are still valid in Svelte 5. Use `$effect` for state-driven side effects, especially WaveSurfer synchronization.

## Current Legacy Surface

- `src/routes/+layout.svelte`: uses `<slot />`.
- `src/lib/components/LyricsViewer.svelte`: uses `export let`.
- `src/lib/components/SongSelector.svelte`: uses `export let` and `on:change`.
- `src/lib/components/TransportBar.svelte`: uses `export let`, `$:` derived labels, and `on:click` / `on:input`.
- `src/lib/components/SongInfoPanel.svelte`: uses `export let`, `$:` derived labels, and `on:click`.
- `src/lib/components/StemMixer.svelte`: uses `export let`.
- `src/lib/components/StemRow.svelte`: uses `export let`, `$:` derived `volumeId`, and `on:click` / `on:input`.
- `src/lib/components/WaveformView.svelte`: uses `export let` and two `$:` side-effect blocks.
- `src/lib/components/AppShell.svelte`: uses top-level reactive `let` state and lifecycle hooks.

## Files To Modify

- `src/routes/+layout.svelte`: replace `<slot />` with typed `children` snippet rendering.
- `src/lib/components/LyricsViewer.svelte`: convert props to `$props`.
- `src/lib/components/SongSelector.svelte`: convert props and event attributes.
- `src/lib/components/TransportBar.svelte`: convert props, derived labels, and event attributes.
- `src/lib/components/SongInfoPanel.svelte`: convert props, derived labels, and event attributes.
- `src/lib/components/StemMixer.svelte`: convert props.
- `src/lib/components/StemRow.svelte`: convert props, derived label, and event attributes.
- `src/lib/components/WaveformView.svelte`: convert props and reactive side effects.
- `src/lib/components/AppShell.svelte`: convert app state to `$state`, keep lifecycle cleanup, and verify callback prop wiring.

## Useful Skills

- `best-practices`: use for code quality and modernization checks.
- `superpowers:executing-plans`: use to run this plan in small, reviewable steps.
- `superpowers:test-driven-development`: use when changing behavior or adding regression coverage around WaveSurfer lifecycle, keyboard playback, or song formatting.
- `superpowers:systematic-debugging`: use if the migrated app compiles but playback, waveform loading, or keyboard controls regress.
- `superpowers:verification-before-completion`: use before final status, commit, push, or PR.

## Migration Tasks

### Task 1: Establish A Clean Migration Baseline

- [ ] Run `git status --short`.
- [ ] Review dirty files before editing:

```bash
git diff -- src/lib/components src/routes src/lib/songs.ts src/lib/songs.test.ts
git diff -- static/songs/GloryBox/song.json static/songs/GloryBox/lyrics.md
```

- [ ] Do not overwrite song metadata, lyrics, or unrelated component edits. If existing changes are intentional, keep them and migrate around them.
- [ ] Run baseline verification:

```bash
npm run check
npm test
npm run build
```

Expected: all commands pass before syntax migration starts. If they fail, fix or document the failure first so the migration is not blamed for pre-existing problems.

### Task 2: Migrate The Route Layout Slot

- [ ] Modify `src/routes/+layout.svelte`.
- [ ] Replace legacy `<slot />` with Svelte 5 snippet rendering:

```svelte
<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

{@render children?.()}
```

- [ ] Run `npm run check`.

Expected: no Svelte diagnostics.

### Task 3: Migrate Leaf Display Components

- [ ] Modify `src/lib/components/LyricsViewer.svelte`.
- [ ] Replace `export let lyrics = '';` with:

```svelte
<script lang="ts">
  type Props = {
    lyrics?: string;
  };

  let { lyrics = '' }: Props = $props();
</script>
```

- [ ] Modify `src/lib/components/SongSelector.svelte`.
- [ ] Convert props and event handling:

```svelte
<script lang="ts">
  import type { SongManifestEntry } from '$lib/types';

  type Props = {
    songs?: SongManifestEntry[];
    selectedId?: string;
    loading?: boolean;
    onSelect?: (songId: string) => void;
  };

  let {
    songs = [],
    selectedId = '',
    loading = false,
    onSelect = () => {}
  }: Props = $props();

  function handleChange(event: Event) {
    onSelect((event.currentTarget as HTMLSelectElement).value);
  }
</script>
```

- [ ] Replace `on:change={...}` with `onchange={handleChange}`.
- [ ] Run `npm run check`.

Expected: no Svelte diagnostics.

### Task 4: Migrate Transport And Song Info Derived Values

- [ ] Modify `src/lib/components/TransportBar.svelte`.
- [ ] Convert props to `$props`.
- [ ] Convert `$:` labels to `$derived`:

```ts
let progressLabel = $derived(`${formatTime(position)} of ${formatTime(duration)}`);
let positionSecondsLabel = $derived(`${formatDurationSeconds(position)} seconds`);
```

- [ ] Move inline range casting into a named handler:

```ts
function handleSeekInput(event: Event) {
  onSeek(Number((event.currentTarget as HTMLInputElement).value));
}
```

- [ ] Replace `on:click` with `onclick` and `on:input` with `oninput`.
- [ ] Modify `src/lib/components/SongInfoPanel.svelte`.
- [ ] Convert props to `$props`.
- [ ] Convert `$:` values to `$derived`:

```ts
let chordText = $derived(formatChords(metadata.chords));
let durationText = $derived(formatMetadataDuration(metadata));
let durationSecondsText = $derived(formatDurationSeconds(metadata.durationSeconds));
```

- [ ] Replace section marker `on:click` with `onclick`.
- [ ] Run:

```bash
npm run check
npm test -- src/lib/songs.test.ts
```

Expected: type check passes and song formatting tests still pass.

### Task 5: Migrate Stem Mixer And Stem Row

- [ ] Modify `src/lib/components/StemMixer.svelte`.
- [ ] Convert props to a typed `$props` destructure. Keep callback props as-is because they are already the Svelte 5-preferred component communication style.
- [ ] Modify `src/lib/components/StemRow.svelte`.
- [ ] Convert props to `$props`.
- [ ] Convert `volumeId` to `$derived`:

```ts
let volumeId = $derived(`${stem.name}-volume`);
```

- [ ] Move input casting into a named handler:

```ts
function handleVolumeInput(event: Event) {
  onVolume(Number((event.currentTarget as HTMLInputElement).value));
}
```

- [ ] Replace `on:click` with `onclick` and `on:input` with `oninput`.
- [ ] Run `npm run check`.

Expected: no Svelte diagnostics.

### Task 6: Migrate WaveformView Carefully

- [ ] Modify `src/lib/components/WaveformView.svelte`.
- [ ] Convert props to `$props`.
- [ ] Keep `onMount` only if it remains clearer after `$effect` conversion; otherwise use `$effect` for create/destroy lifecycle tied to `container`, `url`, `peaksUrl`, and `duration`.
- [ ] Convert `localError` to `$state('')` because it renders in the template.
- [ ] Keep `wavesurfer` as a plain variable or `$state.raw<WaveSurfer | null>(null)` so WaveSurfer instances are not deep-proxied.
- [ ] Replace the current waveform reload `$:` block with an effect that cancels stale async creation:

```ts
$effect(() => {
  if (!container || !url) {
    return;
  }

  let cancelled = false;
  void createWaveform().then(() => {
    if (cancelled) {
      wavesurfer?.destroy();
      wavesurfer = null;
    }
  });

  return () => {
    cancelled = true;
  };
});
```

- [ ] Replace the current position-sync `$:` block with `$effect`:

```ts
$effect(() => {
  if (wavesurfer && Math.abs(wavesurfer.getCurrentTime() - position) > 0.05) {
    wavesurfer.setTime(Math.min(position, duration || position));
  }
});
```

- [ ] Verify that waveform reload still destroys the previous WaveSurfer instance before creating a new one.
- [ ] Run `npm run check`.

Expected: no Svelte diagnostics.

### Task 7: Migrate AppShell State

- [ ] Modify `src/lib/components/AppShell.svelte`.
- [ ] Convert app-owned mutable UI state to `$state`:

```ts
let songs = $state<SongManifestEntry[]>([]);
let selectedSongId = $state('');
let selectedEntry = $state<SongManifestEntry | null>(null);
let songBundle = $state<SongBundle | null>(null);
let engineSnapshot = $state<AudioEngineSnapshot | null>(null);
let manifestLoading = $state(true);
let songLoading = $state(false);
let appError = $state('');
```

- [ ] Keep `engine` and `unsubscribe` as plain variables because they are external resources and do not render directly.
- [ ] Keep the existing callback prop flow to children.
- [ ] Keep `onMount` for boot and global keydown registration.
- [ ] Keep `onDestroy` for engine cleanup.
- [ ] Run:

```bash
npm run check
npm test -- src/lib/keyboard.test.ts
```

Expected: no diagnostics and keyboard playback shortcut tests still pass.

### Task 8: Remove Remaining Legacy Syntax

- [ ] Search for remaining legacy syntax:

```bash
rg -n "export let|\\$:\\s|on:|<slot|svelte/legacy|createEventDispatcher|beforeUpdate|afterUpdate" src
```

- [ ] Expected: no matches, except false positives inside comments if any were intentionally added.
- [ ] If `svelte/legacy` appears, refactor it out manually rather than accepting migration-script stopgaps.

### Task 9: Full Verification

- [ ] Run all project checks:

```bash
npm run check
npm test
npm run build
```

- [ ] Start the dev server:

```bash
npm run dev
```

- [ ] Browser smoke test:
  - Load the app.
  - Confirm the song manifest loads.
  - Confirm Glory Box metadata and lyrics render.
  - Confirm transport buttons are enabled after load.
  - Confirm Space toggles play/pause when focus is not in an input.
  - Confirm mute, solo, volume, section seek, and waveform seek still call into the player.

### Task 10: Documentation And Commit

- [ ] Update `.agents/docs/architecture-and-stack.md` to say the UI is now written in Svelte 5 runes syntax.
- [ ] Update `.agents/docs/README.md` if the overview mentions legacy component syntax.
- [ ] Review changed files:

```bash
git diff -- src .agents/docs
```

- [ ] Commit after verification:

```bash
git add src .agents/docs
git commit -m "refactor: migrate components to svelte 5 runes"
```

- [ ] Push when the user approves or when this is part of the requested publish workflow:

```bash
git push origin main
```

## Execution Recommendation

Do this as a manual migration, not an automatic `sv migrate svelte-5` run. The codebase is small enough that manual edits are clearer, avoid `svelte/legacy` leftovers, and reduce risk around the WaveSurfer lifecycle.
