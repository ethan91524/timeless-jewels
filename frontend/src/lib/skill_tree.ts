import type { Translation, Node, SkillTreeData, Group, Sprite, TranslationFile } from './skill_tree_types';
import { data } from './types';
import { localizeTree, statZh } from './tree_zh';

export let skillTree: SkillTreeData;

export const drawnGroups: Record<number, Group> = {};
export const drawnNodes: Record<number, Node> = {};

export const inverseSprites: Record<string, Sprite> = {};
export const inverseSpritesActive: Record<string, Sprite> = {};

export const inverseTranslations: Record<string, Translation> = {};

export const passiveToTree: Record<number, number> = {};

export const loadSkillTree = () => {
  skillTree = JSON.parse(data.SkillTree);
  // 換成台服官方的中文名稱與詞綴（節點 id 兩邊相同，見 tree_zh.ts）
  localizeTree(skillTree);
  console.log('Loaded skill tree', skillTree);

  Object.keys(skillTree.groups).forEach((groupId) => {
    const group = skillTree.groups[groupId];
    group.nodes.forEach((nodeId) => {
      const node = skillTree.nodes[nodeId];

      // Do not care about proxy passives
      if (node.isProxy) {
        return;
      }

      // Do not care about class starting nodes
      if ('classStartIndex' in node) {
        return;
      }

      // Do not care about cluster jewels
      if (node.expansionJewel) {
        if (node.expansionJewel.parent) {
          return;
        }
      }

      // Do not care about blighted nodes
      if (node.isBlighted) {
        return;
      }

      // Do not care about ascendancies
      if (node.ascendancyName) {
        return;
      }

      drawnGroups[parseInt(groupId)] = group;
      drawnNodes[parseInt(nodeId)] = node;
    });
  });

  Object.keys(skillTree.sprites.keystoneInactive['0.3835'].coords).forEach(
    (c) => (inverseSprites[c] = skillTree.sprites.keystoneInactive['0.3835'])
  );
  Object.keys(skillTree.sprites.notableInactive['0.3835'].coords).forEach(
    (c) => (inverseSprites[c] = skillTree.sprites.notableInactive['0.3835'])
  );
  Object.keys(skillTree.sprites.normalInactive['0.3835'].coords).forEach(
    (c) => (inverseSprites[c] = skillTree.sprites.normalInactive['0.3835'])
  );
  Object.keys(skillTree.sprites.masteryInactive['0.3835'].coords).forEach(
    (c) => (inverseSprites[c] = skillTree.sprites.masteryInactive['0.3835'])
  );

  Object.keys(skillTree.sprites.keystoneActive['0.3835'].coords).forEach(
    (c) => (inverseSpritesActive[c] = skillTree.sprites.keystoneActive['0.3835'])
  );
  Object.keys(skillTree.sprites.notableActive['0.3835'].coords).forEach(
    (c) => (inverseSpritesActive[c] = skillTree.sprites.notableActive['0.3835'])
  );
  Object.keys(skillTree.sprites.normalActive['0.3835'].coords).forEach(
    (c) => (inverseSpritesActive[c] = skillTree.sprites.normalActive['0.3835'])
  );
  Object.keys(skillTree.sprites.masteryInactive['0.3835'].coords).forEach(
    (c) => (inverseSpritesActive[c] = skillTree.sprites.masteryInactive['0.3835'])
  );

  Object.keys(skillTree.sprites.groupBackground['0.3835'].coords).forEach(
    (c) => (inverseSprites[c] = skillTree.sprites.groupBackground['0.3835'])
  );
  Object.keys(skillTree.sprites.frame['0.3835'].coords).forEach(
    (c) => (inverseSprites[c] = skillTree.sprites.frame['0.3835'])
  );

  const translationFiles = [
    data.StatTranslationsJSON,
    data.PassiveSkillStatTranslationsJSON,
    data.PassiveSkillAuraStatTranslationsJSON
  ];

  translationFiles.forEach((f) => {
    const translations: TranslationFile = JSON.parse(f);

    translations.descriptors.forEach((t) => {
      t.ids.forEach((id) => {
        if (!(id in inverseTranslations)) {
          inverseTranslations[id] = t;
        }
      });
    });
  });

  Object.keys(data.TreeToPassive).forEach((k) => {
    passiveToTree[data.TreeToPassive[parseInt(k)].Index] = parseInt(k);
  });
};

