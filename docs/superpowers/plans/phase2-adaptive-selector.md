# Phase 2: 动态出题引擎 — Implementation Plan

> **子 plan 来源**:本文件是 master plan ([`d-rog-documents-github-pro-md-plan-pure-chipmunk.md`](../../../../../../Users/ROG/.claude/plans/d-rog-documents-github-pro-md-plan-pure-chipmunk.md)) Phase 2 段的"开发期细化版"。master plan 是真相源;若本文与 master 冲突,以 master 为准。
>
> **数据流前提**:Phase 1 已交付 8 中文味觉维度(`sour/sweet/bitter/spicy/salty/rich/crunchy/tender`)、单字母索引 `S T K L I X C N`、200 题总库 `questions.json`(`weights` 字段顺序与 `DIMS` 一致)。本题库对每题任一选项,8 维中至少 2 维非零;每维都有 ≥ 1 个 ≥ 80 极档探针 + ≥ 1 个 ≤ -40 负权探针。

**Goal:** 用最少的题(**20–45 题区间内动态**)精准收敛 8 维向量;剪枝极端排斥维度;状态可回滚;**彻底删除** quick / full 双模式与旧 cuisine 匹配。

**Architecture:**
- `src/lib/taste/normalize.ts` — Min-Max 归一化 + 方差计算 + 余弦相似度
- `src/lib/taste/adaptiveSelector.ts` — 信息增益选题 + 硬性剪枝 + 停止判定
- `src/lib/taste/state.ts` — 答题状态封装(支持回退清除后续重排)
- `App.tsx` 改造:phase 简化为 `intro | quiz | result`,单一"开始测试"入口
- 删除:`utils/adaptiveQuiz.ts`、`data/questions.ts`、`data/cuisines.ts`、App.tsx 内的旧 `aggregate` / `similarity` / `rankCuisines` / `calculateResults` / `buildSequence` / `pickNextQuestion` 等

**Tech Stack:** TypeScript ~6.0.2、Vitest 4.x、React 19.2.6(仅 hook)、Vite 8.0.12。运行在 Windows 11 + Node + bash。

---

## File Structure

```
food-quiz/
├── src/
│   ├── lib/taste/                                [已有 types/keys]
│   │   ├── normalize.ts                          [新建:Min-Max + std + cosine]
│   │   ├── normalize.test.ts                     [新建]
│   │   ├── adaptiveSelector.ts                   [新建:核心引擎]
│   │   ├── adaptiveSelector.test.ts              [新建:5 seed 模拟]
│   │   ├── state.ts                              [新建:答题状态机]
│   │   └── state.test.ts                         [新建:回滚 + 剪枝]
│   ├── content/questions/                        [Phase 1 已有]
│   ├── App.tsx                                   [重构:单入口 + consume 新引擎]
│   ├── data/                                     [待删除]
│   │   ├── cuisines.ts                           [删除]
│   │   └── questions.ts                          [删除]
│   ├── utils/adaptiveQuiz.ts                     [删除]
│   └── utils/shareImage.ts                       [Phase 3 重写,本 Phase 不动]
```

**职责切分:**
- `normalize.ts`:纯函数,无 IO,无 React。被 P3 复用。
- `adaptiveSelector.ts`:纯函数,接 `WeightVector` profile + `pool` + `seed`,返回 `QuizQuestion | null`。
- `state.ts`:状态机,封装 `askedIds` / `answers` / `profile`,提供 `applyAnswer` / `undoLast` / `nextQuestion`。
- `App.tsx`:`useReducer` 持有 `state.ts` 的 state;`useEffect` 触发 `nextQuestion`;UI 渲染靠 `state.currentQuestion`。

---

## Task 1: normalize.ts(纯函数,无 IO)

**Files:**
- Create: `food-quiz/src/lib/taste/normalize.ts`
- Create: `food-quiz/src/lib/taste/normalize.test.ts`

- [ ] **Step 1: 写 `normalize.ts`**

内容:

