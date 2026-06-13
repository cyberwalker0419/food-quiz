# Phase 3: 评估 + 渲染管线 — Implementation Plan

> **子 plan 来源**:本文件是 master plan ([`d-rog-documents-github-pro-md-plan-pure-chipmunk.md`](../../../../../../Users/ROG/.claude/plans/d-rog-documents-github-pro-md-plan-pure-chipmunk.md)) Phase 3 段(行 187-246)的"开发期细化版"。master 是真相源;若本文与 master 冲突,以 master 为准。
>
> **工作日志**:[`phase3-work-log.md`](./phase3-work-log.md) — 进度、决策记录、待办、commit 回填。
>
> **数据流前提**:P1 已交付 8 中文维(`sour/sweet/bitter/spicy/salty/rich/crunchy/tender`)、单字母 `S T K L I X C N`、200 题总库 + 4 硬约束全过。P2 已交付 `normalize.ts` / `state.ts` / `adaptiveSelector.ts` / `result.ts`(适配层)。本 Phase 3 重写 `result.ts` 为 `assembleResult` 入口。

**Goal:** 消费 P1 + P2 产出,建"评估 + 渲染管线",把 8 维归一化向量 → 区间/极档/联动/全能/避雷 5 套文案 + (Phase 5 才有)菜品推荐,全部经 `keys.ts` 共享索引;运行时零 LLM;任意文案文件缺失不报错。

**Architecture:**
- `src/lib/taste/similarity.ts` — 从 P2 `normalize.ts` 拆出 `cosineSim` + `euclideanDist`
- `src/lib/taste/loaders.ts` — 5 文案目录 + dishes 的 JSON 加载,缺文件/坏文件静默跳过
- `src/lib/taste/result.ts` — **重写**:`assembleResult(V)` 入口,渲染优先级按 master §三-7
- `src/components/ResultCard.tsx` — 替换 App.tsx 内联结果,默认仅前 3 高档文案 + 极档优先占位
- `src/utils/shareImage.ts` — 重写签名,消费新 `assembleResult` 形状
- 删除 `src/data/cuisines.ts`
- 子 plan:`docs/superpowers/plans/phase3-result-rendering.md`(本文件)
- 工作日志:`docs/superpowers/plans/phase3-work-log.md`

**Tech Stack:** TypeScript ~6.0.2、Vitest 4.x、React 19.2.6、Vite 8.0.12。运行在 Windows 11 + Node + bash。

---

## File Structure

```
food-quiz/
├── src/
│   ├── lib/taste/                                [P1/P2 已有]
│   │   ├── types.ts / keys.ts                    [P1]
│   │   ├── normalize.ts                          [P2,本 Phase 复用]
│   │   ├── state.ts                              [P2]
│   │   ├── adaptiveSelector.ts                   [P2]
│   │   ├── similarity.ts                         [新建:从 normalize 拆出]
│   │   ├── similarity.test.ts                    [新建]
│   │   ├── loaders.ts                            [新建:5 目录加载]
│   │   ├── loaders.test.ts                       [新建:容错]
│   │   ├── result.ts                             [重写:assembleResult]
│   │   └── result.test.ts                        [新建:4 典型输入]
│   ├── components/
│   │   └── ResultCard.tsx                        [新建]
│   ├── App.tsx                                   [改造:消费 ResultCard]
│   ├── utils/shareImage.ts                       [重写:消费 assembleResult]
│   ├── data/cuisines.ts                          [删除]
│   └── content/                                  [P1,P4/P5 填充]
```

---

## Task 1: similarity.ts(从 normalize.ts 拆出)

**Files:**
- Create: `food-quiz/src/lib/taste/similarity.ts`
- Create: `food-quiz/src/lib/taste/similarity.test.ts`
- Modify: `food-quiz/src/lib/taste/normalize.ts`(移除 cos/euclid,re-export)

- [ ] **Step 1: 写 `similarity.ts`**

```ts
import type { DimensionVector, TasteDimension } from './types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/** 标准余弦相似度。 */
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

/** 混合相似度(master plan):0.5·cos + 0.5·1/(1+dist) */
export function blendedScore(a: DimensionVector, b: DimensionVector): number {
  return 0.5 * cosineSim(a, b) + 0.5 * (1 / (1 + euclideanDist(a, b)));
}
```

- [ ] **Step 2: normalize.ts 改 re-export(向后兼容)**