const indexHandlers: Record<string, number> = {
  negate: -1,
  times_twenty: 1 / 20,
  canonical_stat: 1,
  per_minute_to_per_second: 60,
  milliseconds_to_seconds: 1000,
  display_indexable_support: 1,
  divide_by_one_hundred: 100,
  milliseconds_to_seconds_2dp_if_required: 1000,
  deciseconds_to_seconds: 10,
  old_leech_percent: 1,
  old_leech_permyriad: 10000,
  times_one_point_five: 1 / 1.5,
  '30%_of_value': 100 / 30,
  divide_by_one_thousand: 1000,
  divide_by_twelve: 12,
  divide_by_six: 6,
  per_minute_to_per_second_2dp_if_required: 60,
  '60%_of_value': 100 / 60,
  double: 1 / 2,
  negate_and_double: 1 / -2,
  multiply_by_four: 1 / 4,
  per_minute_to_per_second_0dp: 60,
  milliseconds_to_seconds_0dp: 1000,
  mod_value_to_item_class: 1,
  milliseconds_to_seconds_2dp: 1000,
  multiplicative_damage_modifier: 1,
  divide_by_one_hundred_2dp: 100,
  per_minute_to_per_second_1dp: 60,
  divide_by_one_hundred_2dp_if_required: 100,
  divide_by_ten_1dp_if_required: 10,
  milliseconds_to_seconds_1dp: 1000,
  divide_by_fifty: 50,
  per_minute_to_per_second_2dp: 60,
  divide_by_ten_0dp: 10,
  divide_by_one_hundred_and_negate: -100,
  tree_expansion_jewel_passive: 1,
  passive_hash: 1,
  divide_by_ten_1dp: 10,
  affliction_reward_type: 1,
  divide_by_five: 5,
  metamorphosis_reward_description: 1,
  divide_by_two_0dp: 2,
  divide_by_fifteen_0dp: 15,
  divide_by_three: 3,
  divide_by_twenty_then_double_0dp: 10,
  divide_by_four: 4
};

export type Point = {
  x: number;
  y: number;
};

export const toCanvasCoords = (x: number, y: number, offsetX: number, offsetY: number, scaling: number): Point => ({
  x: (Math.abs(skillTree.min_x) + x + offsetX) / scaling,
  y: (Math.abs(skillTree.min_y) + y + offsetY) / scaling
});

export const rotateAroundPoint = (center: Point, target: Point, angle: number): Point => {
  const radians = (Math.PI / 180) * angle;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const nx = cos * (target.x - center.x) + sin * (target.y - center.y) + center.x;
  const ny = cos * (target.y - center.y) - sin * (target.x - center.x) + center.y;
  return {
    x: nx,
    y: ny
  };
};

export const orbit16Angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export const orbit40Angles = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190, 200, 210, 220, 225,
  230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350
];

export const orbitAngleAt = (orbit: number, index: number): number => {
  const nodesInOrbit = skillTree.constants.skillsPerOrbit[orbit];
  if (nodesInOrbit == 16) {
    return orbit16Angles[orbit16Angles.length - index] || 0;
  } else if (nodesInOrbit == 40) {
    return orbit40Angles[orbit40Angles.length - index] || 0;
  } else {
    return 360 - (360 / nodesInOrbit) * index;
  }
};

export const calculateNodePos = (node: Node, offsetX: number, offsetY: number, scaling: number): Point => {
  if (node.group === undefined || node.orbit === undefined || node.orbitIndex === undefined) {
    return { x: 0, y: 0 };
  }

  const targetGroup = skillTree.groups[node.group];
  const targetAngle = orbitAngleAt(node.orbit, node.orbitIndex);

  const targetGroupPos = toCanvasCoords(targetGroup.x, targetGroup.y, offsetX, offsetY, scaling);
  const targetNodePos = toCanvasCoords(
    targetGroup.x,
    targetGroup.y - skillTree.constants.orbitRadii[node.orbit],
    offsetX,
    offsetY,
    scaling
  );
  return rotateAroundPoint(targetGroupPos, targetNodePos, targetAngle);
};

export const distance = (p1: Point, p2: Point): number =>
  Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