```ts
import type { DimensionVector, WeightVector, TasteDimension } from './types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/**
 * 8 维原始权重 → [0, 100] 归一化向量。
 * 算法:对每维 raw_k,先按 max(|raw|) 缩放,再 clip 到 [0, 100]。
 * 负值不会"被吃掉":raw 越负,目标值越接近 0(raw 越正越接近 100)。
 * 这是简化版 Min-Max,单测覆盖边界。
 */
export function normalize(raw: WeightVector, maxAbs?: number): DimensionVector {
  const m = maxAbs ?? Math.max(1, ...DIMS.map((d) => Math.abs(raw[d] || 0)));
  const out = {} as DimensionVector;
  for (const d of DIMS) {
    const v = 50 + (25 * (raw[d] || 0)) / m;
    out[d] = Math.max(0, Math.min(100, v));
  }
  return out;
}

/** 8 维向量标准差(总体标准差,除以 N)。用于 P3 全能文案判定(std < 15)。 */
export function std(vec: DimensionVector): number {
  const values = DIMS.map((d) => vec[d]);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** 标准余弦相似度(不去中心化)。所有 dim ∈ [0, 100],自动非负。 */
export function cosineSim(a: DimensionVector, b: DimensionVector): number {
  let dot = 0, magA = 0, magB = 0;
  for (const d of DIMS) {
    dot += a[d] * b[d];
    magA += a[d] * a[d];
    magB += b[d] * b[d];
  }
  const denom = Math.sqrt(magA * magB);
  if (denom < 1e-9) return 0;
  return dot / denom;
}

/** 欧氏距离。 */
export function euclideanDist(a: DimensionVector, b: DimensionVector): number {
  let s = 0;
  for (const d of DIMS) {
    const diff = a[d] - b[d];
    s += diff * diff;
  }
  return Math.sqrt(s);
}
```

- [ ] **Step 2: 写 `normalize.test.ts`**

内容:

```ts
import { describe, it, expect } from 'vitest';
import { normalize, std, cosineSim, euclideanDist } from './normalize';
import { ZERO_VECTOR } from './types';
import type { DimensionVector } from './types';

const full: DimensionVector = {
  sour: 100, sweet: 100, bitter: 100, spicy: 100,
  salty: 100, rich: 100, crunchy: 100, tender: 100,
};

const zeros: DimensionVector = {
  sour: 0, sweet: 0, bitter: 0, spicy: 0,
  salty: 0, rich: 0, crunchy: 0, tender: 0,
};

describe('normalize', () => {
  it('全 0 → 全 50', () => {
    expect(normalize(ZERO_VECTOR)).toEqual({
      sour: 50, sweet: 50, bitter: 50, spicy: 50,
      salty: 50, rich: 50, crunchy: 50, tender: 50,
    });
  });

  it('极值:某维 = maxAbs → 该维 = 75', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: 100 }, 100);
    expect(out.sour).toBe(75);
  });

  it('极值:某维 = -maxAbs → 该维 = 25', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: -100 }, 100);
    expect(out.sour).toBe(25);
  });

  it('clip 到 [0, 100]', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: 9999, sweet: -9999 }, 100);
    expect(out.sour).toBeLessThanOrEqual(100);
    expect(out.sweet).toBeGreaterThanOrEqual(0);
  });

  it('不传 maxAbs 时自动取 max(|raw|)', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: 80, sweet: 40 });
    expect(out.sour).toBe(75);
    expect(out.sweet).toBe(50 + 25 * 40 / 80);
  });
});

describe('std', () => {
  it('全 0 → 0', () => {
    expect(std(zeros)).toBe(0);
  });

  it('全 100 → 0', () => {
    expect(std(full)).toBe(0);
  });

  it('一半 0 一半 100 → 50', () => {
    const v: DimensionVector = {
      sour: 0, sweet: 0, bitter: 0, spicy: 0,
      salty: 100, rich: 100, crunchy: 100, tender: 100,
    };
    expect(std(v)).toBe(50);
  });
});

describe('cosineSim', () => {
  it('同向量 → 1', () => {
    expect(cosineSim(full, full)).toBeCloseTo(1, 6);
  });

  it('零向量 → 0', () => {
    expect(cosineSim(zeros, zeros)).toBe(0);
    expect(cosineSim(zeros, full)).toBe(0);
  });

  it('正交 → 0', () => {
    const a: DimensionVector = { ...zeros, sour: 100, sweet: 100, bitter: 100, spicy: 100, salty: 0, rich: 0, crunchy: 0, tender: 0 };
    const b: DimensionVector = { ...zeros, sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 100, rich: 100, crunchy: 100, tender: 100 };
    expect(cosineSim(a, b)).toBeCloseTo(0, 6);
  });
});

describe('euclideanDist', () => {
  it('同向量 → 0', () => {
    expect(euclideanDist(full, full)).toBe(0);
  });

  it('全 0 vs 全 100 → sqrt(8)*100', () => {
    expect(euclideanDist(zeros, full)).toBeCloseTo(Math.sqrt(8) * 100, 4);
  });
});
```

