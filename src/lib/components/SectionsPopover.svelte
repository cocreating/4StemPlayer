<script lang="ts">
  import { formatTime } from '$lib/songs';
  import type { SectionMarker } from '$lib/types';

  type Props = {
    sections?: SectionMarker[];
    open?: boolean;
    onClose?: () => void;
    onSeek?: (time: number) => void;
  };

  let { sections = [], open = false, onClose = () => {}, onSeek = () => {} }: Props = $props();
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
      {#each sections as section}
        <button type="button" class="section-marker" tabindex={open ? 0 : -1} onclick={() => onSeek(section.start)}>
          <span>{section.label}</span>
          <span>{formatTime(section.start)}</span>
        </button>
      {/each}
    </div>
  </section>
{/if}
