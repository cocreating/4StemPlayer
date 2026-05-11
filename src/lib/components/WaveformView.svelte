<script lang="ts">
  import type WaveSurfer from 'wavesurfer.js';
  import type { StemName } from '$lib/audio/AudioEngine';

  type Props = {
    stemName: StemName;
    url?: string;
    peaksUrl?: string;
    position?: number;
    duration?: number;
    loading?: boolean;
    error?: string | null;
    onSeek?: (time: number) => void;
  };

  let {
    stemName,
    url = '',
    peaksUrl,
    position = 0,
    duration = 0,
    loading = false,
    error = null,
    onSeek = () => {}
  }: Props = $props();

  let container = $state<HTMLDivElement | undefined>(undefined);
  let wavesurfer: WaveSurfer | null = null;
  let localError = $state('');

  async function loadPeaks(nextPeaksUrl: string | undefined) {
    if (!nextPeaksUrl) {
      return undefined;
    }

    const response = await fetch(nextPeaksUrl);
    if (!response.ok) {
      throw new Error(`${nextPeaksUrl}: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { peaks?: number[] };
    return payload.peaks ? [payload.peaks] : undefined;
  }

  function destroyWaveform() {
    wavesurfer?.destroy();
    wavesurfer = null;
  }

  async function createWaveform(
    targetContainer: HTMLDivElement,
    nextUrl: string,
    nextPeaksUrl: string | undefined,
    nextDuration: number
  ) {
    const [{ default: WaveSurferConstructor }, peaks] = await Promise.all([
      import('wavesurfer.js'),
      loadPeaks(nextPeaksUrl)
    ]);

    const nextWaveform = WaveSurferConstructor.create({
      container: targetContainer,
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
      url: peaks ? undefined : nextUrl,
      peaks,
      duration: peaks ? nextDuration : undefined
    });

    nextWaveform.on('interaction', (newTime: number) => {
      onSeek(newTime);
    });
    nextWaveform.on('error', (message) => {
      localError = String(message);
    });

    return nextWaveform;
  }

  $effect(() => {
    const targetContainer = container;
    const nextUrl = url;
    const nextPeaksUrl = peaksUrl;
    const nextDuration = duration;

    if (!targetContainer || !nextUrl) {
      destroyWaveform();
      return;
    }

    let cancelled = false;
    destroyWaveform();
    localError = '';

    void createWaveform(targetContainer, nextUrl, nextPeaksUrl, nextDuration)
      .then((nextWaveform) => {
        if (cancelled) {
          nextWaveform.destroy();
          return;
        }

        wavesurfer = nextWaveform;
        if (position > 0) {
          wavesurfer.setTime(Math.min(position, duration || position));
        }
      })
      .catch((createError) => {
        if (!cancelled) {
          localError = createError instanceof Error ? createError.message : String(createError);
        }
      });

    return () => {
      cancelled = true;
      destroyWaveform();
    };
  });

  $effect(() => {
    if (wavesurfer && Math.abs(wavesurfer.getCurrentTime() - position) > 0.05) {
      wavesurfer.setTime(Math.min(position, duration || position));
    }
  });
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