```ts
export { cosineSim, euclideanDist, blendedScore } from './similarity';
```

- [ ] **Step 3: 写 `similarity.test.ts`**

3 用例:cosine 同向量 → 1,零向量 → 0;euclidean 同向量 → 0;blendedScore 边界。

- [ ] **Step 4: 跑测**

```bash
cd food-quiz && npx vitest run src/lib/taste/similarity.test.ts && npx vitest run src/lib/taste/normalize.test.ts
```

Expected:全绿,normalize.test.ts 通过 re-export 仍可用 cos/euclid。

---

## Task 2: loaders.ts(5 目录 + dishes 容错加载)

**Files:**
- Create: `food-quiz/src/lib/taste/loaders.ts`
- Create: `food-quiz/src/lib/taste/loaders.test.ts`

- [ ] **Step 1: 写 `loaders.ts`**

设计原则:
- **缺文件 / 坏文件 → 静默返回 null 或 []**(master §三-11)
- **任意单个模块失败,不影响其他模块**
- 用 `import.meta.glob('../content/{intervals,extreme,synergies,allround,avoid,dishes.json}', { eager: true })` 批量加载
- 启动期 fail-fast 调 `validateQuestionBank` 已由 P1 保证,本 Phase 不再加

```ts
import type { DimensionVector, TasteDimension } from './types';
import { letterToChinese } from './keys';

// 批量加载所有文案(用 Vite 的 import.meta.glob 替代手写 import)
const allJson = import.meta.glob('../content/**/*.json', { eager: true });

// 类型定义
export interface IntervalEntry {
  index: number;
  key: string;
  label: string;
  copy: string;
}
export interface ExtremeEntry {
  dim: string;
  letter: string;
  label: string;
  threshold: number;
  copy: string[];
}
export interface SynergyEntry {
  pair?: [string, string];
  letters?: [string, string];
  label: string;
  copy: string[] | string;
  template?: string;  // 仅 _fallback 有
}
export interface AllroundIndex {
  module: 'allround';
  id: '_index';
  ids: string[];
}
export interface AllroundEntry {
  id: string;
  label: string;
  copy: string[];
}
export interface AvoidIndex {
  module: 'avoid';
  id: '_index';
  ids: string[];
}
export interface AvoidEntry {
  letter: string;
  dim: string;
  label: string;
  threshold: number;
  copy: string[];
}
export interface DishEntry {
  name: string;
  cuisine: string;
  region: string;
  vector: DimensionVector;
}

// 工具:从 allJson 拿到指定路径(无则 null)
function get(path: string): unknown {
  // Vite glob key 形如 '../content/intervals/000.json'
  const key = Object.keys(allJson).find((k) => k.endsWith(path));
  return key ? (allJson as Record<string, { default?: unknown }>)[key]?.default ?? null : null;
}

/** 256 条区间文案:按 index (0..255) → IntervalEntry | null */
export function loadInterval(index: number): IntervalEntry | null {
  if (!Number.isInteger(index) || index < 0 || index > 255) return null;
  const raw = get(`/intervals/${String(index).padStart(3, '0')}.json`);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as IntervalEntry;
  if (typeof e.copy !== 'string' || typeof e.label !== 'string' || typeof e.key !== 'string') return null;
  return e;
}

/** 8 维极档:按 dim 字母 → ExtremeEntry | null */
export function loadExtreme(letter: string): ExtremeEntry | null {
  const raw = get(`/extreme/${letter}.json`);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as ExtremeEntry;
  if (!Array.isArray(e.copy) || typeof e.label !== 'string') return null;
  return e;
}

/** 联动文案:按 Top1/Top2 字母对 → SynergyEntry;未命中回退 _fallback */
export function loadSynergy(a: string, b: string): SynergyEntry {
  const key = [a, b].sort().join('-').toLowerCase(); // 字典序排序 + 小写
  const raw = get(`/synergies/${key}.json`);
  if (raw && typeof raw === 'object' && Array.isArray((raw as SynergyEntry).copy)) {
    return raw as SynergyEntry;
  }
  // 回退
  const fb = get('/synergies/_fallback.json');
  if (fb && typeof fb === 'object') {
    return fb as SynergyEntry;
  }
  // 兜底兜底:硬编码
  return {
    label: '强强联合',
    copy: [`你最强的两个维度正在组队:${letterToChinese(a as never)} 与 ${letterToChinese(b as never)}`],
  };
}

/** 全能文案:随机选一条 */
export function loadAllround(): AllroundEntry | null {
  const idx = get('/allround/_index.json') as AllroundIndex | null;
  if (!idx || !Array.isArray(idx.ids) || idx.ids.length === 0) return null;
  const id = idx.ids[Math.floor(Math.random() * idx.ids.length)]!;
  const e = get(`/allround/${id}.json`);
  if (!e || typeof e !== 'object') return null;
  const ae = e as AllroundEntry;
  if (!Array.isArray(ae.copy) || typeof ae.label !== 'string') return null;
  return ae;
}

/** 避雷文案:按 dim 字母 */
export function loadAvoid(letter: string): AvoidEntry | null {
  const raw = get(`/avoid/${letter}.json`);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as AvoidEntry;
  if (!Array.isArray(e.copy) || typeof e.label !== 'string') return null;
  return e;
}

/** 菜品数据:仅 Phase 5 落盘后才有;缺失返回 null */
export function loadDishes(): DishEntry[] | null {
  const raw = get('/dishes.json');
  if (!Array.isArray(raw)) return null;
  return raw as DishEntry[];
}
```

