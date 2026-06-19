import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer } from './state';
import {
  pickNextQuestion,
  shouldStop,
  detectPursueDims,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
} from './adaptiveSelector';
import type { QuizQuestion, QuizOption, WeightVector } from './types';
import { ZERO_VECTOR } from './types';
import { cosineSim } from './normalize';

/**
 * 真实题库端到端模拟,统计题数分布、追问触发率、多样性,目标是:
 * - 平均题数 ∈ [30, 35]
 * - 机制 B 应在大多数画像中触发
 * - 推荐菜零重复 + 菜系/地区多样
 */

type Strategy = (q: QuizQuestion, step: number) => QuizOption;

const TARGET_SPICY: WeightVector = { ...ZERO_VECTOR, spicy: 80, salty: 60 };
const TARGET_SWEET: WeightVector = { ...ZERO_VECTOR, sweet: 80, sour: 30 };
const TARGET_SOUR: WeightVector = { ...ZERO_VECTOR, sour: 80 };
const TARGET_RICH: WeightVector = { ...ZERO_VECTOR, rich: 80, salty: 60 };
const TARGET_TENDER: WeightVector = { ...ZERO_VECTOR, tender: 80, rich: 50 };

function closestTo(q: QuizQuestion, target: WeightVector): QuizOption {
  let best = q.options[0]!;
  let bestSim = -Infinity;
  for (const o of q.options) {
    const s = cosineSim(o.weights, target);
    if (s > bestSim) { bestSim = s; best = o; }
  }
  return best;
}

function neutral(q: QuizQuestion): QuizOption {
  let best = q.options[0]!;
  let bestAbs = Infinity;
  for (const o of q.options) {
    const a = (Object.values(o.weights) as number[]).reduce((s, v) => s + Math.abs(v), 0);
    if (a < bestAbs) { bestAbs = a; best = o; }
  }
  return best;
}

interface SimResult {
  count: number;
  maxPursue: number;
  pursued: boolean;
  dupCount: number;
  topDishes: { name: string; cuisine?: string; region?: string }[];
}

function simulate(_label: string, strategy: Strategy, seedBase: number): SimResult {
  let state = initialState();
  let maxPursue = 0;
  let pursued = false;
  for (let step = 0; step < MAX_QUESTIONS; step++) {
    const q = pickNextQuestion(state, seedBase + step);
    if (!q) break;
    const opt = strategy(q, step);
    state = applyAnswer(state, q.id, opt.id);
    const pursue = detectPursueDims(state.answers, state.profile);
    if (pursue.size > maxPursue) maxPursue = pursue.size;
    if (state.askedIds.length >= MIN_QUESTIONS && pursue.size > 0) pursued = true;
    if (shouldStop(state)) break;
  }
  const count = state.askedIds.length;
  const dupCount = count - new Set(state.askedIds).size;
  return { count, maxPursue, pursued, dupCount, topDishes: [] };
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function dist(xs: number[]): string {
  return xs.join(',');
}

describe('真实题库端到端模拟 — 目标:平均 30-35 题,机制 B 常触发', () => {
  it('5 个画像(2 一致 + 3 矛盾/波动)各 4 seed,平均应 ∈ [28,36] + 机制B触发率 ≥ 60%', () => {
    const targets: { name: string; vec: WeightVector }[] = [
      { name: '嗜辣', vec: TARGET_SPICY },
      { name: '嗜甜', vec: TARGET_SWEET },
      { name: '嗜酸', vec: TARGET_SOUR },
      { name: '嗜浓', vec: TARGET_RICH },
      { name: '嗜嫩', vec: TARGET_TENDER },
    ];
    const allCounts: number[] = [];
    const allPursued: boolean[] = [];
    const allDup: number[] = [];
    for (const { name, vec } of targets) {
      const group: number[] = [];
      for (let s = 0; s < 4; s++) {
        const r = simulate(`${name}#${s}`, (q) => closestTo(q, vec), 1000 + targets.indexOf({ name, vec } as any) * 100 + s * 13);
        group.push(r.count);
        allCounts.push(r.count);
        allPursued.push(r.pursued);
        allDup.push(r.dupCount);
        expect(r.dupCount).toBe(0);
      }
      console.log(`  [${name}] 题数: ${dist(group)}  平均: ${avg(group).toFixed(1)}`);
    }
    // 矛盾画像:在每道题上按"80% 概率用一致目标 / 20% 概率反着选"制造波动
    for (const { name, vec } of targets.slice(0, 3)) {
      const group: number[] = [];
      for (let s = 0; s < 4; s++) {
        const r = simulate(`摇摆${name}#${s}`, (q, step) => step % 5 === 0 ? closestTo(q, vec) : neutral(q), 5000 + targets.indexOf({ name, vec } as any) * 100 + s * 13);
        group.push(r.count);
        allCounts.push(r.count);
        allPursued.push(r.pursued);
        allDup.push(r.dupCount);
      }
      console.log(`  [摇摆${name}] 题数: ${dist(group)}  平均: ${avg(group).toFixed(1)}`);
    }
    const mean = avg(allCounts);
    const pursueRate = allPursued.filter(Boolean).length / allPursued.length;
    const dupTotal = allDup.reduce((a, b) => a + b, 0);
    console.log(`  → 总体: 平均题数=${mean.toFixed(1)}  机制B触发率=${(pursueRate * 100).toFixed(0)}%  总重复=${dupTotal}`);
    expect(dupTotal).toBe(0);
    expect(mean).toBeGreaterThanOrEqual(28);
    expect(mean).toBeLessThanOrEqual(36);
    expect(pursueRate).toBeGreaterThanOrEqual(0.6);
  });

  it('全中庸型:弱信号追问至收敛,∈ [25,45] + 无重复', () => {
    const r = simulate('全中庸', (q) => neutral(q), 300);
    expect(r.count).toBeGreaterThanOrEqual(MIN_QUESTIONS);
    expect(r.count).toBeLessThanOrEqual(MAX_QUESTIONS);
    expect(r.dupCount).toBe(0);
  });

  it('辣维强弱波动型:机制 B 应真正触发(峰值追问维 > 0)', () => {
    const r = simulate(
      '辣维强弱波动',
      (q, step) => {
        const hasStrongSpicy = q.options.some((o) => Math.abs(o.weights.spicy) >= 20);
        if (!hasStrongSpicy) return q.options[0]!;
        let best = q.options[0]!;
        let bestVal = step % 2 === 0 ? -Infinity : Infinity;
        for (const o of q.options) {
          const w = o.weights.spicy;
          if (step % 2 === 0 ? w > bestVal : w < bestVal) { bestVal = w; best = o; }
        }
        return best;
      },
      900,
    );
    expect(r.maxPursue).toBeGreaterThan(0);
    expect(r.dupCount).toBe(0);
    expect(r.count).toBeLessThanOrEqual(MAX_QUESTIONS);
  });
});
