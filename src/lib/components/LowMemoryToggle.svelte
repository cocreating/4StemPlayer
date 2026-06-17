<script lang="ts">
  type Props = {
    active?: boolean;
    toggle?: () => void;
  };

  let { active = false, toggle = () => {} }: Props = $props();

  let label = $derived(
    active
      ? 'Lite mode on: stems load in mono at a lower sample rate to save memory. Tap to use full quality.'
      : 'Lite mode off: stems load in full quality. Tap for a lighter, phone-friendly load.'
  );
</script>

<button
  type="button"
  class="lite-toggle"
  class:lite-toggle-on={active}
  role="switch"
  aria-checked={active}
  aria-label={label}
  title={label}
  onclick={toggle}
>
  <span class="lite-toggle-dot" aria-hidden="true"></span>
  <span class="lite-toggle-text">Lite</span>
</button>
