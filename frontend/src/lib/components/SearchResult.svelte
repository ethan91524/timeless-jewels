<script lang="ts">
  import type { SearchWithSeed } from '../skill_tree';
  import { skillTree, translateStat, openTrade } from '../skill_tree';

  export let highlight: (newSeed: number, passives: number[]) => void;
  export let set: SearchWithSeed;
  export let jewel: number;
  // null means "any conqueror" — see constructQuery in trade.ts
  export let conqueror: string | null;
  export let platform: string;
  export let league: string;
  export let isLegacyTradersMode = false;
  /** 搜尋當下的範圍層；只有一層（珠寶範圍）時不顯示標籤 */
  export let scopes: { key: string; label: string; short: string; color: string }[] = [];
</script>

<div
  class="my-2 border-white/50 border p-2 flex flex-col cursor-pointer"
  role="button"
  tabindex="0"
  on:click={() =>
    highlight(
      set.seed,
      set.skills.map((s) => s.passive)
    )}
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      highlight(
        set.seed,
        set.skills.map((s) => s.passive)
      );
    }
  }}>
  <div class="flex flex-row justify-between">
    <!-- Padding -->
    <button class="px-3 invisible">交易</button>
    <div class="font-bold text-orange-500 text-center">
      種子 {set.seed}（權重 {set.weight}）
    </div>
    <button
      class="px-3 bg-blue-500/40 rounded"
      on:click={() => openTrade(jewel, conqueror, [set], platform, league, isLegacyTradersMode)}>交易</button>
  </div>
  {#if scopes.length > 1}
    <div class="flex flex-row flex-wrap gap-2 justify-center mt-1">
      {#each scopes as sc}
        <span
          class="scope-tag"
          style="--c:{sc.color}"
          title="{sc.label}內命中 {set.scopeSkillCounts?.[sc.key] ?? 0} 個天賦，加權 {set.scopeWeights?.[sc.key] ?? 0}">
          {sc.short} {set.scopeSkillCounts?.[sc.key] ?? 0}
        </span>
      {/each}
    </div>
  {/if}
  {#each set.skills as skill}
    <div class="mt-2">
      <span>
        {skillTree.nodes[skill.passive].name} ({skill.passive})
      </span>
      <ul class="list-disc pl-6 font-bold">
        {#each Object.keys(skill.stats) as stat}
          <li>{translateStat(stat, skill.stats[stat])}</li>
        {/each}
      </ul>
    </div>
  {/each}
</div>

<style lang="postcss">
  .scope-tag {
    @apply text-xs rounded-full px-2 py-0.5 whitespace-nowrap;
    border: 1px solid var(--c);
    color: var(--c);
  }
</style>