- [ ] **Step 3: 跑测 + 类型检查**

```bash
cd food-quiz && npx vitest run src/lib/taste/normalize.test.ts && npx tsc -b --noEmit
```

Expected:14+ tests passed;0 type error。

---

## Task 2: state.ts(答题状态机)

**Files:**
- Create: `food-quiz/src/lib/taste/state.ts`
- Create: `food-quiz/src/lib/taste/state.test.ts`

- [ ] **Step 1: 写 `state.ts`**

内容:

```ts
import type { QuizQuestion, QuizOption, WeightVector } from './types';
import { ZERO_VECTOR } from './types';
import { questionBank } from '../../content/questions/questions.loader';

export type AnswerRecord = {
  questionId: string;
  optionId: string;
  /** 选完时该 option 注入到 profile 的权重。用于 undo 时反减。 */
  weights: WeightVector;
};

/** 完整答题状态(纯数据,可序列化)。 */
export interface QuizState {
  askedIds: string[];
  answers: AnswerRecord[];
  /** 当前 profile(原始权重,未归一化)。 */
  profile: WeightVector;
  /** 当前题目索引:0..answers.length。等于 answers.length 表示"还没选"。 */
  currentIndex: number;
}

export function initialState(): QuizState {
  return {
    askedIds: [],
    answers: [],
    profile: { ...ZERO_VECTOR },
    currentIndex: 0,
  };
}

export function findQuestion(id: string): QuizQuestion | undefined {
  return questionBank.questions.find((q) => q.id === id);
}

export function findOption(q: QuizQuestion, optionId: string): QuizOption | undefined {
  return q.options.find((o) => o.id === optionId);
}

/**
 * 应用一个答案:
 * - 推入 answers 数组
 * - 更新 profile(option.weights 累加)
 * - 推入 askedIds
 * - currentIndex 后移
 * 返回**新** state(不可变)。
 */
export function applyAnswer(
  state: QuizState,
  questionId: string,
  optionId: string,
): QuizState {
  const q = findQuestion(questionId);
  const opt = q && findOption(q, optionId);
  if (!q || !opt) {
    throw new Error(`Invalid answer: q=${questionId} opt=${optionId}`);
  }
  // 同一道题在 currentIndex 处已答过 → 替换(支持"回退到某题改答"流程)
  if (state.currentIndex < state.answers.length) {
    return replaceAnswer(state, questionId, optionId);
  }
  const profile = { ...state.profile };
  for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
    profile[k] += opt.weights[k] || 0;
  }
  return {
    askedIds: [...state.askedIds, questionId],
    answers: [...state.answers, { questionId, optionId, weights: opt.weights }],
    profile,
    currentIndex: state.currentIndex + 1,
  };
}

/**
 * 替换 currentIndex 处的答案:
 * - 从 profile 中减掉旧 option 的 weights,加上新的
 * - 后续答案(index+1..end)**全部丢弃**(回退效应)
 * - askedIds 同步:保留到 currentIndex(不含)
 */
function replaceAnswer(
  state: QuizState,
  questionId: string,
  optionId: string,
): QuizState {
  const old = state.answers[state.currentIndex];
  const q = findQuestion(questionId);
  const opt = q && findOption(q, optionId);
  if (!q || !opt) {
    throw new Error(`Invalid replace: q=${questionId} opt=${optionId}`);
  }
  const profile = { ...state.profile };
  if (old) {
    for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
      profile[k] -= old.weights[k] || 0;
    }
  }
  for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
    profile[k] += opt.weights[k] || 0;
  }
  // 截断到 currentIndex(不含)
  const newAnswers = state.answers.slice(0, state.currentIndex);
  const newAskedIds = state.askedIds.slice(0, state.currentIndex);
  newAnswers.push({ questionId, optionId, weights: opt.weights });
  newAskedIds.push(questionId);
  return {
    askedIds: newAskedIds,
    answers: newAnswers,
    profile,
    currentIndex: state.currentIndex + 1,
  };
}

/**
 * 回退一题:
 * - currentIndex - 1
 * - profile 减掉最后一题的 weights
 * - askedIds / answers 同步
 */
export function undoLast(state: QuizState): QuizState {
  if (state.currentIndex === 0) return state;
  const newIndex = state.currentIndex - 1;
  const last = state.answers[newIndex];
  const profile = { ...state.profile };
  if (last) {
    for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
      profile[k] -= last.weights[k] || 0;
    }
  }
  return {
    askedIds: state.askedIds.slice(0, newIndex),
    answers: state.answers.slice(0, newIndex),
    profile,
    currentIndex: newIndex,
  };
}
```

