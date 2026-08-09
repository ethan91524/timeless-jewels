<script lang="ts">
  import SkillTree from '../../lib/components/SkillTree.svelte';
  import Select from 'svelte-select';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { Node } from '../../lib/skill_tree_types';
  import {
    getAffectedNodes,
    skillTree,
    translateStat,
    constructQueries,
    openQuery,
    seedsPerQuery,
    isTaiwan,
    TW_LEAGUES
  } from '../../lib/skill_tree';
  import { syncWrap } from '../../lib/worker';
  import { proxy } from 'comlink';
  import type { ReverseSearchConfig, StatConfig, TradeQuery } from '../../lib/skill_tree';
  import SearchResults from '../../lib/components/SearchResults.svelte';
  import { statValues } from '../../lib/values';
  import { data, calculator } from '../../lib/types';
  import { onMount } from 'svelte';
  import { jewelLabel, conquerorLabel } from '../../lib/zh';
  import { base } from '$app/paths';

  const searchParams = $page.url.searchParams;

  const jewels = Object.keys(data.TimelessJewels).map((k) => ({
    value: parseInt(k),
    label: jewelLabel(data.TimelessJewels[k])
  }));

  let selectedJewel = searchParams.has('jewel') ? jewels.find((j) => j.value == searchParams.get('jewel')) : undefined;

  $: conquerors = selectedJewel
    ? Object.keys(data.TimelessJewelConquerors[selectedJewel.value]).map((k) => ({
        value: k,
        label: conquerorLabel(k)
      }))
    : [];

  // The conqueror only ever changes the keystone, so a stat search that skips
  // keystones gives identical results for all of them. "Any" exploits that to
  // build trade links matching every conqueror at once.
  const ANY_CONQUEROR = 'Any';
  $: conquerorItems = [...conquerors, { value: ANY_CONQUEROR, label: '不限人名' }];

  let selectedConqueror = searchParams.has('conqueror')
    ? {
        value: searchParams.get('conqueror'),
        label:
          searchParams.get('conqueror') === ANY_CONQUEROR ? '不限人名' : conquerorLabel(searchParams.get('conqueror'))
      }
    : undefined;

  $: isAnyConqueror = selectedConqueror?.value === ANY_CONQUEROR;

  let seed: number = searchParams.has('seed') ? parseInt(searchParams.get('seed')) : 0;

  let circledNode: number | undefined = searchParams.has('location')
    ? parseInt(searchParams.get('location'))
    : undefined;

  $: affectedNodes = circledNode
    ? getAffectedNodes(skillTree.nodes[circledNode]).filter((n) => !n.isJewelSocket && !n.isMastery)
    : [];

  $: seedResults =
    !seed ||
    !selectedJewel ||
    !selectedConqueror ||
    Object.keys(data.TimelessJewelConquerors[selectedJewel.value]).indexOf(selectedConqueror.value) < 0
      ? []
      : affectedNodes
          .filter((n) => !!data.TreeToPassive[n.skill])
          .map((n) => ({
            node: n.skill,
            result: calculator.Calculate(
              data.TreeToPassive[n.skill].Index,
              seed,
              selectedJewel.value,
              selectedConqueror.value
            )
          }));

  let selectedStats: Record<number, StatConfig> = {};
  if (searchParams.has('stat')) {
    searchParams.getAll('stat').forEach((s) => {
      const nStat = parseInt(s);
      selectedStats[nStat] = {
        weight: 1,
        min: 0,
        id: nStat
      };
    });
  }

  let mode = searchParams.has('mode') ? searchParams.get('mode') : '';

  // "Any" has no meaning for a single-seed preview: that view renders the
  // keystone, which is exactly the part the conqueror decides.
  $: if (isAnyConqueror && mode === 'seed') {
    mode = 'stats';
  }

  let disabled = new Set<number>();

  const updateUrl = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    selectedJewel && url.searchParams.append('jewel', selectedJewel.value.toString());
    selectedConqueror && url.searchParams.append('conqueror', selectedConqueror.value);
    seed && url.searchParams.append('seed', seed.toString());
    circledNode && url.searchParams.append('location', circledNode.toString());
    mode && url.searchParams.append('mode', mode);
    disabled.forEach((d) => url.searchParams.append('disabled', d.toString()));

    Object.keys(selectedStats).forEach((s) => {
      url.searchParams.append('stat', s.toString());
    });

    goto(url.toString());
  };

  const setMode = (newMode: string) => {
    mode = newMode;
    updateUrl();
  };

  if (searchParams.has('disabled')) {
    searchParams.getAll('disabled').forEach((d) => {
      disabled.add(parseInt(d));
    });
  }

  const clickNode = (node: Node) => {
    if (node.isJewelSocket) {
      circledNode = node.skill;
      updateUrl();
    } else if (!node.isMastery) {
      if (disabled.has(node.skill)) {
        disabled.delete(node.skill);
      } else {
        disabled.add(node.skill);
      }
      // Re-assign to update svelte
      disabled = disabled;
      updateUrl();
    }
  };

  const allPossibleStats: { [key: string]: { [key: string]: number } } = JSON.parse(data.PossibleStats);

  $: availableStats = !selectedJewel ? [] : Object.keys(allPossibleStats[selectedJewel.value]);
  $: statItems = availableStats
    .map((statId) => {
      const id = parseInt(statId);
      return {
        label: translateStat(id),
        value: id
      };
    })
    .filter((s) => !(s.value in selectedStats));

  let statSelector: Select;
  const selectStat = (stat: CustomEvent) => {
    selectedStats[stat.detail.value] = {
      weight: 1,
      min: 0,
      id: stat.detail.value
    };
    selectedStats = selectedStats;
    statSelector.handleClear();
    updateUrl();
  };

  const removeStat = (id: number) => {
    delete selectedStats[id];
    // Re-assign to update svelte
    selectedStats = selectedStats;
    updateUrl();
  };

  const changeJewel = () => {
    selectedStats = {};
    updateUrl();
  };

  let results = false;
  let minTotalWeight = 0;
  let searching = false;
  let currentSeed = 0;
  let searchResults: SearchResults;
  let searchJewel = 1;
  let searchConqueror: string | null = null;
  const search = () => {
    if (!circledNode) {
      return;
    }

    searchJewel = selectedJewel.value;
    searchConqueror = isAnyConqueror ? null : selectedConqueror.value;
    searching = true;
    searchResults = undefined;

    const query: ReverseSearchConfig = {
      jewel: selectedJewel.value,
      // Keystones are the only conqueror-dependent passives, so under "Any" we
      // drop them and any conqueror then yields the same rolls.
      conqueror: isAnyConqueror ? conquerors[0].value : selectedConqueror.value,
      nodes: affectedNodes
        .filter((n) => !disabled.has(n.skill))
        .filter((n) => !isAnyConqueror || !n.isKeystone)
        .map((n) => data.TreeToPassive[n.skill])
        .filter((n) => !!n)
        .map((n) => n.Index),
      stats: Object.keys(selectedStats).map((stat) => selectedStats[stat]),
      minTotalWeight
    };

    syncWrap
      .search(
        query,
        proxy((s) => (currentSeed = s))
      )
      .then((result) => {
        searchResults = result;
        searching = false;
        results = true;
      });
  };

  let highlighted: number[] = [];
  const highlight = (newSeed: number, passives: number[]) => {
    seed = newSeed;
    highlighted = passives;
    updateUrl();
  };

  const selectAll = () => {
    disabled.clear();
    // Re-assign to update svelte
    disabled = disabled;
  };

  const selectAllNotables = () => {
    affectedNodes.forEach((n) => {
      if (n.isNotable) {
        disabled.delete(n.skill);
      }
    });
    // Re-assign to update svelte
    disabled = disabled;
  };

  const selectAllPassives = () => {
    affectedNodes.forEach((n) => {
      if (!n.isNotable) {
        disabled.delete(n.skill);
      }
    });
    // Re-assign to update svelte
    disabled = disabled;
  };

  const deselectAll = () => {
    affectedNodes.filter((n) => !n.isJewelSocket && !n.isMastery).forEach((n) => disabled.add(n.skill));
    // Re-assign to update svelte
    disabled = disabled;
  };

  let groupResults =
    localStorage.getItem('groupResults') === null ? true : localStorage.getItem('groupResults') === 'true';
  $: localStorage.setItem('groupResults', groupResults ? 'true' : 'false');

  type CombinedResult = {
    id: string;
    rawStat: string;
    stat: string;
    passives: number[];
  };

  export const colorKeys = {
    physical: '#c79d93',
    cast: '#b3f8fe',
    fire: '#ff9a77',
    cold: '#93d8ff',
    lightning: '#f8cb76',
    attack: '#da814d',
    life: '#c96e6e',
    chaos: '#d8a7d3',
    unique: '#af6025',
    critical: '#b2a7d6'
  };

  const colorMessage = (message: string): string => {
    Object.keys(colorKeys).forEach((key) => {
      const value = colorKeys[key];
      message = message.replace(
        new RegExp(`(${key}(?:$|\\s))|((?:^|\\s)${key})`, 'gi'),
        `<span style='color: ${value}; font-weight: bold'>$1$2</span>`
      );
    });

    return message;
  };

  const combineResults = (
    rawResults: { result: data.AlternatePassiveSkillInformation; node: number }[],
    withColors: boolean,
    only: 'notables' | 'passives' | 'all'
  ): CombinedResult[] => {
    const mappedStats: { [key: number]: number[] } = {};
    rawResults.forEach((r) => {
      if (skillTree.nodes[r.node].isKeystone) {
        return;
      }

      if (only !== 'all') {
        if (only === 'notables' && !skillTree.nodes[r.node].isNotable) {
          return;
        }

        if (only === 'passives' && skillTree.nodes[r.node].isNotable) {
          return;
        }
      }

      if (r.result.AlternatePassiveSkill && r.result.AlternatePassiveSkill.StatsKeys) {
        r.result.AlternatePassiveSkill.StatsKeys.forEach((key) => {
          mappedStats[key] = [...(mappedStats[key] || []), r.node];
        });
      }

      if (r.result.AlternatePassiveAdditionInformations) {
        r.result.AlternatePassiveAdditionInformations.forEach((info) => {
          if (info.AlternatePassiveAddition.StatsKeys) {
            info.AlternatePassiveAddition.StatsKeys.forEach((key) => {
              mappedStats[key] = [...(mappedStats[key] || []), r.node];
            });
          }
        });
      }
    });

    return Object.keys(mappedStats).map((statID) => {
      const translated = translateStat(parseInt(statID));
      return {
        stat: withColors ? colorMessage(translated) : translated,
        rawStat: translated,
        id: statID,
        passives: mappedStats[statID]
      };
    });
  };

  const sortCombined = (
    combinedResults: CombinedResult[],
    order: 'count' | 'alphabet' | 'rarity' | 'value'
  ): CombinedResult[] => {
    switch (order) {
      case 'alphabet':
        return combinedResults.sort((a, b) =>
          a.rawStat
            .replace(/[#+%]/gi, '')
            .trim()
            .toLowerCase()
            .localeCompare(b.rawStat.replace(/[#+%]/gi, '').trim().toLowerCase())
        );
      case 'count':
        return combinedResults.sort((a, b) => b.passives.length - a.passives.length);
      case 'rarity':
        return combinedResults.sort(
          (a, b) => allPossibleStats[selectedJewel.value][a.id] - allPossibleStats[selectedJewel.value][b.id]
        );
      case 'value':
        return combinedResults.sort((a, b) => {
          const aValue = statValues[a.id] || 0;
          const bValue = statValues[b.id] || 0;
          if (aValue != bValue) {
            return bValue - aValue;
          }
          return allPossibleStats[selectedJewel.value][a.id] - allPossibleStats[selectedJewel.value][b.id];
        });
    }

    return combinedResults;
  };

  const sortResults = [
    {
      label: 'Count',
      value: 'count'
    },
    {
      label: 'Alphabetical',
      value: 'alphabet'
    },
    {
      label: 'Rarity',
      value: 'rarity'
    },
    {
      label: 'Value',
      value: 'value'
    }
  ] as const;

  let sortOrder = sortResults.find((r) => r.value === (localStorage.getItem('sortOrder') || 'count'));
  $: localStorage.setItem('sortOrder', sortOrder.value);

  let colored = localStorage.getItem('colored') === null ? true : localStorage.getItem('colored') === 'true';
  $: localStorage.setItem('colored', colored ? 'true' : 'false');

  let split = localStorage.getItem('split') === null ? true : localStorage.getItem('split') === 'true';
  $: localStorage.setItem('split', split ? 'true' : 'false');

  const onPaste = (event: ClipboardEvent) => {
    if (event.type !== 'paste') {
      return;
    }

    const paste = (event.clipboardData || window.clipboardData).getData('text');
    const lines = paste.split('\n');

    if (lines.length < 14) {
      return;
    }

    const jewel = jewels.find((j) => j.label === lines[2]);
    if (!jewel) {
      return;
    }

    let newSeed: number | undefined;
    let conqueror: string | undefined;
    for (let i = 10; i < lines.length; i++) {
      conqueror = Object.keys(data.TimelessJewelConquerors[jewel.value]).find((k) => lines[i].indexOf(k) >= 0);
      if (conqueror) {
        const matches = /(\d+)/.exec(lines[i]);
        if (matches.length === 0) {
          continue;
        }

        newSeed = parseInt(matches[1]);
        break;
      }
    }

    if (!conqueror || !newSeed) {
      return;
    }

    results = false;
    mode = 'seed';
    seed = newSeed;
    selectedJewel = jewel;
    selectedConqueror = { label: conquerorLabel(conqueror), value: conqueror };
    updateUrl();
  };

  let collapsed = false;

  const platforms = [
    {
      value: 'TW',
      label: 'PC 台服'
    },
    {
      value: 'PC',
      label: 'PC 國際服'
    },
    {
      value: 'Xbox',
      label: 'Xbox'
    },
    {
      value: 'Playstation',
      label: 'Playstation'
    }
  ];

  let platform = platforms.find((p) => p.value === localStorage.getItem('platform')) || platforms[0];
  $: localStorage.setItem('platform', platform.value);

  const TradersModes = {
    legacy: {
      value: 'legacy',
      label: '只看在線賣家'
    },
    modern: {
      value: 'modern',
      label: '全部賣家'
    }
  };

  let isLegacyTradersMode = localStorage.getItem('tradersMode') === TradersModes.legacy.value || false;
  $: localStorage.setItem('tradersMode', isLegacyTradersMode ? TradersModes.legacy.value : TradersModes.modern.value);

  let leagues: { value: string; label: string }[] = [];
  let league: { value: string; label: string } | undefined;

  // 台服有自己的交易站與聯盟名稱，poe.watch 只收國際服，所以分開處理。
  const twLeagues = TW_LEAGUES.map((l) => ({ value: l, label: l }));
  let globalLeagues: { value: string; label: string }[] = [];

  const pickLeague = () => {
    leagues = isTaiwan(platform.value) ? twLeagues : globalLeagues;
    const stored = localStorage.getItem(isTaiwan(platform.value) ? 'league_tw' : 'league');
    league = leagues.find((l) => l.value === stored) || leagues[0];
  };

  const getLeagues = async () => {
    try {
      const response = await fetch('https://api.poe.watch/leagues');
      const responseJson = await response.json();
      globalLeagues = responseJson.map((l: { name: string }) => ({ value: l.name, label: l.name }));
    } catch (e) {
      console.warn('failed to fetch global leagues', e);
      globalLeagues = [{ value: 'Standard', label: 'Standard' }];
    }
    pickLeague();
  };

  const changePlatform = () => {
    pickLeague();
    updateUrl();
  };

  $: league && localStorage.setItem(isTaiwan(platform.value) ? 'league_tw' : 'league', league.value);

  // A trade link holds a limited number of seeds, so a large result set is
  // spread over several links rather than being truncated.
  let showTradeLinks = false;
  let tradeQueries: TradeQuery[] = [];
  $: tradeQueries =
    searchResults && searchResults.raw.length
      ? constructQueries(searchJewel, searchConqueror, searchResults.raw, isLegacyTradersMode, platform.value)
      : [];

  // 符合條件的種子號碼清單：可整包複製，貼進自己的交易搜尋器用
  $: seedList = searchResults ? searchResults.raw.map((r) => r.seed) : [];

  // 同站的交易搜尋器（static/jewel-search.html）：把結果整包帶過去，
  // 那邊會自動分批＋加冷卻鎖，適合號碼多的時候慢慢開。
  const SEARCHER_JEWEL_KEYS: Record<number, string> = {
    1: 'glorious_vanity',
    2: 'lethal_pride',
    3: 'brutal_restraint',
    4: 'militant_faith',
    5: 'elegant_hubris'
  };
  $: searcherSupported = !!SEARCHER_JEWEL_KEYS[searchJewel];

  const searcherHash = (): string => {
    const jewelKey = SEARCHER_JEWEL_KEYS[searchJewel];
    if (!jewelKey) return '';
    const params = new URLSearchParams({
      seeds: [...seedList].sort((a, b) => a - b).join(','),
      name: searchConqueror ? `name:${searchConqueror.toLowerCase()}` : `jewel:${jewelKey}`,
      league: league?.value ?? '',
      status: isTaiwan(platform.value) ? 'available' : 'online'
    });
    return `${base}/jewel-search.html#${params.toString()}`;
  };

  // 直接在這一頁開，網址不用換；想要獨立分頁再按面板右上角那顆。
  let showSearcher = false;
  let searcherSrc = '';
  const toggleSearcher = () => {
    if (showSearcher) {
      showSearcher = false;
      return;
    }
    const url = searcherHash();
    if (!url) return;
    searcherSrc = url;
    showSearcher = true;
  };
  let showSeedList = false;
  let copyLabel = '複製全部';
  const copySeeds = async () => {
    try {
      await navigator.clipboard.writeText(seedList.join('\n'));
      copyLabel = '已複製 ✓';
    } catch (e) {
      console.warn('clipboard failed', e);
      copyLabel = '複製失敗';
    }
    setTimeout(() => (copyLabel = '複製全部'), 1500);
  };

  $: tradeBatchSize = seedsPerQuery(searchJewel, searchConqueror);
  $: tradeBatchSizes = tradeQueries.map((_, i) =>
    Math.min(tradeBatchSize, searchResults.raw.length - i * tradeBatchSize)
  );

  $: if (tradeQueries.length < 2) {
    showTradeLinks = false;
  }

  onMount(() => {
    getLeagues();
  });
</script>

<svelte:window on:paste={onPaste} />

<SkillTree
  {clickNode}
  {circledNode}
  selectedJewel={selectedJewel?.value}
  selectedConqueror={isAnyConqueror ? undefined : selectedConqueror?.value}
  {highlighted}
  {seed}
  highlightJewels={!circledNode}
  disabled={[...disabled]}>
  {#if !collapsed}
    <div
      class="w-screen md:w-10/12 lg:w-2/3 xl:w-1/2 2xl:w-5/12 3xl:w-1/3 4xl:w-1/4 md:min-w-[820px] absolute top-0 left-0 bg-black/80 backdrop-blur-sm themed rounded-br-lg max-h-[70vh] md:max-h-screen">
      <div class="p-4 max-h-screen flex flex-col">
        <div class="flex flex-row flex-wrap gap-2 justify-between mb-2">
          <div class="flex flex-row items-center">
            <button class="burger-menu mr-3" on:click={() => (collapsed = true)}>
              <div />
              <div />
              <div />
            </button>

            <h3 class="flex-grow">
              {#if results}
                <span>搜尋結果</span>
              {:else}
                <span>永恆珠寶</span>
              {/if}
            </h3>
          </div>
          {#if searchResults}
            <div class="flex flex-row flex-wrap gap-2 items-center">
              {#if results}
                <Select floatingConfig={{ strategy: 'fixed' }} items={leagues} bind:value={league} on:change={updateUrl} clearable={false} />
                <Select floatingConfig={{ strategy: 'fixed' }} items={platforms} bind:value={platform} on:change={changePlatform} clearable={false} />
                <button
                  class="p-1 px-3 bg-blue-500/40 rounded disabled:bg-blue-900/40 whitespace-nowrap"
                  on:click={() =>
                    tradeQueries.length > 1
                      ? (showTradeLinks = !showTradeLinks)
                      : openQuery(tradeQueries[0], platform.value, league.value)}
                  disabled={tradeQueries.length === 0}>
                  {#if tradeQueries.length > 1}
                    交易 ({tradeQueries.length}) {showTradeLinks ? '^' : 'V'}
                  {:else}
                    交易
                  {/if}
                </button>
                <button
                  class="p-1 px-3 bg-emerald-600/50 rounded disabled:bg-emerald-900/40 whitespace-nowrap"
                  on:click={() => (showSeedList = !showSeedList)}
                  disabled={seedList.length === 0}>
                  號碼 ({seedList.length}) {showSeedList ? '^' : 'V'}
                </button>
                <button
                  class="p-1 px-3 bg-amber-600/50 rounded disabled:bg-amber-900/40 whitespace-nowrap"
                  title="在這一頁開交易搜尋器（自動分批＋冷卻鎖，避免被限速）"
                  on:click={toggleSearcher}
                  disabled={seedList.length === 0 || !searcherSupported}>
                  交易搜尋器 {showSearcher ? '✕' : ''}
                </button>
                <button
                  class="p-1 px-3 bg-blue-500/40 rounded disabled:bg-blue-900/40"
                  class:grouped={groupResults}
                  on:click={() => (groupResults = !groupResults)}
                  disabled={!searchResults}>
                  分組
                </button>
                <button
                  class="p-1 px-3 bg-blue-500/40 rounded disabled:bg-blue-900/40 whitespace-nowrap"
                  on:click={() => (isLegacyTradersMode = !isLegacyTradersMode)}
                  disabled={!searchResults}>
                  {isLegacyTradersMode ? TradersModes.legacy.label : TradersModes.modern.label}
                </button>
              {/if}
              <button class="bg-neutral-100/20 px-4 p-1 rounded" on:click={() => (results = !results)}>
                {results ? '設定' : '結果'}
              </button>
            </div>
          {/if}
        </div>

        {#if !results}
          <Select floatingConfig={{ strategy: 'fixed' }} items={jewels} bind:value={selectedJewel} on:change={changeJewel} />

          {#if selectedJewel}
            <div class="mt-4">
              <h3 class="mb-2">人名（征服者）</h3>
              <Select floatingConfig={{ strategy: 'fixed' }} items={conquerorItems} bind:value={selectedConqueror} on:change={updateUrl} />
              {#if isAnyConqueror}
                <div class="mt-2 text-sm text-neutral-400">
                  搜尋會排除鑰石天賦——那是唯一會因人名而不同的天賦。交易連結會同時比對所有人名。
                </div>
              {/if}
            </div>

            {#if selectedConqueror && (isAnyConqueror || Object.keys(data.TimelessJewelConquerors[selectedJewel.value]).indexOf(selectedConqueror.value) >= 0)}
              <div class="mt-4 w-full flex flex-row">
                <button
                  class="selection-button"
                  class:selected={mode === 'seed'}
                  on:click={() => setMode('seed')}
                  disabled={isAnyConqueror}>
                  直接輸入種子
                </button>
                <button class="selection-button" class:selected={mode === 'stats'} on:click={() => setMode('stats')}>
                  依詞綴搜尋
                </button>
              </div>

              {#if mode === 'seed'}
                <div class="mt-4">
                  <h3 class="mb-2">種子號碼</h3>
                  <input
                    type="number"
                    bind:value={seed}
                    on:blur={updateUrl}
                    min={data.TimelessJewelSeedRanges[selectedJewel.value].Min}
                    max={data.TimelessJewelSeedRanges[selectedJewel.value].Max} />
                  {#if seed < data.TimelessJewelSeedRanges[selectedJewel.value].Min || seed > data.TimelessJewelSeedRanges[selectedJewel.value].Max}
                    <div class="mt-2">
                      種子號碼必須介於 {data.TimelessJewelSeedRanges[selectedJewel.value].Min}
                      到 {data.TimelessJewelSeedRanges[selectedJewel.value].Max} 之間
                    </div>
                  {/if}
                </div>

                {#if seed >= data.TimelessJewelSeedRanges[selectedJewel.value].Min && seed <= data.TimelessJewelSeedRanges[selectedJewel.value].Max}
                  <div class="flex flex-row mt-4 items-end">
                    <div class="flex-grow">
                      <h3 class="mb-2">排序方式</h3>
                      <Select floatingConfig={{ strategy: 'fixed' }} items={sortResults} bind:value={sortOrder} />
                    </div>
                    <div class="ml-2">
                      <button
                        class="bg-neutral-500/20 p-2 px-4 rounded"
                        class:selected={colored}
                        on:click={() => (colored = !colored)}>
                        顏色
                      </button>
                    </div>
                    <div class="ml-2">
                      <button
                        class="bg-neutral-500/20 p-2 px-4 rounded"
                        class:selected={split}
                        on:click={() => (split = !split)}>
                        分開顯示
                      </button>
                    </div>
                  </div>

                  {#if !split}
                    <ul class="mt-4 overflow-auto" class:rainbow={colored}>
                      {#each sortCombined(combineResults(seedResults, colored, 'all'), sortOrder.value) as r}
                        <li>
                          <button
                            type="button"
                            class="cursor-pointer text-left w-full"
                            on:click={() => highlight(seed, r.passives)}>
                            <span class="font-bold" class:text-white={(statValues[r.id] || 0) < 3}
                              >({r.passives.length})</span>
                            <span class="text-white">{@html r.stat}</span>
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <div class="overflow-auto mt-4">
                      <h3>核心天賦</h3>
                      <ul class="mt-1" class:rainbow={colored}>
                        {#each sortCombined(combineResults(seedResults, colored, 'notables'), sortOrder.value) as r}
                          <li>
                            <button
                              type="button"
                              class="cursor-pointer text-left w-full"
                              on:click={() => highlight(seed, r.passives)}>
                              <span class="font-bold" class:text-white={(statValues[r.id] || 0) < 3}
                                >({r.passives.length})</span>
                              <span class="text-white">{@html r.stat}</span>
                            </button>
                          </li>
                        {/each}
                      </ul>

                      <h3 class="mt-2">一般天賦</h3>
                      <ul class="mt-1" class:rainbow={colored}>
                        {#each sortCombined(combineResults(seedResults, colored, 'passives'), sortOrder.value) as r}
                          <li>
                            <button
                              type="button"
                              class="cursor-pointer text-left w-full"
                              on:click={() => highlight(seed, r.passives)}>
                              <span class="font-bold" class:text-white={(statValues[r.id] || 0) < 3}
                                >({r.passives.length})</span>
                              <span class="text-white">{@html r.stat}</span>
                            </button>
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                {/if}
              {:else if mode === 'stats'}
                <div class="mt-4">
                  <h3 class="mb-2">加入詞綴條件</h3>
                  <Select floatingConfig={{ strategy: 'fixed' }} items={statItems} on:change={selectStat} bind:this={statSelector} />
                </div>
                {#if Object.keys(selectedStats).length > 0}
                  <div class="mt-4 flex flex-col overflow-auto min-h-[100px]">
                    {#each Object.keys(selectedStats) as s}
                      <div class="mb-4 flex flex-row items-start flex-col border-neutral-100/40 border-b pb-4">
                        <div>
                          <button
                            class="p-2 px-4 bg-red-500/40 rounded mr-2"
                            on:click={() => removeStat(selectedStats[s].id)}>
                            -
                          </button>
                          <span>{translateStat(selectedStats[s].id)}</span>
                        </div>
                        <div class="mt-2 flex flex-row">
                          <div class="mr-4 flex flex-row items-center">
                            <div class="mr-2">最低值：</div>
                            <input type="number" min="0" bind:value={selectedStats[s].min} />
                          </div>
                          <div class="flex flex-row items-center">
                            <div class="mr-2">權重：</div>
                            <input type="number" min="0" bind:value={selectedStats[s].weight} />
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                  <div class="flex flex-col mt-2">
                    <div class="flex flex-row items-center">
                      <div class="mr-2 min-w-fit">最低總權重：</div>
                      <input type="number" min="0" bind:value={minTotalWeight} />
                    </div>
                  </div>
                  <div class="flex flex-col mt-4">
                    <div class="flex flex-row">
                      <button
                        class="p-2 px-2 bg-yellow-500/40 rounded disabled:bg-yellow-900/40 mr-2"
                        on:click={selectAll}
                        disabled={searching || disabled.size == 0}>
                        全選
                      </button>
                      <button
                        class="p-2 px-2 bg-yellow-500/40 rounded disabled:bg-yellow-900/40 mr-2"
                        on:click={selectAllNotables}
                        disabled={searching || disabled.size == 0}>
                        只選核心
                      </button>
                      <button
                        class="p-2 px-2 bg-yellow-500/40 rounded disabled:bg-yellow-900/40 mr-2"
                        on:click={selectAllPassives}
                        disabled={searching || disabled.size == 0}>
                        只選一般
                      </button>
                      <button
                        class="p-2 px-2 bg-yellow-500/40 rounded disabled:bg-yellow-900/40 flex-grow"
                        on:click={deselectAll}
                        disabled={searching || disabled.size >= affectedNodes.length}>
                        全部取消
                      </button>
                    </div>
                    <div class="flex flex-row mt-2">
                      <button
                        class="p-2 px-3 bg-green-500/40 rounded disabled:bg-green-900/40 flex-grow"
                        on:click={() => search()}
                        disabled={searching}>
                        {#if searching}
                          {currentSeed} / {data.TimelessJewelSeedRanges[selectedJewel.value].Max}
                        {:else}
                          開始搜尋
                        {/if}
                      </button>
                    </div>
                  </div>
                {/if}
              {/if}

              {#if !circledNode}
                <h2 class="mt-4">請先在天賦樹上點一個珠寶插槽</h2>
              {/if}
            {/if}
          {/if}
        {/if}

        {#if searchResults && results}
          {#if showSeedList}
            <!-- 符合條件的所有種子號碼，整包複製後可貼進自己的交易搜尋器 -->
            <div class="my-2 shrink-0 border border-emerald-500/40 rounded p-2">
              <div class="flex flex-row justify-between items-center mb-2">
                <span class="text-sm text-neutral-300">符合條件的號碼（{seedList.length} 組，由小到大）</span>
                <button class="p-1 px-3 bg-emerald-600/50 rounded text-sm" on:click={copySeeds}>{copyLabel}</button>
              </div>
              <textarea
                class="w-full h-28 bg-black/40 rounded p-2 font-mono text-sm"
                readonly
                on:focus={(e) => e.currentTarget.select()}
                value={[...seedList].sort((a, b) => a - b).join('\n')} />
            </div>
          {/if}
          {#if showTradeLinks}
            <!-- A loose search can produce hundreds of batches; keep them from
                 pushing the results list off screen. -->
            <div class="flex flex-wrap gap-2 my-2 max-h-40 overflow-y-auto shrink-0">
              {#each tradeQueries as query, i}
                <button
                  class="p-1 px-3 bg-blue-500/40 rounded"
                  on:click={() => openQuery(query, platform.value, league.value)}>
                  第 {i + 1} 批（{tradeBatchSizes[i]} 個）
                </button>
              {/each}
            </div>
          {/if}
          <SearchResults
            {searchResults}
            {groupResults}
            {highlight}
            jewel={searchJewel}
            conqueror={searchConqueror}
            platform={platform.value}
            league={league.value}
            {isLegacyTradersMode} />
        {/if}
      </div>
    </div>
  {:else}
    <button
      class="burger-menu absolute top-0 left-0 bg-black/80 backdrop-blur-sm rounded-br-lg p-4 pt-5"
      on:click={() => (collapsed = false)}>
      <div />
      <div />
      <div />
    </button>
  {/if}

  {#if showSearcher}
    <!-- 交易搜尋器就開在這一頁：同站 iframe，網址不用換 -->
    <div class="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm p-4 md:p-8">
      <div class="flex flex-row justify-between items-center mb-2 text-sm">
        <span class="text-amber-300">交易搜尋器　·　已帶入 {seedList.length} 組號碼</span>
        <div class="flex flex-row gap-2">
          <a
            class="p-1 px-3 bg-neutral-100/20 rounded"
            href={searcherSrc}
            target="_blank"
            rel="noopener">另開分頁</a>
          <button class="p-1 px-3 bg-neutral-100/20 rounded" on:click={() => (showSearcher = false)}>關閉</button>
        </div>
      </div>
      <iframe
        class="flex-grow w-full rounded border border-amber-700/50 bg-[#0d0d10]"
        title="交易搜尋器"
        src={searcherSrc} />
    </div>
  {/if}

  <div class="text-orange-500 absolute bottom-0 right-0 m-2">
    <a href="https://github.com/Vilsol/timeless-jewels" target="_blank" rel="noopener">Source (Github)</a>
  </div>
</SkillTree>

<style lang="postcss">
  .selection-button {
    @apply bg-neutral-500/20 p-2 px-4 flex-grow;
  }

  .selection-button:first-child {
    @apply rounded-l border-r-2 border-black;
  }

  .selection-button:last-child {
    @apply rounded-r;
  }

  .selected {
    @apply bg-neutral-100/20;
  }

  .grouped {
    @apply bg-pink-500/40 disabled:bg-pink-900/40;
  }

  .rainbow {
    animation: colorRotate 2s linear 0s infinite;
  }

  @keyframes colorRotate {
    from {
      color: hsl(0, 100%, 50%);
    }
    25% {
      color: hsl(90, 100%, 50%);
    }
    50% {
      color: hsl(180, 100%, 50%);
    }
    75% {
      color: hsl(270, 100%, 50%);
    }
    100% {
      color: hsl(359, 100%, 50%);
    }
  }
</style>