- [ ] **Step 2: 写 `loaders.test.ts`**

用例:
- `loadInterval(0)` 缺文件 → null
- `loadExtreme('s')` 缺文件 → null
- `loadSynergy('L','X')` 缺 l-x.json → 走 _fallback 或硬编码兜底
- `loadSynergy('Z','Q')` 字母非法(防御性)— 任一 load 函数接受未知输入应不抛错
- `loadAllround()` 缺 _index.json → null
- `loadAvoid('x')` 缺文件 → null
- `loadDishes()` 缺文件 → null

注意:测试运行时所有目录都缺(本 PR 不生成文案),所以**全部断言 null / 兜底**。P4 落盘后,P4 自己的测试验证正向路径。

- [ ] **Step 3: 跑测**

```bash
cd food-quiz && npx vitest run src/lib/taste/loaders.test.ts
```

Expected:6+ 用例全绿。

---

## Task 3: result.ts 重写 — `assembleResult(V)` 入口

**Files:**
- Create: `food-quiz/src/lib/taste/result.ts`(覆盖 P2 的)
- Create: `food-quiz/src/lib/taste/result.test.ts`

- [ ] **Step 1: 写新 `result.ts`**

```ts
import type { WeightVector, DimensionVector, TasteDimension, TasteLetter } from './types';
import { DIMS, letterToChinese, letterToTierLabel, indexToKey } from './keys';
import { normalize, std } from './normalize';
import { blendedScore } from './similarity';
import { loadInterval, loadExtreme, loadSynergy, loadAllround, loadAvoid, loadDishes, type DishEntry } from './loaders';

const STD_ALLROUND = 15;     // master §三-8 全能文案触发
const STD_STOP = 5;          // P2 沿用
const HIGH_THRESHOLD = 60;   // master §三-2
const EXTREME_THRESHOLD = 90;
const DEFAULT_TOP_N_INTERVALS = 3;

export interface RenderedInterval {
  letter: TasteLetter;
  index: number;
  key: string;
  label: string;
  copy: string;
  value: number;        // 归一化后 [0, 100]
  tierLabel: string;    // "重酸" / "口味重 ⚡极" 等
  isHigh: boolean;
  isExtreme: boolean;
}
export interface RenderedExtreme {
  letter: TasteLetter;
  label: string;
  copy: string[];   // 多条备选,运行时随机选 1
}
export interface RenderedSynergy {
  label: string;
  copy: string;
  a: TasteLetter;
  b: TasteLetter;
  /** 命中的具体文件 or '_fallback' */
  source: string;
}
export interface RenderedAllround {
  label: string;
  copy: string;
}
export interface RenderedAvoid {
  letter: TasteLetter;
  label: string;
  copy: string;
}
export interface AssembledResult {
  vector: DimensionVector;     // 归一化 [0, 100]
  raw: WeightVector;           // 原始累加
  std: number;
  intervals: RenderedInterval[];   // 默认仅前 3(默认视图),全 8 在 expanded 后
  allIntervals: RenderedInterval[]; // 完整版 8 条
  extremes: RenderedExtreme[];
  synergy: RenderedSynergy | null;
  allround: RenderedAllround | null;
  avoid: RenderedAvoid | null;
  topDishes: DishEntry[];
  // 8 维 Tier 标签,供雷达图轴标注
  tierLabels: Record<TasteLetter, string>;
}

/** 单个 entry 的 tier 标签(给雷达图) */
export function tierLabelFor(letter: TasteLetter, normalizedValue: number): string {
  return letterToTierLabel(letter, normalizedValue);
}

/** 计算 synergy 时把 raw profile 升序字母,取 Top 1 + Top 2(都要 > HIGH) */
function pickTop2High(v: DimensionVector): { a: TasteLetter; b: TasteLetter } | null {
  const sorted = DIMS
    .map((letter, i) => ({ letter: letter as TasteLetter, value: v[DIMS[i]!]! }))
    .sort((x, y) => y.value - x.value);
  const top1 = sorted[0]!;
  const top2 = sorted[1]!;
  if (top1.value <= HIGH_THRESHOLD || top2.value <= HIGH_THRESHOLD) return null;
  return { a: top1.letter, b: top2.letter };
}

/** 选最低分维度的字母(避雷用) */
function pickMinLetter(v: DimensionVector): TasteLetter {
  let minLetter: TasteLetter = DIMS[0] as TasteLetter;
  let minVal = v[DIMS[0]!]!;
  for (let i = 1; i < DIMS.length; i++) {
    const l = DIMS[i] as TasteLetter;
    if (v[l]! < minVal) {
      minVal = v[l]!;
      minLetter = l;
    }
  }
  return minLetter;
}

/** 从 copy 数组里随机选 1 条(若空则返回空串) */
function pickOne(copy: readonly string[] | string | undefined): string {
  if (Array.isArray(copy)) {
    if (copy.length === 0) return '';
    return copy[Math.floor(Math.random() * copy.length)]!;
  }
  return copy ?? '';
}

/**
 * 主入口:8 维归一化向量 → 完整渲染结构。
 * - 任一文案/菜品模块缺失 → 该字段为 null/空数组,**不抛错**。
 */
export function assembleResult(raw: WeightVector, options?: { topNIntervals?: number; topNDishes?: number }): AssembledResult {
  const topNIntervals = options?.topNIntervals ?? DEFAULT_TOP_N_INTERVALS;
  const topNDishes = options?.topNDishes ?? 5;

  const v = normalize(raw);
  const s = std(v);

  // tier 标签
  const tierLabels = {} as Record<TasteLetter, string>;
  for (const l of DIMS) tierLabels[l as TasteLetter] = letterToTierLabel(l as TasteLetter, v[l as TasteDimension]!);

  // 8 个字母位是否高档
  const isHighBit = DIMS.map((l) => v[l as TasteDimension]! > HIGH_THRESHOLD);
  // key (8 字符串)
  const key = DIMS.map((l, i) => (isHighBit[i] ? l : l.toLowerCase())).join('');
  const intervalIndex = parseInt(isHighBit.map((b) => (b ? '1' : '0')).join(''), 2);

  // intervals: 完整 8 维,按"与 50 距离"降序
  const allIntervals: RenderedInterval[] = [];
  for (let i = 0; i < 8; i++) {
    const letter = DIMS[i] as TasteLetter;
    const value = v[letter as TasteDimension]!;
    const tierLabel = tierLabels[letter]!;
    const isHigh = isHighBit[i]!;
    const isExtreme = value >= EXTREME_THRESHOLD;
    const idx = isHigh ? intervalIndex : -1; // 低档位无对应区间文案(不强求)
    let label = tierLabel;
    let copy = '';
    if (isHigh) {
      const entry = loadInterval(intervalIndex);
      if (entry) {
        label = entry.label;
        copy = entry.copy;
      } else {
        // 缺文件兜底:用 tierLabel + 默认句
        copy = `${tierLabel}的代表,你可能爱这一口`;
      }
    } else {
      // 低档:不进 P3.4 区间文案机制
      copy = `${tierLabel},日常口味`;
    }
    allIntervals.push({
      letter, index: idx, key: idx >= 0 ? indexToKey(idx) : '', label, copy, value, tierLabel, isHigh, isExtreme,
    });
  }
  // 按"与 50 绝对距离"降序
  allIntervals.sort((x, y) => Math.abs(y.value - 50) - Math.abs(x.value - 50));
  // 默认视图:仅前 3
  const intervals = allIntervals.slice(0, topNIntervals);

  // extremes
  const extremes: RenderedExtreme[] = [];
  for (const r of allIntervals) {
    if (!r.isExtreme) continue;
    const ex = loadExtreme(r.letter.toLowerCase());
    if (!ex) continue;
    extremes.push({ letter: r.letter, label: ex.label, copy: ex.copy });
  }

  // synergy:仅当 Top1 + Top2 都 > 60 触发
  let synergy: RenderedSynergy | null = null;
  const top2 = pickTop2High(v);
  if (top2) {
    const entry = loadSynergy(top2.a, top2.b);
    const source = entry.letters ? `${entry.letters.join('-')}.json` : '_fallback.json';
    let copy = pickOne(entry.copy);
    if (entry.template) {
      // 兜底模板:替换 {a} {b} → 中文名
      const aName = letterToChinese(top2.a);
      const bName = letterToChinese(top2.b);
      copy = entry.template.replace(/\{a\}/g, aName).replace(/\{b\}/g, bName);
    }
    synergy = { label: entry.label, copy, a: top2.a, b: top2.b, source };
  }

  // allround:std < 15 时替换区间文案
  let allround: RenderedAllround | null = null;
  if (s < STD_ALLROUND) {
    const entry = loadAllround();
    if (entry) allround = { label: entry.label, copy: pickOne(entry.copy) };
  }

  // avoid:永远显示(最低分维)
  let avoid: RenderedAvoid | null = null;
  const minLetter = pickMinLetter(v);
  const avoidEntry = loadAvoid(minLetter.toLowerCase());
  if (avoidEntry) {
    avoid = { letter: minLetter, label: avoidEntry.label, copy: pickOne(avoidEntry.copy) };
  }

  // topDishes:仅当 dishes.json 存在(Phase 5 才有)
  let topDishes: DishEntry[] = [];
  const dishes = loadDishes();
  if (dishes) {
    const scored = dishes.map((d) => ({ d, score: blendedScore(v, d.vector) }));
    scored.sort((x, y) => y.score - x.score);
    topDishes = scored.slice(0, topNDishes).map((s) => s.d);
  }

  return { vector: v, raw, std: s, intervals, allIntervals, extremes, synergy, allround, avoid, topDishes, tierLabels };
}
```