export const formatStats = (translation: Translation, stat: number): string | undefined => {
  let selectedTranslation = -1;

  for (let i = 0; i < translation.list.length; i++) {
    const t = translation.list[i];

    let matches = true;
    if (t.conditions?.length > 0) {
      const first = t.conditions[0];
      if (first.min !== undefined) {
        if (stat < first.min) {
          matches = false;
        }
      }

      if (first.max !== undefined) {
        if (stat > first.max) {
          matches = false;
        }
      }

      if (first.negated) {
        matches = !matches;
      }
    }

    if (matches) {
      selectedTranslation = i;
      break;
    }
  }

  if (selectedTranslation == -1) {
    return undefined;
  }

  const datum = translation.list[selectedTranslation];

  let finalStat = stat;

  if (datum.index_handlers !== undefined) {
    if (Array.isArray(datum.index_handlers)) {
      if (datum.index_handlers?.length > 0) {
        datum.index_handlers[0].forEach((handler) => {
          finalStat = finalStat / (indexHandlers[handler] || 1);
        });
      }
    } else {
      Object.keys(datum.index_handlers).forEach((handler) => {
        finalStat = finalStat / (indexHandlers[handler] || 1);
      });
    }
  }

  return datum.string
    .replace(/\{0(?::(.*?)d(.*?))\}/, '$1' + finalStat.toString() + '$2')
    .replace(`{0}`, parseFloat(finalStat.toFixed(2)).toString());
};

export const baseJewelRadius = 1800;

/**
 * 獨特珠寶的作用範圍。
 *
 * 數值取自 Path of Building 的 data.jewelRadii["3_16"]；交叉驗證：該表的
 * Large = 1800，正好等於上面軍團珠寶用的 baseJewelRadius，代表同一套座標系。
 * 「逃脫不能」是小範圍（960）；「希望之弦」是環狀，四種大小各有內外半徑。
 */
export const IMPOSSIBLE_ESCAPE_RADIUS = 960;

export interface RingSize {
  value: number;
  label: string;
  inner: number;
  outer: number;
}

export const THREAD_OF_HOPE_SIZES: RingSize[] = [
  { value: 1, label: '小', inner: 960, outer: 1320 },
  { value: 2, label: '中', inner: 1320, outer: 1680 },
  { value: 3, label: '大', inner: 1680, outer: 2040 },
  { value: 4, label: '非常大', inner: 2040, outer: 2400 },
  { value: 5, label: '極大', inner: 2400, outer: 2880 }
];

/** 畫在天賦樹上的額外範圍圈 */
export interface ExtraRing {
  node: number;
  inner: number;
  outer: number;
  color: string;
  label: string;
}

export const getAffectedNodes = (socket: Node): Node[] => {
  const result: Node[] = [];

  const socketPos = calculateNodePos(socket, 0, 0, 1);
  for (const node of Object.values(drawnNodes)) {
    const nodePos = calculateNodePos(node, 0, 0, 1);

    if (distance(nodePos, socketPos) < baseJewelRadius) {
      result.push(node);
    }
  }

  return result;
};

/**
 * 落在某個環狀範圍內的天賦（希望之弦是環狀、逃脫不能 inner = 0 就是實心圓）。
 *
 * candidates 一定要先傳「珠寶半徑內、而且沒被排除」的天賦：軍團珠寶只會改造自己
 * 半徑內的天賦，環圈掃到珠寶範圍外的天賦沒有詞綴可比，算進去只會虛胖。
 * 圓心本身不算（逃脫不能給的是半徑內的天賦，不含那顆鑰石）。
 */
export const nodesWithinRing = (
  centerNode: number,
  inner: number,
  outer: number,
  candidates: Node[]
): number[] => {
  const center = drawnNodes[centerNode];
  if (!center) {
    return [];
  }

  const centerPos = calculateNodePos(center, 0, 0, 1);
  return candidates
    .filter((n) => {
      const d = distance(calculateNodePos(n, 0, 0, 1), centerPos);
      return d > inner && d < outer;
    })
    .map((n) => n.skill);
};

/**
 * 一個「範圍層」。分層篩選就是同時對好幾層各設一組門檻，例如
 * 「珠寶範圍內至少 6 點生命，但希望之弦環內要有 3 點」。
 *
 * nodes 省略＝這一層就是整個珠寶範圍（所有被搜尋的天賦）。
 * 其餘層的 nodes 由呼叫端先跟珠寶範圍、已排除的天賦取好交集。
 */
export interface SearchScope {
  key: string;
  label: string;
  color: string;
  /** 天賦樹節點 id；undefined = 珠寶範圍內全部 */
  nodes?: number[];
  /** statId -> 這層至少要有幾個天賦帶這條詞綴（0 或缺席＝不限） */
  mins: Record<number, number>;
  /** 這層的加權總分下限（0＝不限） */
  minTotalWeight: number;
}

