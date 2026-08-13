<script lang="ts">
  import type { Station } from '../line';
  import { cordWords } from '../ui';

  let { station, queue }: { station: Station; queue?: string } = $props();
</script>

<div class="card">
  <div class="name">{station.name}</div>
  {#if station.does}
    <div class="does">{station.does}</div>
  {/if}
  <div class="meta">
    <span class="worker" class:agent={station.worker === 'agent'}>{station.worker}</span>
    <span class="cord">{cordWords(station.cord)}</span>
  </div>
  <!-- Until the issue feed lands, the label is the honest thing to show: it is
       what actually puts an issue at this station. -->
  <div class="queue">{queue ?? station.label}</div>
</div>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--card-line);
    border-radius: var(--radius);
    padding: 8px 10px;
    min-width: 0;
  }

  .name {
    font-family: var(--display);
    text-transform: uppercase;
    font-size: 17px;
    letter-spacing: 0.05em;
    line-height: 1.1;
  }

  .does {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    color: var(--steel);
    text-transform: uppercase;
    margin-top: 3px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
    font-family: var(--mono);
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .worker {
    background: var(--amber);
    color: #201804;
    border-radius: 2px;
    padding: 1px 5px;
  }

  .worker.agent {
    background: var(--green);
    color: #04210f;
  }

  .cord {
    border: 1px solid var(--card-line);
    border-radius: 2px;
    padding: 1px 5px;
    color: var(--steel);
  }

  .queue {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--amber);
    margin-top: 6px;
  }
</style>