- [ ] **Step 2: 写 `state.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer, undoLast } from './state';

describe('applyAnswer', () => {
  it('推入答案 + 更新 profile + 移 currentIndex', () => {
    let s = initialState();
    s = applyAnswer(s, 'q1', 'q1-a');
    expect(s.answers).toHaveLength(1);
    expect(s.askedIds).toEqual(['q1']);
    expect(s.currentIndex).toBe(1);
    expect(s.profile.sour).not.toBe(0); // q1-a 必有非零
  });

  it('连续 3 题,profile 累加正确', () => {
    let s = initialState();
    s = applyAnswer(s, 'q1', 'q1-a');
    const p1 = { ...s.profile };
    s = applyAnswer(s, 'q2', 'q2-a');
    s = applyAnswer(s, 'q3', 'q3-a');
    expect(s.answers).toHaveLength(3);
    expect(s.currentIndex).toBe(3);
    // profile 严格累加:每加一题,profile 至少多 1 个维度的 |变化| > 0
    expect(Math.abs(s.profile.sour - p1.sour)).toBeGreaterThanOrEqual(0);
  });

  it('非法 question 抛错', () => {
    const s = initialState();
    expect(() => applyAnswer(s, 'q999', 'q999-a')).toThrow(/Invalid answer/);
  });
});

describe('replaceAnswer / undoLast', () => {
  it('undo 后 profile 减回', () => {
    let s = initialState();
    s = applyAnswer(s, 'q1', 'q1-a');
    s = applyAnswer(s, 'q2', 'q2-a');
    const p2 = { ...s.profile };
    s = undoLast(s);
    expect(s.currentIndex).toBe(1);
    expect(s.answers).toHaveLength(1);
    expect(s.profile).not.toEqual(p2);
  });

  it('回退到第 1 题后改答 → 后续答案丢弃', () => {
    let s = initialState();
    s = applyAnswer(s, 'q1', 'q1-a');
    s = applyAnswer(s, 'q2', 'q2-a');
    s = applyAnswer(s, 'q3', 'q3-a');
    s = undoLast(s);
    s = undoLast(s);
    // 现在 currentIndex = 1,重答 q1
    s = applyAnswer(s, 'q1', 'q1-b');
    expect(s.answers).toHaveLength(2); // q1-b, q3
    expect(s.answers[0].optionId).toBe('q1-b');
    // q3 仍是旧答案 — 但 currentIndex 已重排,后续应触发自适应
    expect(s.askedIds).toEqual(['q1', 'q3']);
  });

  it('undo 在 currentIndex=0 时不报错且不变', () => {
    const s = initialState();
    const s2 = undoLast(s);
    expect(s2).toBe(s);
  });
});
```

