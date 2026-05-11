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

  import type { Action } from 'svelte/action';

  let container = $state<HTMLDivElement | undefined>(undefined);
  let localError = $state('');

  async function loadPeaks(nextPeaksUrl: string | undefined) {
    if (!nextPeaksUrl) return undefined;
    const response = await fetch(nextPeaksUrl);
    if (!response.ok) throw new Error(`${nextPeaksUrl}: ${response.status} ${response.statusText}`);
    const payload = (await response.json()) as { peaks?: number[] };
    return payload.peaks ? [payload.peaks] : undefined;
  }

  interface WaveformParams {
    url: string;
    peaksUrl: string | undefined;
    duration: number;
    position: number;
  }

  const waveformAction: Action<HTMLDivElement, WaveformParams> = (node, params) => {
    let wavesurfer: WaveSurfer | null = null;
    let cancelled = false;
    let currentParams = params;

    async function initWaveform(p: WaveformParams) {
      if (!p.url) return;
      
      const [{ default: WaveSurferConstructor }, peaks] = await Promise.all([
        import('wavesurfer.js'),
        loadPeaks(p.peaksUrl)
      ]);

      if (cancelled) return;

      const ws = WaveSurferConstructor.create({
        container: node,
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
        url: peaks ? undefined : p.url,
        peaks,
        duration: peaks ? p.duration : undefined
      });

      ws.on('interaction', (newTime: number) => {
        onSeek(newTime);
      });
      ws.on('error', (message) => {
        localError = String(message);
      });

      wavesurfer = ws;
      
      // Initial position sync
      if (currentParams.position > 0) {
        ws.setTime(Math.min(currentParams.position, currentParams.duration || currentParams.position));
      }
    }

    // Start initialization
    void initWaveform(currentParams).catch((err) => {
      if (!cancelled) localError = err instanceof Error ? err.message : String(err);
    });

    return {
      update(newParams) {
        const needsRecreate =
          newParams.url !== currentParams.url ||
          newParams.peaksUrl !== currentParams.peaksUrl ||
          (currentParams.duration === 0 && newParams.duration > 0);

        if (needsRecreate) {
          wavesurfer?.destroy();
          wavesurfer = null;
          localError = '';
          void initWaveform(newParams).catch((err) => {
            if (!cancelled) localError = err instanceof Error ? err.message : String(err);
          });
        } else if (wavesurfer) {
          if (Math.abs(wavesurfer.getCurrentTime() - newParams.position) > 0.05) {
            wavesurfer.setTime(Math.min(newParams.position, newParams.duration || newParams.position));
          }
        }
        currentParams = newParams;
      },
      destroy() {
        cancelled = true;
        wavesurfer?.destroy();
        wavesurfer = null;
      }
    };
  };
</script>

<div class="waveform-shell" aria-label={`${stemName} waveform`}>
  <div use:waveformAction={{ url, peaksUrl, duration, position }} class="waveform-canvas"></div>

  {#if loading}
    <div class="waveform-overlay" role="status">Loading waveform</div>
  {:else if error || localError}
    <div class="waveform-overlay waveform-error" role="alert">
      {error || localError}
    </div>
  {/if}
</div>
