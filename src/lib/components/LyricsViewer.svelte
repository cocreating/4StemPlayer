<script lang="ts">
  type Props = {
    lyrics?: string;
    open?: boolean;
    onClose?: () => void;
  };

  let { lyrics = '', open = false, onClose = () => {} }: Props = $props();
</script>

<section
  id="lyrics-popover"
  class:lyrics-popover-open={open}
  class="lyrics-popover panel"
  aria-labelledby="lyrics-title"
  aria-hidden={!open}
>
  <div class="lyrics-popover-header">
    <h2 id="lyrics-title">Lyrics</h2>
    <button
      type="button"
      class="lyrics-popover-close"
      tabindex={open ? 0 : -1}
      aria-label="Close lyrics"
      onclick={onClose}
    >
      Close
    </button>
  </div>

  <div class="lyrics-panel">
    {#if lyrics.trim()}
      <pre>{lyrics}</pre>
    {:else}
      <p>No lyrics are available for this song.</p>
    {/if}
  </div>
</section>
