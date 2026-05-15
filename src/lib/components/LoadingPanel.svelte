<script lang="ts">
  type Props = {
    title: string;
    description: string;
  };

  let { title, description }: Props = $props();
</script>

<section class="panel loading-panel" role="status" aria-live="polite" aria-busy="true">
  <div class="loading-copy">
    <h2>{title}</h2>
    <p>{description}</p>
  </div>

  <div class="loading-progress" role="progressbar" aria-label={title}>
    <span></span>
  </div>

  <div class="loading-skeleton" aria-hidden="true">
    <span></span>
    <span></span>
    <span></span>
  </div>
</section>
