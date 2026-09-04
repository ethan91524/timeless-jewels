<script lang="ts">
  import type { SearchResults, SearchWithSeed } from '../skill_tree';
  import SearchResult from './SearchResult.svelte';
  import VirtualList from 'svelte-tiny-virtual-list';

  export let searchResults: SearchResults;
  export let highlight: (newSeed: number, passives: number[]) => void;
  export let groupResults = true;
  export let jewel: number;
  // null means "any conqueror" — see constructQuery in trade.ts
  export let conqueror: string | null;
  export let platform: string;
  export let league: string;
  export let isLegacyTradersMode = false;
  /** 搜尋當下的範圍層，交給每筆結果標「哪一層命中幾個」 */
  export let scopes: { key: string; label: string; short: string; color: string }[] = [];

  // 多層時每筆結果多一列範圍標籤，虛擬清單的高度要跟著加，否則卡片會互相重疊
  $: computeSize = (r: SearchWithSeed) =>
    8 + 48 + (scopes.length > 1 ? 26 : 0) + r.skills.reduce((o, s) => o + 32 + Object.keys(s.stats).length * 24, 0);

  let expandedGroup: string | number = '';
</script>

{#if groupResults}
  <div class="flex flex-col overflow-auto">
    {#each Object.keys(searchResults.grouped)
      .map((x) => parseInt(x))
      .sort((a, b) => a - b)
      .reverse() as k}
      <button
        class="text-lg w-full p-2 px-4 bg-neutral-500/30 rounded flex flex-row justify-between mb-2"
        on:click={() => (expandedGroup = expandedGroup === k ? '' : k)}>
        <span>
          符合 {k} 項 [{searchResults.grouped[k].length}]
        </span>
        <span>
          {expandedGroup === k ? '^' : 'V'}
        </span>
      </button>

      {#if expandedGroup === k}
        <div class="flex flex-col overflow-auto min-h-[200px] mb-2">
          <VirtualList
            height="auto"
            overscanCount={10}
            itemCount={searchResults.grouped[k].length}
            itemSize={searchResults.grouped[k].map(computeSize)}>
            <div slot="item" let:index let:style {style}>
              <SearchResult
                set={searchResults.grouped[k][index]}
                {highlight}
                {scopes}
                {jewel}
                {conqueror}
                {platform}
                {league}
                {isLegacyTradersMode} />
            </div>
          </VirtualList>
        </div>
      {/if}
    {/each}
  </div>
{:else}
  <div class="mt-4 flex flex-col overflow-auto">
    <VirtualList
      height="auto"
      overscanCount={15}
      itemCount={searchResults.raw.length}
      itemSize={searchResults.raw.map(computeSize)}>
      <div slot="item" let:index let:style {style}>
        <SearchResult
          set={searchResults.raw[index]}
          {highlight}
          {scopes}
          {jewel}
          {conqueror}
          {platform}
          {league}
          {isLegacyTradersMode} />
      </div>
    </VirtualList>
  </div>
{/if}
