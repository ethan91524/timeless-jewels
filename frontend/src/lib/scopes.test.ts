import { describe, expect, it } from 'vitest';
import { evaluateScopes } from './skill_tree';
import type { SearchScope } from './skill_tree';

// 詞綴 1 = 生命（權重 2）、詞綴 2 = 屬性（權重 1）
const weightOf = (id: number) => ({ 1: 2, 2: 1 })[id] ?? 0;

/** 天賦 101、102 在希望之弦環內；103、104 只在珠寶範圍內 */
const skills = [
  { passive: 101, stats: { 1: 5 } },
  { passive: 102, stats: { 1: 5, 2: 10 } },
  { passive: 103, stats: { 1: 5 } },
  { passive: 104, stats: { 2: 10 } }
];

const all = (mins: Record<number, number> = {}, minTotalWeight = 0): SearchScope => ({
  key: 'all',
  label: '珠寶範圍',
  color: '#60a5fa',
  mins,
  minTotalWeight
});

const hope = (mins: Record<number, number> = {}, minTotalWeight = 0): SearchScope => ({
  key: 'hope',
  label: '希望之弦',
  color: '#34d399',
  nodes: [101, 102],
  mins,
  minTotalWeight
});

describe('evaluateScopes — 單層（等同改版前的行為）', () => {
  it('把整個珠寶範圍的天賦都算進去', () => {
    const t = evaluateScopes(skills, [all()], weightOf);
    expect(t.skillCounts.all).toBe(4);
    expect(t.counts.all[1]).toBe(3);
    expect(t.counts.all[2]).toBe(2);
    // 生命 3 個 × 2 + 屬性 2 個 × 1
    expect(t.weights.all).toBe(8);
    expect(t.passed).toBe(true);
  });

  it('門檻沒到就擋下來', () => {
    expect(evaluateScopes(skills, [all({ 1: 4 })], weightOf).passed).toBe(false);
    expect(evaluateScopes(skills, [all({ 1: 3 })], weightOf).passed).toBe(true);
  });

  it('門檻 0 ＝不限', () => {
    expect(evaluateScopes(skills, [all({ 1: 0, 2: 0 })], weightOf).passed).toBe(true);
  });

  it('完全沒出現的詞綴也要被門檻擋下（不是當成 0 分通過）', () => {
    expect(evaluateScopes(skills, [all({ 3: 1 })], weightOf).passed).toBe(false);
  });

  it('加權總分下限', () => {
    expect(evaluateScopes(skills, [all({}, 8)], weightOf).passed).toBe(true);
    expect(evaluateScopes(skills, [all({}, 9)], weightOf).passed).toBe(false);
  });
});

describe('evaluateScopes — 分層', () => {
  it('子範圍只算範圍內的天賦', () => {
    const t = evaluateScopes(skills, [all(), hope()], weightOf);
    expect(t.skillCounts.all).toBe(4);
    expect(t.skillCounts.hope).toBe(2);
    expect(t.counts.hope[1]).toBe(2);
    expect(t.counts.hope[2]).toBe(1);
    // 生命 2 個 × 2 + 屬性 1 個 × 1
    expect(t.weights.hope).toBe(5);
  });

  it('「總區域 3 點、環內 3 點」——總區域過、環內不過，整顆種子就不算', () => {
    const t = evaluateScopes(skills, [all({ 1: 3 }), hope({ 1: 3 })], weightOf);
    expect(t.counts.all[1]).toBe(3);
    expect(t.passed).toBe(false);
  });

  it('「總區域 3 點、環內 2 點」兩層都過', () => {
    expect(evaluateScopes(skills, [all({ 1: 3 }), hope({ 1: 2 })], weightOf).passed).toBe(true);
  });

  it('每層各自算加權總分下限', () => {
    expect(evaluateScopes(skills, [all({}, 8), hope({}, 5)], weightOf).passed).toBe(true);
    expect(evaluateScopes(skills, [all({}, 8), hope({}, 6)], weightOf).passed).toBe(false);
  });

  it('同時落在兩個子範圍的天賦，兩邊都算一次', () => {
    const escape: SearchScope = {
      key: 'escape',
      label: '逃脫不能',
      color: '#f59e0b',
      nodes: [102, 103],
      mins: {},
      minTotalWeight: 0
    };
    const t = evaluateScopes(skills, [all(), hope(), escape], weightOf);
    expect(t.counts.hope[1]).toBe(2);
    expect(t.counts.escape[1]).toBe(2);
    expect(t.skillCounts.escape).toBe(2);
  });

  it('子範圍和珠寶範圍沒有交集時，該層一定不會通過非零門檻', () => {
    const orphan: SearchScope = {
      key: 'hope',
      label: '希望之弦',
      color: '#34d399',
      nodes: [999],
      mins: { 1: 1 },
      minTotalWeight: 0
    };
    const t = evaluateScopes(skills, [all(), orphan], weightOf);
    expect(t.skillCounts.hope).toBe(0);
    expect(t.passed).toBe(false);
  });
});
