/**
 * 天賦樹繁體中文對照。
 *
 * 資料由 build_tree_zh.py 產生：抓台服（pathofexile.tw）與國際服（pathofexile.com）
 * 兩份官方天賦樹，節點 id 相同，逐條對齊 stats 後把數字換成 # 做成模板。
 * 換版本時重跑那支腳本重新產生 tree_zh.json 即可。
 */
import treeZh from './tree_zh.json';

// 只把純數字換成 #（正負號留在模板裡），要和 build_tree_zh.py 的規則一致
const NUM = /\d+(?:\.\d+)?/g;
const SIGN = /[+-]#/g;

const names: Record<string, string> = treeZh.names;
const stats: Record<string, string> = treeZh.stats;

/** 節點中文名，查不到就用原本的英文。 */
export const nodeNameZh = (id: number | string, fallback = ''): string => names[String(id)] ?? fallback;

/**
 * 詞綴中文化：把數字抽掉比對模板，再把原本的數字依序填回中文模板。
 * 查不到對照就原樣回傳，不會弄丟資訊。
 */
export const statZh = (text: string): string => {
  if (!text) return text;
  const key = text.replace(NUM, '#').trim();
  const zh = stats[key] ?? stats[key.replace(SIGN, '#')];
  if (!zh) return text;
  const nums = text.match(NUM) ?? [];
  let i = 0;
  return zh.replace(/#/g, () => nums[i++] ?? '#');
};

/** 把整棵樹的節點名稱與詞綴就地換成中文（載入時呼叫一次）。 */
export const localizeTree = (tree: { nodes?: Record<string, { name?: string; stats?: string[] }> }): void => {
  const nodes = tree?.nodes;
  if (!nodes) return;
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    const zhName = names[id];
    if (zhName) node.name = zhName;
    if (node.stats?.length) node.stats = node.stats.map(statZh);
  }
};
