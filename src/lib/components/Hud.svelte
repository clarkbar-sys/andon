<script lang="ts">
  import type { Line, ScoreStat } from '../line';
  import { scoreWindowWords } from '../ui';

  let { line, subtitle }: { line: Line; subtitle: string } = $props();

  const STAT_LABELS: Record<ScoreStat, string> = {
    total: 'score',
    window: 'window',
    'transit-time': 'transit',
  };

  // Real numbers arrive with the issue feed; the HUD shows the shape now.
  const stats = $derived(
    line.score.show.map((key) => ({
      key,
      label: key === 'window' ? scoreWindowWords(line.score.window) : STAT_LABELS[key],
      value: '—',
    })),
  );
</script>

<header class="hud">
  <div class="plant">
    {line.name}
    <small>{subtitle}</small>
  </div>
  <div class="stats">
    {#each stats as stat (stat.key)}
      <div class="stat">
        <span class="n">{stat.value}</span>
        <span class="l">{stat.label}</span>
      </div>
    {/each}
  </div>
</header>

<style>
  .hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 14px 10px;
    padding-top: max(14px, env(safe-area-inset-top));
    background: var(--hud);
    border-bottom: 1px solid var(--line);
  }

  .plant {
    font-family: var(--display);
    font-size: 19px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1.1;
    min-width: 0;
  }

  .plant small {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--steel);
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stats {
    display: flex;
    gap: 6px;
    flex: 0 0 auto;
  }

  .stat {
    text-align: right;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    background: #242c36;
    border-radius: var(--radius);
    padding: 4px 8px;
  }

  .stat .n {
    display: block;
    font-size: 15px;
    font-weight: 700;
    color: var(--amber);
    line-height: 1.1;
  }

  .stat .l {
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--steel);
  }
</style>