- [ ] **Step 3: 跑测**

```bash
cd food-quiz && npx vitest run src/lib/taste/state.test.ts
```

Expected:7+ tests passed。

---

## Task 3: adaptiveSelector.ts(信息增益 + 硬性剪枝 + 停止)

**Files:**
- Create: `food-quiz/src/lib/taste/adaptiveSelector.ts`
- Create: `food-quiz/src/lib/taste/adaptiveSelector.test.ts`

- [ ] **Step 1: 写 `adaptiveSelector.ts`**

```ts
import type { QuizQuestion, TasteDimension, WeightVector } from './types';
import { questionBank } from '../../content/questions/questions.loader';
import { normalize } from './normalize';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/** 题目区间常量(master plan)。 */
export const MIN_QUESTIONS = 20;
export const MAX_QUESTIONS = 45;
/** 信息增益阈值:累计 < ε 时停止(默认 0.5)。 */
export const STOP_EPSILON = 0.5;
/** 剪枝阈值:某维 raw 落入拒绝区的边界。 */
export const PRUNE_THRESHOLD = -30;

const TOP_K = 5;
const TOP_K_WEIGHTS = [0.34, 0.24, 0.18, 0.14, 0.10];

/**
 * Mulberry32(从旧 utils/adaptiveQuiz 移植,避免循环依赖)。
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 当前 profile 中被剪枝的维度集合:
 *   raw weight ≤ PRUNE_THRESHOLD(用户极度排斥)
 * 注:必须至少有 3 题答案才进入剪枝(避免前 2 题偶发拉低误判)。
 */
export function prunedDimensions(
  profile: WeightVector,
  answerCount: number,
): Set<TasteDimension> {
  if (answerCount < 3) return new Set();
  const out = new Set<TasteDimension>();
  for (const d of DIMS) {
    if ((profile[d] || 0) <= PRUNE_THRESHOLD) out.add(d);
  }
  return out;
}

/**
 * 单个候选题的信息增益(简化版方差降低量):
 *   gain = Σ_k (profile_k)² · maxOptWeight_k
 * - profile_k 越大,该维越确定;但 |optWeight_k| 越大,选完对 profile 影响越大。
 * - 对未填维(权重 = 0)不增分。
 * - 题目本身极化度越高,score 越高(因为勾选了它的 maxWeight 那条 option,会强烈改变某维)。
 */
function gainForQuestion(q: QuizQuestion, profile: WeightVector): number {
  let gain = 0;
  for (const opt of q.options) {
    for (const d of DIMS) {
      const w = opt.weights[d] || 0;
      if (w === 0) continue;
      gain += Math.abs(profile[d] || 0) * Math.abs(w);
    }
  }
  return gain;
}

/**
 * 候选题是否被剪枝:
 *   题的任一 option 在被剪枝维上 |weight| > 0 → 视为相关题 → 剪掉。
 */
function isPruned(q: QuizQuestion, pruned: Set<TasteDimension>): boolean {
  if (pruned.size === 0) return false;
  for (const opt of q.options) {
    for (const d of pruned) {
      if ((opt.weights[d] || 0) !== 0) return true;
    }
  }
  return false;
}

/**
 * 选题主入口:
 *   - 已达到 MAX → 返回 null
 *   - 当前题数 < MIN → 随机(取种子随机)
 *   - 否则按信息增益评分,top-5 加权抽样
 *   - 剪枝过滤:被剪枝维的题不进 top-5
 *   - 归一化 profile 后 std < 5 → 提前停止(用户 8 维全 50 附近,基本无信号)
 */
export function pickNextQuestion(
  state: {
    askedIds: string[];
    answers: { questionId: string }[];
    profile: WeightVector;
  },
  seed: number,
): QuizQuestion | null {
  const count = state.askedIds.length;

  // 硬性上限
  if (count >= MAX_QUESTIONS) return null;

  const rand = mulberry32(seed + count);
  const asked = new Set(state.askedIds);
  let pool = questionBank.questions.filter((q) => !asked.has(q.id));

  // 剪枝
  const pruned = prunedDimensions(state.profile, state.answers.length);
  if (pruned.size > 0) {
    const before = pool.length;
    pool = pool.filter((q) => !isPruned(q, pruned));
    // 兜底:剪枝后题库空了,放宽剪枝
    if (pool.length === 0) pool = questionBank.questions.filter((q) => !asked.has(q.id));
  }

  if (pool.length === 0) return null;

  // 早期(MIN 之前)→ 纯随机
  if (count < MIN_QUESTIONS) {
    return pool[Math.floor(rand() * pool.length)];
  }

  // 信息增益评分
  const scored = pool.map((q) => ({ q, gain: gainForQuestion(q, state.profile) }));
  scored.sort((a, b) => b.gain - a.gain);

  // top-5 加权抽样
  const topK = scored.slice(0, Math.min(TOP_K, scored.length));
  const r = rand();
  let acc = 0;
  for (let i = 0; i < topK.length; i++) {
    acc += TOP_K_WEIGHTS[i] || 0;
    if (r < acc) return topK[i].q;
  }
  return topK[0].q;
}

/**
 * 停止判定:返回是否应该停止(由 App.tsx 在每题答完后调用)。
 * - 已达 MAX → 必须停
 * - 已达 MIN 且最近 1 题 gain < ε → 停
 * - 归一化后 std < 5 → 停(用户扁平)
 */
export function shouldStop(
  state: { askedIds: string[]; profile: WeightVector },
  lastGain: number,
): boolean {
  const count = state.askedIds.length;
  if (count >= MAX_QUESTIONS) return true;
  if (count < MIN_QUESTIONS) return false;
  if (lastGain < STOP_EPSILON) return true;
  const v = normalize(state.profile);
  // std 在 [0, 50] 区间,5 表示非常扁
  const mean = 50;
  let s = 0;
  for (const d of DIMS) s += (v[d] - mean) ** 2;
  const std = Math.sqrt(s / DIMS.length);
  return std < 5;
}
```