export interface ScopeTally {
  /** scopeKey -> statId -> 這層有幾個天賦帶這條詞綴 */
  counts: Record<string, Record<number, number>>;
  /** scopeKey -> 這層的加權總分 */
  weights: Record<string, number>;
  /** scopeKey -> 這層命中幾個天賦 */
  skillCounts: Record<string, number>;
  /** 每一層的門檻都過了才算數 */
  passed: boolean;
}

/**
 * 把一顆種子的結果分層統計，並判斷是否全部門檻都過。
 *
 * 這裡刻意寫成純函式（不碰 WASM、不碰 DOM），分層規則才能單獨用測試釘住。
 */
export const evaluateScopes = (
  skills: { passive: number; stats: Record<string | number, number> }[],
  scopes: SearchScope[],
  weightOf: (statId: number) => number
): ScopeTally => {
  const counts: Record<string, Record<number, number>> = {};
  const weights: Record<string, number> = {};
  const skillCounts: Record<string, number> = {};

  const members = scopes.map((s) => (s.nodes ? new Set(s.nodes) : undefined));
  scopes.forEach((s) => {
    counts[s.key] = {};
    weights[s.key] = 0;
    skillCounts[s.key] = 0;
  });

  skills.forEach((skill) => {
    const statIds = Object.keys(skill.stats).map((k) => parseInt(k));
    scopes.forEach((scope, i) => {
      const member = members[i];
      if (member && !member.has(skill.passive)) {
        return;
      }

      skillCounts[scope.key]++;
      statIds.forEach((statId) => {
        counts[scope.key][statId] = (counts[scope.key][statId] || 0) + 1;
        weights[scope.key] += weightOf(statId);
      });
    });
  });

  const passed = scopes.every((scope) => {
    if (weights[scope.key] < scope.minTotalWeight) {
      return false;
    }

    return Object.keys(scope.mins).every((statId) => {
      const min = scope.mins[statId];
      return !min || (counts[scope.key][statId] || 0) >= min;
    });
  });

  return { counts, weights, skillCounts, passed };
};

type Stat = { Index: number; ID: string; Text: string };

const statCache: Record<number, Stat> = {};
export const getStat = (id: number | string): Stat => {
  const nId = typeof id === 'string' ? parseInt(id) : id;
  if (!(nId in statCache)) {
    statCache[nId] = data.GetStatByIndex(nId);
  }
  return statCache[nId];
};

export interface StatConfig {
  /** 珠寶範圍（第一層）的門檻，沿用原欄位名 */
  min: number;
  id: number;
  weight: number;
  /** 其餘範圍層的門檻：scopeKey -> 至少幾點 */
  scopeMins?: Record<string, number>;
}

export interface ReverseSearchConfig {
  jewel: number;
  conqueror: string;
  nodes: number[];
  stats: StatConfig[];
  minTotalWeight: number;
  /** 分層篩選；沒帶就等於只有「珠寶範圍」一層（＝舊行為） */
  scopes?: SearchScope[];
  /** 結果要用哪一層的加權總分排序，預設第一層 */
  sortScope?: string;
}

export interface SearchWithSeed {
  seed: number;
  /** 第一層（珠寶範圍）的加權總分，維持舊欄位語意 */
  weight: number;
  statCounts: Record<number, number>;
  scopeWeights?: Record<string, number>;
  scopeCounts?: Record<string, Record<number, number>>;
  scopeSkillCounts?: Record<string, number>;
  skills: {
    passive: number;
    stats: { [key: string]: number };
  }[];
}

export interface SearchResults {
  grouped: { [key: number]: SearchWithSeed[] };
  raw: SearchWithSeed[];
}

export const translateStat = (id: number, roll?: number | undefined): string => {
  const stat = getStat(id);
  const translation = inverseTranslations[stat.ID];
  if (roll) {
    return statZh(formatStats(translation, roll) || stat.ID);
  }

  let translationText = stat.Text || stat.ID;
  if (translation && translation.list && translation.list.length) {
    translationText = translation.list[0].string;
    translationText = translationText.replace(/\{\d(?::(.*?)d(.*?))\}/, '$1#$2').replace(/\{\d\}/, '#');
  }
  return statZh(translationText);
};

export {
  constructQuery,
  constructQueries,
  isTaiwan,
  openQuery,
  openTrade,
  seedsPerQuery,
  tradeStatNames,
  tradeUrl,
  TW_LEAGUES,
  TW_PLATFORM
} from './trade';
export type { TradeQuery } from './trade';
