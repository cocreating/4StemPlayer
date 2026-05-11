<script lang="ts">
  type Props = {
    lyrics?: string;
  };

  let { lyrics = '' }: Props = $props();
</script>

<section class="panel lyrics-panel" aria-labelledby="lyrics-title">
  <h2 id="lyrics-title">Lyrics</h2>
  {#if lyrics.trim()}
    <pre>{lyrics}</pre>
  {:else}
    <p>No lyrics are available for this song.</p>
  {/if}
</section>