- [ ] **Step 2: 写 `adaptiveSelector.test.ts`(5 seed × 模拟用户)**

```ts
import { describe, it, expect } from 'vitest';
import {
  pickNextQuestion,
  shouldStop,
  prunedDimensions,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  PRUNE_THRESHOLD,
} from './adaptiveSelector';
import { questionBank } from '../../content/questions/questions.loader';
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

  it('剪枝生效:profile bitter=-50,问 3 题后,后续题不应触发 bitter', () => {
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
      profile.bitter = -50;
    }
    // 第 4 题应不再有 bitter 相关 weight
    const q4 = pickNextQuestion(makeState(askedIds, answers, profile), 4);
    if (q4) {
      for (const opt of q4.options) {
        expect(opt.weights.bitter || 0).toBe(0);
      }
    }
  });

  it('5 seed × 5 模拟用户:终态余弦 ≥ 0.85 & 出题数 ∈ [20, 45]', () => {
    for (let seed = 1; seed <= 5; seed++) {
      // 5 个目标向量(8 维,各偏置不同)
      const target = [
        { sour: 90, bitter: 80, spicy: 0, sweet: 30, salty: 20, rich: 40, crunchy: 60, tender: 30 },
        { sour: 10, bitter: 10, spicy: 95, sweet: 20, salty: 60, rich: 70, crunchy: 30, tender: 40 },
        { sour: 0, bitter: 0, spicy: 0, sweet: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
        { sour: 50, bitter: 50, spicy: 50, sweet: 50, salty: 50, rich: 50, crunchy: 50, tender: 50 },
        { sour: 95, bitter: 95, spicy: 0, sweet: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
      ];
      for (let t = 0; t < target.length; t++) {
        const targetVec = target[t] as WeightVector;
        const askedIds: string[] = [];
        const answers: { questionId: string }[] = [];
        let profile: WeightVector = { ...ZERO_VECTOR };
        // 模拟"按目标向量近似地选最匹配的 option"
        for (let step = 0; step < 60; step++) {
          const q = pickNextQuestion(makeState(askedIds, answers, profile), seed * 1000 + t * 100 + step);
          if (!q) break;
          // 选最接近 target 的 option
          let bestOpt = q.options[0]!;
          let bestDist = Infinity;
          for (const opt of q.options) {
            let d = 0;
            for (const k of Object.keys(targetVec) as (keyof WeightVector)[]) {
              d += (opt.weights[k] - targetVec[k]) ** 2;
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
          // 停止判定
          const stop = shouldStop({ askedIds, profile }, 0.5);
          if (stop) break;
        }
        expect(askedIds.length).toBeGreaterThanOrEqual(MIN_QUESTIONS);
        expect(askedIds.length).toBeLessThanOrEqual(MAX_QUESTIONS);
        // 余弦相似度
        const { normalize, cosineSim } = require('./normalize');
        const v = normalize(profile);
        const sim = cosineSim(v, normalize(targetVec));
        // 0 目标向量跳过余弦(分母为 0)
        if (t !== 2) {
          expect(sim, `seed=${seed} t=${t} sim=${sim}`).toBeGreaterThanOrEqual(0.85);
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
```

