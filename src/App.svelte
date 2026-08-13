<script lang="ts">
  import LineView from './lib/components/LineView.svelte';
  import SetupScreen from './lib/components/SetupScreen.svelte';
  import UpdatePrompt from './lib/components/UpdatePrompt.svelte';
  import { session } from './lib/settings.svelte';
</script>

{#if session.token}
  <LineView />
{:else}
  <SetupScreen />
{/if}

<UpdatePrompt />
