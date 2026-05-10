<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type WaveSurfer from 'wavesurfer.js';
  import type { StemName } from '$lib/audio/AudioEngine';

  export let stemName: StemName;
  export let url = '';
  export let peaksUrl: string | undefined = undefined;
  export let position = 0;
  export let duration = 0;
  export let loading = false;
  export let error: string | null = null;
  export let onSeek: (time: number) => void = () => {};

  let container: HTMLDivElement;
  let wavesurfer: WaveSurfer | null = null;
  let localError = '';
  let lastUrl = '';
  let lastPeaksUrl = '';

  async function loadPeaks() {
    if (!peaksUrl) {
      return undefined;
    }

    const response = await fetch(peaksUrl);
    if (!response.ok) {
      throw new Error(`${peaksUrl}: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { peaks?: number[] };
    return payload.peaks ? [payload.peaks] : undefined;
  }

  async function createWaveform() {
    if (!container || !url) {
      return;
    }

    wavesurfer?.destroy();
    wavesurfer = null;
    localError = '';
    lastUrl = url;
    lastPeaksUrl = peaksUrl ?? '';

    try {
      const [{ default: WaveSurferConstructor }, peaks] = await Promise.all([
        import('wavesurfer.js'),
        loadPeaks()
      ]);

      wavesurfer = WaveSurferConstructor.create({
        container,
        height: 72,
        normalize: true,
        interact: true,
        cursorWidth: 2,
        cursorColor: '#111827',
        waveColor: '#8fb7c7',
        progressColor: '#0f766e',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        url: peaks ? undefined : url,
        peaks,
        duration: peaks ? duration : undefined
      });

      wavesurfer.on('interaction', (newTime: number) => {
        onSeek(newTime);
      });
      wavesurfer.on('error', (message) => {
        localError = String(message);
      });
    } catch (createError) {
      localError = createError instanceof Error ? createError.message : String(createError);
    }
  }

  onMount(() => {
    void createWaveform();
  });

  onDestroy(() => {
    wavesurfer?.destroy();
  });

  $: if (wavesurfer && Math.abs(wavesurfer.getCurrentTime() - position) > 0.05) {
    wavesurfer.setTime(Math.min(position, duration || position));
  }

  $: if (container && url && (url !== lastUrl || (peaksUrl ?? '') !== lastPeaksUrl)) {
    void createWaveform();
  }
</script>

<div class="waveform-shell" aria-label={`${stemName} waveform`}>
  <div bind:this={container} class="waveform-canvas"></div>

  {#if loading}
    <div class="waveform-overlay" role="status">Loading waveform</div>
  {:else if error || localError}
    <div class="waveform-overlay waveform-error" role="alert">
      {error || localError}
    </div>
  {/if}
</div>
