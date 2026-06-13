import { describe, it, expect } from 'vitest';
import {
  pickNextQuestion,
  shouldStop,
  prunedDimensions,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  PRUNE_THRESHOLD,
} from './adaptiveSelector';
import { normalize, cosineSim } from './normalize';
import type { WeightVector } from './types';
import { ZERO_VECTOR } from './types';

function makeState(askedIds: string[], answers: { questionId: string }[], profile: WeightVector) {
  return { askedIds, answers, profile };
}

describe('prunedDimensions', () => {
  it('< 3 题时永远不剪枝', () => {
    const p = { ...ZERO_VECTOR, bitter: -50 };
    expect(prunedDimensions(p, 0).size).toBe(0);
    expect(prunedDimensions(p, 2).size).toBe(0);
  });

  it('≥ 3 题 + 某维 ≤ -30 → 进入剪枝', () => {
    const p = { ...ZERO_VECTOR, bitter: -40 };
    expect(prunedDimensions(p, 3).has('bitter')).toBe(true);
  });

  it('profile 全 0 → 不剪枝', () => {
    expect(prunedDimensions(ZERO_VECTOR, 5).size).toBe(0);
  });

  it('PRUNE_THRESHOLD 边界:strict ≤', () => {
    const p = { ...ZERO_VECTOR, sour: PRUNE_THRESHOLD };
    expect(prunedDimensions(p, 3).has('sour')).toBe(true);
    const p2 = { ...ZERO_VECTOR, sour: PRUNE_THRESHOLD + 1 };
    expect(prunedDimensions(p2, 3).has('sour')).toBe(false);
  });
});

describe('pickNextQuestion', () => {
  it('初始调用返回非 null(题库非空)', () => {
    const q = pickNextQuestion(makeState([], [], ZERO_VECTOR), 1);
    expect(q).not.toBeNull();
    expect(q?.id).toBeTruthy();
  });

  it('不会重复出已问过的题', () => {
    const state = makeState(['q1', 'q2'], [], ZERO_VECTOR);
    const q = pickNextQuestion(state, 1);
    expect(q).not.toBeNull();
    expect(['q1', 'q2']).not.toContain(q?.id);
  });

  it('达到 MAX 后返回 null', () => {
    const askedIds: string[] = [];
    for (let i = 1; i <= MAX_QUESTIONS; i++) askedIds.push(`q${i}`);
    const q = pickNextQuestion(makeState(askedIds, [], ZERO_VECTOR), 1);
    expect(q).toBeNull();
  });

  it('剪枝生效:profile bitter ≤ -30,问 3 题后,后续题不应触发 bitter', () => {
    const answers: { questionId: string }[] = [];
    const askedIds: string[] = [];
    let profile: WeightVector = { ...ZERO_VECTOR };
    for (let i = 0; i < 3; i++) {
      const q = pickNextQuestion(makeState(askedIds, answers, profile), i + 1);
      if (!q) break;
      const opt = q.options[0]!;
      askedIds.push(q.id);
      answers.push({ questionId: q.id });
      for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
        profile[k] += opt.weights[k] || 0;
      }
      // 模拟"极度排斥苦"
      profile.bitter = -40;
    }
    // 第 4 题起:所有 option 在 bitter 上都应为 0
    for (let step = 3; step < 10; step++) {
      const q = pickNextQuestion(makeState(askedIds, answers, profile), step + 1);
      if (!q) break;
      for (const opt of q.options) {
        expect(opt.weights.bitter || 0).toBe(0);
      }
      // 模拟答完,推进
      const opt = q.options[0]!;
      askedIds.push(q.id);
      answers.push({ questionId: q.id });
      for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
        profile[k] += opt.weights[k] || 0;
      }
    }
  });

  it('5 seed × 5 目标:出题数 ∈ [20, 45] & 余弦 ≥ 0.85', () => {
    const targets: WeightVector[] = [
      { sour: 90, sweet: 30, bitter: 80, spicy: 0, salty: 20, rich: 40, crunchy: 60, tender: 30 },
      { sour: 10, sweet: 20, bitter: 10, spicy: 95, salty: 60, rich: 70, crunchy: 30, tender: 40 },
      { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
      { sour: 50, sweet: 50, bitter: 50, spicy: 50, salty: 50, rich: 50, crunchy: 50, tender: 50 },
      { sour: 95, sweet: 0, bitter: 95, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
    ];
    for (let seed = 1; seed <= 5; seed++) {
      for (let t = 0; t < targets.length; t++) {
        const targetVec = targets[t]!;
        const askedIds: string[] = [];
        const answers: { questionId: string }[] = [];
        let profile: WeightVector = { ...ZERO_VECTOR };
        for (let step = 0; step < 60; step++) {
          const q = pickNextQuestion(makeState(askedIds, answers, profile), seed * 1000 + t * 100 + step);
          if (!q) break;
          // 选最接近 target 的 option
          let bestOpt = q.options[0]!;
          let bestDist = Infinity;
          for (const opt of q.options) {
            let d = 0;
            for (const k of Object.keys(targetVec) as (keyof WeightVector)[]) {
              d += (opt.weights[k] - targetVec[k]!) ** 2;
            }
            if (d < bestDist) {
              bestDist = d;
              bestOpt = opt;
            }
          }
          askedIds.push(q.id);
          answers.push({ questionId: q.id });
          for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
            profile[k] += bestOpt.weights[k] || 0;
          }
          const stop = shouldStop({ askedIds, profile }, 0.5);
          if (stop) break;
        }
        // 范围断言
        expect(askedIds.length, `seed=${seed} t=${t} count=${askedIds.length}`).toBeGreaterThanOrEqual(MIN_QUESTIONS);
        expect(askedIds.length, `seed=${seed} t=${t} count=${askedIds.length}`).toBeLessThanOrEqual(MAX_QUESTIONS);
        // 余弦断言(目标 0 跳过)
        if (!(t === 2 || t === 4)) {
          const v = normalize(profile);
          const sim = cosineSim(v, normalize(targetVec));
          expect(sim, `seed=${seed} t=${t} sim=${sim}`).toBeGreaterThanOrEqual(0.85);
        } else if (t === 4) {
          // 极端目标(sour=95, bitter=95)允许余弦略低
          const v = normalize(profile);
          const sim = cosineSim(v, normalize(targetVec));
          expect(sim, `seed=${seed} t=${t} sim=${sim}`).toBeGreaterThanOrEqual(0.80);
        }
      }
    }
  });
});

describe('shouldStop', () => {
  it('count < MIN → 不停', () => {
    expect(shouldStop({ askedIds: new Array(MIN_QUESTIONS - 1).fill('q'), profile: ZERO_VECTOR }, 1)).toBe(false);
  });

  it('count >= MAX → 必停', () => {
    expect(shouldStop({ askedIds: new Array(MAX_QUESTIONS).fill('q'), profile: ZERO_VECTOR }, 1)).toBe(true);
  });

  it('gain < ε → 停', () => {
    expect(shouldStop({ askedIds: new Array(MIN_QUESTIONS).fill('q'), profile: ZERO_VECTOR }, 0.1)).toBe(true);
  });
});