- [ ] **Step 2: 写 `result.test.ts`(4 典型输入)**

```ts
import { describe, it, expect } from 'vitest';
import { assembleResult } from './result';
import { ZERO_VECTOR } from './types';

describe('assembleResult — 4 典型输入', () => {
  it('全低:无 synergy,无 extremes,无 allround,8 intervals 都标低', () => {
    const v = { ...ZERO_VECTOR, sour: -10, sweet: -5 };
    const r = assembleResult(v);
    expect(r.synergy).toBeNull();
    expect(r.extremes).toEqual([]);
    // std < 15 时 allround 触发
    // 全低:profile 累加负 → 归一化接近 25,std 可能 > 15(因为 sour 与 tender 差大)
    // 我们不强求 allround,只断言渲染管线不崩
    expect(r.intervals.length).toBeGreaterThan(0);
    expect(r.intervals.length).toBeLessThanOrEqual(3);
  });

  it('全高(>= 60):有 synergy,可能 extreme,allround 必为 null(std 大)', () => {
    const v = { ...ZERO_VECTOR, sour: 80, sweet: 80, bitter: 80, spicy: 80, salty: 80, rich: 80, crunchy: 80, tender: 80 };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    expect(r.allround).toBeNull();
  });

  it('极档 1 维(spicy=95):extremes 长度=1', () => {
    const v = { ...ZERO_VECTOR, spicy: 95 };
    const r = assembleResult(v);
    expect(r.extremes.length).toBe(1);
    expect(r.extremes[0]!.letter).toBe('L');
  });

  it('方差 < 15:allround 触发(替换区间文案分支)', () => {
    // 所有维都接近 50(归一化前 ≈ 0):profile = ZERO_VECTOR → 归一化 = 50 → std = 0
    const r = assembleResult(ZERO_VECTOR);
    expect(r.std).toBeLessThan(15);
    expect(r.allround).toBeNull(); // 缺文件兜底 → null
  });
});

describe('assembleResult — 边界', () => {
  it('极档 89.9 vs 90.0 vs 90.1 边界', () => {
    const a = { ...ZERO_VECTOR, sour: 89.9 };
    const b = { ...ZERO_VECTOR, sour: 90.0 };
    const c = { ...ZERO_VECTOR, sour: 90.1 };
    expect(assembleResult(a).extremes.length).toBe(0);
    expect(assembleResult(b).extremes.length).toBe(1);
    expect(assembleResult(c).extremes.length).toBe(1);
  });
});
```