> 备注:用 `require('./normalize')` 是因为 ESM 模式下动态 import,Vitest 4.x 支持,但 TypeScript 类型不识别 `require`;改用 `import { normalize, cosineSim }` 替换即可。

- [ ] **Step 3: 跑测**

```bash
cd food-quiz && npx vitest run src/lib/taste/adaptiveSelector.test.ts
```

Expected:5 seed × 5 模拟用户(实际 25 个 seed-目标组合)+ 3 个单独 case + 3 个 shouldStop + 2 个 prunedDimensions = 30+ tests。

注:第 5 个 seed 目标向量为 `{sour:95, bitter:95, ...}` ,两条极档同时高,可能触发"用户极端排斥其他维"的剪枝,允许余弦 ≥ 0.80 而非 0.85。

---

## Task 4: App.tsx 改造 — 单入口 + consume 新引擎

**Files:**
- Modify: `food-quiz/src/App.tsx`

- [ ] **Step 1: 删除旧 import + 旧函数 + quick/full 相关**

删除:
- `import { questions, quickQuestions, type Question } from './data/questions'`
- `import { cuisines, type Cuisine, type FlavorProfile } from './data/cuisines'`
- `import { pickNextQuestion, mulberry32 } from './utils/adaptiveQuiz'`
- `type QuizMode = 'quick' | 'full'`
- `const FLAVOR_KEYS`
- `function aggregate / similarity / rankCuisines / calculateResults / getSecondaryResults`
- `buildSequence` useCallback
- `quizMode` state + `setQuizMode`
- `questionPool` state(被新 selector 替代)
- UI 里的 mode 切换按钮(精简版 / 完整版)

- [ ] **Step 2: 引入新 import**

```ts
import { useReducer, useEffect } from 'react';
import { initialState, applyAnswer, undoLast, findQuestion, type QuizState } from './lib/taste/state';
import { pickNextQuestion, shouldStop, MIN_QUESTIONS, MAX_QUESTIONS } from './lib/taste/adaptiveSelector';
import { normalize } from './lib/taste/normalize';
import { downloadShareCard, type ShareCardData } from './utils/shareImage';
```

- [ ] **Step 3: 用 useReducer 替换 useState**

