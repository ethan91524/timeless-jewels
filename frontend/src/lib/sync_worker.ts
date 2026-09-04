import { expose } from 'comlink';
import '../wasm_exec.js';
import { evaluateScopes, loadSkillTree, passiveToTree } from './skill_tree';
import type { SearchWithSeed, ReverseSearchConfig, SearchResults, SearchScope } from './skill_tree';
import { calculator, initializeCrystalline } from './types';

const obj = {
  boot(wasm: ArrayBuffer) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const go = new Go();
    WebAssembly.instantiate(wasm, go.importObject).then((result) => {
      go.run(result.instance);

      initializeCrystalline();

      loadSkillTree();
    });
  },
  async search(args: ReverseSearchConfig, callback: (seed: number) => Promise<void>): Promise<SearchResults> {
    const searchResult = await calculator.ReverseSearch(
      args.nodes,
      args.stats.map((s) => s.id),
      args.jewel,
      args.conqueror,
      callback
    );

    const statWeights: Record<number, number> = {};
    args.stats.forEach((s) => (statWeights[s.id] = s.weight || 0));
    const weightOf = (statId: number) => statWeights[statId] || 0;

    // 沒帶 scopes 的呼叫端（或還沒設額外範圍）＝只有「珠寶範圍」一層，行為與改版前相同。
    const scopes: SearchScope[] = args.scopes?.length
      ? args.scopes
      : [
          {
            key: 'all',
            label: '珠寶範圍',
            color: '#60a5fa',
            mins: Object.fromEntries(args.stats.map((s) => [s.id, s.min || 0])),
            minTotalWeight: args.minTotalWeight,
            minSum: 0
          }
        ];

    const primary = scopes[0].key;
    const sortKey = args.sortScope && scopes.some((s) => s.key === args.sortScope) ? args.sortScope : primary;
    const byScopeWeight = (a: SearchWithSeed, b: SearchWithSeed) =>
      (b.scopeWeights?.[sortKey] ?? b.weight) - (a.scopeWeights?.[sortKey] ?? a.weight);

    const searchGrouped: { [key: number]: SearchWithSeed[] } = {};
    Object.keys(searchResult).forEach((seedStr) => {
      const seed = parseInt(seedStr);

      const skills = Object.keys(searchResult[seed]).map((skillIDStr) => {
        const skillID = parseInt(skillIDStr);
        return {
          passive: passiveToTree[skillID],
          stats: searchResult[seed][skillID]
        };
      });

      const tally = evaluateScopes(skills, scopes, weightOf);
      if (!tally.passed) {
        return;
      }

      // 分組維持用第一層（珠寶範圍）命中的天賦數，跟改版前的「符合 N 項」一致。
      const len = tally.skillCounts[primary];
      searchGrouped[len] = [
        ...(searchGrouped[len] || []),
        {
          skills,
          seed,
          weight: tally.weights[primary],
          statCounts: tally.counts[primary],
          scopeSums: tally.sums,
          scopeWeights: tally.weights,
          scopeCounts: tally.counts,
          scopeSkillCounts: tally.skillCounts
        }
      ];
    });

    Object.keys(searchGrouped).forEach((len) => {
      const nLen = parseInt(len);
      searchGrouped[nLen] = searchGrouped[nLen].sort(byScopeWeight);
    });

    return {
      grouped: searchGrouped,
      raw: Object.keys(searchGrouped)
        .map((x) => searchGrouped[parseInt(x)])
        .flat()
        .sort(byScopeWeight)
    };
  }
} as const;

expose(obj);

export type WorkerType = typeof obj;