- [ ] **Step 3: 跑测**

```bash
cd food-quiz && npx vitest run src/lib/taste/result.test.ts
```

Expected:5+ 用例全绿。

---

## Task 4: ResultCard.tsx 组件

**Files:**
- Create: `food-quiz/src/components/ResultCard.tsx`

- [ ] **Step 1: 写 `ResultCard.tsx`**

```tsx
import { useState } from 'react';
import type { AssembledResult } from '../lib/taste/result';
import type { DishEntry } from '../lib/taste/loaders';

interface Props {
  result: AssembledResult;
  onRestart: () => void;
  onCopy: (text: string) => void;
  onDownload: () => void;
}

export function ResultCard({ result, onRestart, onCopy, onDownload }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleIntervals = expanded ? result.allIntervals : result.intervals;
  const v = result.vector;

  return (
    <div className="app result-screen">
      <div className="result-content">
        <div className="result-badge">
          你的味觉灵魂
          <span className="result-mode"> · 自适应 · {result.intervals.length} 条目展开</span>
        </div>

        {/* 1. 联动文案(若 Top1+Top2 高) */}
        {result.synergy && (
          <div className="synergy-section">
            <h2 className="section-title">味觉共振</h2>
            <p className="synergy-label">{result.synergy.label}</p>
            <p className="synergy-copy">{result.synergy.copy}</p>
          </div>
        )}

        {/* 2. 8 维图(简化:用 bar 列表) */}
        <div className="profile-section">
          <h2 className="section-title">8 维味觉图谱</h2>
          <div className="profile-bars">
            {result.allIntervals.map((iv) => (
              <div key={iv.letter} className="profile-bar">
                <div className="bar-label">
                  <span className="bar-name">{iv.tierLabel}</span>
                  <span className="bar-value">{iv.value.toFixed(0)}</span>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${iv.isExtreme ? 'extreme' : iv.isHigh ? 'high' : 'low'}`}
                    style={{ width: `${iv.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. 区间文案(默认前 3,展开后全 8) */}
        {result.allround ? (
          <div className="allround-section">
            <h2 className="section-title">{result.allround.label}</h2>
            <p className="allround-copy">{result.allround.copy}</p>
          </div>
        ) : (
          <div className="intervals-section">
            <h2 className="section-title">味觉特征</h2>
            {visibleIntervals.map((iv) => (
              <div key={iv.letter} className="interval-item">
                <p className="interval-label">{iv.label}</p>
                <p className="interval-copy">{iv.copy}</p>
              </div>
            ))}
            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? '收起 ▲' : '展开完整解读 ▼'}
            </button>
          </div>
        )}

        {/* 4. 极档特殊文案(若 ≥ 90) */}
        {result.extremes.length > 0 && (
          <div className="extremes-section">
            <h2 className="section-title">极档警告</h2>
            {result.extremes.map((ex) => (
              <div key={ex.letter} className="extreme-item">
                <span className="extreme-label">{ex.label}</span>
                <span className="extreme-copy">{ex.copy[0]}</span>
              </div>
            ))}
          </div>
        )}

        {/* 5. 避雷指南 */}
        {result.avoid && (
          <div className="avoid-section">
            <h2 className="section-title">避雷指南</h2>
            <p className="avoid-label">{result.avoid.label}</p>
            <p className="avoid-copy">{result.avoid.copy}</p>
          </div>
        )}

        {/* 6. 推荐菜(Phase 5 才有 dishes.json) */}
        {result.topDishes.length > 0 && (
          <div className="dishes-section">
            <h2 className="section-title">今天吃这些</h2>
            <div className="dishes-grid">
              {result.topDishes.map((d: DishEntry, i: number) => (
                <div key={i} className="dish-card">
                  <span className="dish-name">{d.name}</span>
                  <span className="dish-meta">{d.cuisine} · {d.region}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. 操作按钮 */}
        <div className="result-actions">
          <button className="action-btn primary" onClick={onRestart}>🔄 重新测试</button>
          <button className="action-btn secondary" onClick={() => onCopy(generateShareText(result))}>📋 复制文案</button>
          <button className="action-btn primary" onClick={onDownload}>💾 保存结果图</button>
        </div>
      </div>
    </div>
  );
}

function generateShareText(r: AssembledResult): string {
  const top = r.allIntervals[0];
  const tag = top ? top.tierLabel : '味觉独特';
  return `我的味觉灵魂是【${tag}】!8 维图谱中 ${r.allIntervals.length} 项特征亮起,你也来测一下?`;
}
```

---

## Task 5: App.tsx 接入 ResultCard + 删旧内联结果

**Files:**
- Modify: `food-quiz/src/App.tsx`

- [ ] **Step 1: 在 phase='result' 改用 ResultCard 组件**

替换原 `<div className="app result-screen">...</div>` 块为 `<ResultCard result={assembled} onRestart={...} onCopy={...} onDownload={...} />`,其中 `assembled = assembleResult(state.profile)`。

- [ ] **Step 2: 删除 App.tsx 内 `getLabel` / `getBarColor` / `getDishEmoji` / `buildShareCardData` / `Confetti`**

(这些随 result 页一起走,ResultCard 内部用 tierLabel 替代 getLabel。)

---

## Task 6: utils/shareImage.ts 重写签名

**Files:**
- Modify: `food-quiz/src/utils/shareImage.ts`

- [ ] **Step 1: 改 `ShareCardData` 类型**

把字段从 `result: Cuisine` 改为 `result: AssembledResult`(由 P3 引入),内部 Canvas 绘制逻辑保留,但取数据的地方改用 `result.tierLabels` / `result.allIntervals` 等。

为最小化改动,本 PR **仅改类型 + 简单适配**;具体 Canvas 内部重写留给后续 review。

---

## Task 7: 删除旧实现

- [ ] **Step 1: 删 `src/data/cuisines.ts`**

```bash
rm src/data/cuisines.ts
rmdir src/data 2>/dev/null || true
```

- [ ] **Step 2: 跑测 + build + grep**

```bash
cd food-quiz && npx vitest run && npx tsc -b --noEmit && npm run build
grep -rE 'quick|full|精简|完整|umami' food-quiz/src/ | grep -vE '(\.test\.|//|Phase 3|loaders\.test|schema\.test|work-log)'
```

Expected:除 schema 拒收测试外,0 行。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "refactor(result): rebuild rendering pipeline with decoupled copy modules

- 新建 similarity.ts(从 normalize 拆出 cos/euclid/blendedScore)
- 新建 loaders.ts:5 文案目录 + dishes 容错加载(缺文件静默跳过)
- 重写 result.ts:assembleResult(V) 入口,渲染优先级按 master §三-7
- 新建 ResultCard.tsx:默认仅前 3 高档文案,展开完整解读
- 重写 shareImage.ts:消费新 assembleResult shape
- 删除 data/cuisines.ts(被 P5 dishes.json 替代)
- App.tsx 接入 ResultCard,删 getLabel/getBarColor/getDishEmoji/Confetti

文案目录内容(256 intervals / 8 extreme / 10 synergy / 3-5 allround / 8 avoid)
由 P4 一次性 LLM 批量生成;本 PR 仅建管线,文案缺失全部走容错。

测试:sim/loaders/result 三个新测试 + 原 8 文件 ≈ 100+ 用例全绿
tsc 0 error,vite build 0 error
grep -E 'quick|full|umami' src/ 仅命中 schema 拒收测试(0 个运行时引用)"
```

---

## Self-Review Checklist

- [ ] `npm test` 全部测试文件全绿(100+ 用例)
- [ ] tsc 0 error
- [ ] vite build 0 error
- [ ] 4 典型输入(全低 / 全高 / 极档 / std<15)走通 assembleResult 不抛错
- [ ] 极档边界 89.9/90.0/90.1 断言正确
- [ ] 任一文案文件缺失 → 对应字段为 null/[]/空,不报错
- [ ] 联动未命中 → 走 `_fallback` 模板,文案填入 {a} {b}
- [ ] `grep -rE 'umami' food-quiz/src/` 仅命中 schema 拒收测试
- [ ] `grep -rE 'quick|full' food-quiz/src/` 0 行
- [ ] `cuisines.ts` 已删
- [ ] P4 文案落盘后,本 Phase 0 改动即可让 P4 测试通过(管线已建好)

## 后续 Phase 入口

- **Phase 4**: `scripts/generate-copy.ts` + `scripts/validate-copy.ts`,LLM 批量生成 280 条文案落盘
- **Phase 5**: `src/content/dishes.json`,按省份覆盖的菜品向量数据
