<script lang="ts">
  import type { Station } from '../line';
  import { lampFor } from '../ui';
  import Lamp from './Lamp.svelte';
  import StationCard from './StationCard.svelte';

  let { stations, running = true }: { stations: Station[]; running?: boolean } = $props();

  // Placeholder freight until the issue feed lands; the belt has to move.
  const crates = ['#—', '#—', '#—'];
</script>

<div class="floor" class:stopped={!running}>
  <div class="beltline" aria-hidden="true"></div>
  {#each crates as crate, i (i)}
    <div class="crate" style="animation-delay: {i * -2.7}s" aria-hidden="true">{crate}</div>
  {/each}

  {#each stations as station, i (station.id)}
    <div class="station" class:right={i % 2 === 1}>
      <div class="slot">
        <StationCard {station} />
      </div>
      <Lamp state={lampFor(station)} label="{station.name}: {lampFor(station)}" />
      <div class="slot spacer"></div>
    </div>
  {/each}
</div>

<style>
  .floor {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 12px;
    padding: 16px 12px;
    background: linear-gradient(180deg, #262d37, #20262f);
    overflow: hidden;
  }

  .beltline {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 38px;
    transform: translateX(-50%);
    background: repeating-linear-gradient(180deg, #11151a 0 12px, #1a2029 12px 24px);
    border-left: 3px solid #414c5b;
    border-right: 3px solid #414c5b;
    animation: roll 2.6s linear infinite;
  }

  @keyframes roll {
    to {
      background-position: 0 48px;
    }
  }

  .crate {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 24px;
    display: grid;
    place-items: center;
    background: var(--amber);
    border: 1px solid var(--amber-dark);
    border-radius: var(--radius);
    font-family: var(--mono);
    font-size: 8px;
    color: #201804;
    animation: ride 8s linear infinite;
  }

  @keyframes ride {
    from {
      top: -8%;
    }
    to {
      top: 104%;
    }
  }

  .stopped .beltline,
  .stopped .crate {
    animation-play-state: paused;
  }

  .station {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 48px 1fr;
    align-items: center;
    gap: 6px;
  }

  /* Stations alternate sides so the belt stays visible down the middle. */
  .station.right {
    direction: rtl;
  }

  .station.right .slot {
    direction: ltr;
  }

  .station :global(.lamp) {
    justify-self: center;
  }

  .spacer {
    visibility: hidden;
  }

  @media (min-width: 720px) {
    .floor {
      justify-content: center;
      gap: 22px;
    }
  }
</style>