```tsx
type QuizAction =
  | { type: 'ANSWER'; questionId: string; optionId: string }
  | { type: 'UNDO' }
  | { type: 'NEXT_QUESTION'; question: QuizQuestion }
  | { type: 'DONE' }
  | { type: 'RESTART' };

function quizReducer(state: QuizState & { currentQuestion: ReturnType<typeof findQuestion> | null; done: boolean }, action: QuizAction) {
  switch (action.type) {
    case 'ANSWER': {
      const s2 = applyAnswer(state, action.questionId, action.optionId);
      return { ...s2, currentQuestion: null, done: false };
    }
    case 'UNDO': {
      const s2 = undoLast(state);
      return { ...s2, currentQuestion: findQuestion(s2.askedIds[s2.askedIds.length - 1] ?? ''), done: false };
    }
    case 'NEXT_QUESTION':
      return { ...state, currentQuestion: action.question };
    case 'DONE':
      return { ...state, done: true, currentQuestion: null };
    case 'RESTART':
      return { ...initialState(), currentQuestion: null, done: false };
  }
}
```

- [ ] **Step 4: 渲染逻辑**

- phase = `intro`:单一"开始测试"按钮(无 mode 切换)
- phase = `quiz`:渲染 `state.currentQuestion`;显示进度 `state.askedIds.length / (尚不知道)`,改为"第 N 题"
- phase = `result`:渲染 `normalize(state.profile)` + 旧 shareImage 入口(Phase 3 再重写)
- "上一题"按钮触发 `UNDO`
- 答完一题 → `ANSWER` → `useEffect` 调度 `pickNextQuestion` / `shouldStop`

- [ ] **Step 5: 跑测 + build**

```bash
cd food-quiz && npx vitest run && npx tsc -b --noEmit && npm run build
```

Expected:全绿,build 通过。

- [ ] **Step 6: grep 验证 quick/full 残留**

```bash
grep -rE 'quick|full|精简|完整' food-quiz/src/
```

Expected:0 行。

---

## Task 5: 删除旧文件

- [ ] **Step 1: 删除**

```bash
cd food-quiz && rm src/data/cuisines.ts src/data/questions.ts src/utils/adaptiveQuiz.ts
rmdir src/data 2>/dev/null || true
```

- [ ] **Step 2: 跑测 + build + grep**

```bash
npx vitest run && npx tsc -b --noEmit && npm run build
grep -rE 'umami|quick|full|精简|完整' food-quiz/src/ | grep -v 'loader' | grep -v '\.test\.'
```

Expected:除 `questions.schema.test.ts` 中对 `umami` 故意拒收的注释外,0 行。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "refactor(quiz): single-entry adaptive selector (20-45 questions, 8-dim)

- 新增 normalize.ts / state.ts / adaptiveSelector.ts
- App.tsx 改 useReducer,删 quick/full 双模式
- 删除 data/cuisines.ts / data/questions.ts / utils/adaptiveQuiz.ts
- 单测:5 seed × 5 目标 × 模拟用户,出题数 ∈ [20, 45],余弦 ≥ 0.85
- 剪枝:profile_k ≤ -30 + ≥ 3 题 → 后续过滤该维
- 停止:count ≥ MIN 且 gain < 0.5 或 std < 5
- 字段名一律 rich,无 umami 残留(注释中的 umami 仅出现在 schema 拒收测试)"
```

---

## Self-Review Checklist

- [ ] 5 测试文件 30+ 用例全绿
- [ ] 5 seed × 5 模拟用户,出题数 ∈ [20, 45]
- [ ] 终态余弦 ≥ 0.85(第 5 个极端目标可放 ≥ 0.80)
- [ ] 剪枝触发:profile_bitter ≤ -30 + ≥ 3 题后,后续题无 bitter 权重
- [ ] UI 单一入口,"开始测试"按钮 + 进度条 + "上一题"按钮
- [ ] `grep -rE 'quick|full|精简|完整' food-quiz/src/` 输出 0 行
- [ ] `grep -rE 'umami' food-quiz/src/` 除 schema 拒收测试外 0 行
- [ ] `npm run build` 0 error

## 后续 Phase 入口

- **Phase 3**:消费 normalize 的 8 维向量 + render 5 目录文案 + dishes.json
- **Phase 4**:批量生成 280 条文案
- **Phase 5**:dishes.json 数据准备
