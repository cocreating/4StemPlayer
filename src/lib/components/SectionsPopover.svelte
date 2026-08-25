<script lang="ts">
  import type { LoopRange } from '$lib/audio/AudioEngine';
  import { formatTime } from '$lib/songs';
  import type { SectionMarker } from '$lib/types';

  type Props = {
    sections?: SectionMarker[];
    open?: boolean;
    currentPosition?: number;
    duration?: number;
    loop?: LoopRange | null;
    onClose?: () => void;
    onSeek?: (time: number) => void;
    onToggleLoop?: (start: number, end: number) => void;
  };

  let {
    sections = [],
    open = false,
    currentPosition = 0,
    duration = 0,
    loop = null,
    onClose = () => {},
    onSeek = () => {},
    onToggleLoop = () => {}
  }: Props = $props();

  function getSectionEnd(index: number, section: SectionMarker) {
    if (typeof section.end === 'number' && Number.isFinite(section.end)) {
      return section.end;
    }
    const nextSection = sections[index + 1];
    if (nextSection && typeof nextSection.start === 'number') {
      return nextSection.start;
    }
    return duration > section.start ? duration : section.start + 30;
  }

  function isSectionActive(index: number, section: SectionMarker) {
    if (currentPosition < section.start) {
      return false;
    }
    const end = getSectionEnd(index, section);
    return currentPosition < end;
  }

  function isSectionLooped(index: number, section: SectionMarker) {
    if (!loop) {
      return false;
    }
    const end = getSectionEnd(index, section);
    return Math.abs(loop.start - section.start) < 0.2 && Math.abs(loop.end - end) < 0.5;
  }
</script>

{#if sections.length}
  <section
    id="sections-popover"
    class:sections-popover-open={open}
    class="sections-popover panel"
    aria-labelledby="sections-popover-title"
    aria-hidden={!open}
  >
    <div class="sections-popover-header">
      <h2 id="sections-popover-title">Sections</h2>
      <button
        type="button"
        class="sections-popover-close"
        tabindex={open ? 0 : -1}
        aria-label="Close sections"
        onclick={onClose}
      >
        Close
      </button>
    </div>

    <div class="section-list">
      {#each sections as section, index (section.label + section.start)}
        {@const active = isSectionActive(index, section)}
        {@const looped = isSectionLooped(index, section)}
        {@const sectionEnd = getSectionEnd(index, section)}
        <div class="section-item">
          <button
            type="button"
            class="section-marker"
            class:active={active}
            class:looped={looped}
            aria-current={active ? 'step' : undefined}
            tabindex={open ? 0 : -1}
            onclick={() => onSeek(section.start)}
          >
            <span>{section.label}</span>
            <span>{formatTime(section.start)}</span>
          </button>
          <button
            type="button"
            class="section-loop-btn"
            class:loop-active={looped}
            aria-pressed={looped}
            tabindex={open ? 0 : -1}
            title={looped ? `Stop looping ${section.label}` : `Loop ${section.label} (${formatTime(section.start)} - ${formatTime(sectionEnd)})`}
            aria-label={looped ? `Stop looping ${section.label}` : `Loop ${section.label}`}
            onclick={(event) => {
              event.stopPropagation();
              onToggleLoop(section.start, sectionEnd);
            }}
          >
            <span aria-hidden="true">🔁</span>
          </button>
        </div>
      {/each}
    </div>
  </section>
{/if}
