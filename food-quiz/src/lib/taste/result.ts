import type { WeightVector, DimensionVector, TasteLetter } from './types';
import { DIMS, letterToChinese, letterToTierLabel, letterToDim, indexToKey, valueToGrade, type Grade } from './keys';
import { normalize, std } from './normalize';
import { blendedScore } from './similarity';
import {
  loadInterval,
  loadExtreme,
  loadSynergy,
  loadAllround,
  loadAvoid,
  loadDishes,
  type DishEntry,
} from './loaders';

const STD_ALLROUND = 15;        // master §三-8 全能文案触发
const HIGH_THRESHOLD = 60;      // master §三-2
const EXTREME_THRESHOLD = 90;   // master §三-2
const DEFAULT_TOP_N_INTERVALS = 3;
const DEFAULT_TOP_N_DISHES = 5;

// ===== 渲染数据结构 =====

export interface RenderedInterval {
  letter: TasteLetter;
  index: number;
  key: string;
  label: string;
  copy: string;
  value: number;
  /** 文案档位标签:低X / 重X / 重X ⚡极(浓维:清淡 / 浓 / 口味重 ⚡极) */
  tierLabel: string;
  /** 视觉档位:A/B/C/D/E(每档 20 分);仅用于雷达 / bar / 数值标注层 */
  grade: Grade;
  isHigh: boolean;
  isExtreme: boolean;
}

export interface RenderedExtreme {
  letter: TasteLetter;
  label: string;
  copy: string[];
}

export interface RenderedSynergy {
  label: string;
  copy: string;
  a: TasteLetter;
  b: TasteLetter;
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
  /** 归一化 [0, 100] 后的 8 维向量 */
  vector: DimensionVector;
  /** 原始累加 profile(未归一化) */
  raw: WeightVector;
  /** 8 维标准差 */
  std: number;
  /** 默认视图(前 3 高档位文案) */
  intervals: RenderedInterval[];
  /** 完整版(全 8 维) */
  allIntervals: RenderedInterval[];
  /** 极档特殊文案(≥ 90) */
  extremes: RenderedExtreme[];
  /** 联动文案(仅 Top1 + Top2 都 > 60 触发) */
  synergy: RenderedSynergy | null;
  /** 全能文案(std < 15 触发,替换 256 区间文案分支) */
  allround: RenderedAllround | null;
  /** 避雷指南(永远显示) */
  avoid: RenderedAvoid | null;
  /** 推荐菜(Phase 5 才有 dishes.json) */
  topDishes: DishEntry[];
  /** 8 维档位标签,供雷达图轴标注 */
  tierLabels: Record<TasteLetter, string>;
}

// ===== 工具 =====

/** Top 1 + Top 2 是否都 > HIGH_THRESHOLD(60) */
function pickTop2High(v: DimensionVector): { a: TasteLetter; b: TasteLetter } | null {
  const sorted = DIMS
    .map((letter) => ({ letter: letter as TasteLetter, value: v[letterToDim(letter as TasteLetter)] }))
    .sort((x, y) => y.value - x.value);
  const top1 = sorted[0]!;
  const top2 = sorted[1]!;
  if (top1.value <= HIGH_THRESHOLD || top2.value <= HIGH_THRESHOLD) return null;
  return { a: top1.letter, b: top2.letter };
}

/** 最低分维度的字母 */
function pickMinLetter(v: DimensionVector): TasteLetter {
  let minLetter: TasteLetter = DIMS[0] as TasteLetter;
  let minVal = v[letterToDim(DIMS[0] as TasteLetter)];
  for (let i = 1; i < DIMS.length; i++) {
    const l = DIMS[i] as TasteLetter;
    const val = v[letterToDim(l)];
    if (val < minVal) {
      minVal = val;
      minLetter = l;
    }
  }
  return minLetter;
}

/** 从 copy 数组里随机选 1 条;copy 是字符串则原样返回 */
function pickOne(copy: readonly string[] | string | undefined): string {
  if (Array.isArray(copy)) {
    if (copy.length === 0) return '';
    return copy[Math.floor(Math.random() * copy.length)]!;
  }
  if (typeof copy === 'string') return copy;
  return '';
}

// ===== 主入口 =====

/**
 * 8 维归一化向量 → 完整渲染结构。
 * - 任一文案/菜品模块缺失 → 该字段为 null/空数组,**不抛错**。
 * - 极档文案随 8 维一起排序出现(共享 allIntervals)。
 */
export function assembleResult(
  raw: WeightVector,
  options?: { topNIntervals?: number; topNDishes?: number; maxAbs?: number },
): AssembledResult {
  const topNIntervals = options?.topNIntervals ?? DEFAULT_TOP_N_INTERVALS;
  const topNDishes = options?.topNDishes ?? DEFAULT_TOP_N_DISHES;

  const v = normalize(raw, options?.maxAbs);
  const s = std(v);

  // 8 维档位标签
  const tierLabels = {} as Record<TasteLetter, string>;
  for (const l of DIMS) {
    const letter = l as TasteLetter;
    tierLabels[letter] = letterToTierLabel(letter, v[letterToDim(letter)]);
  }

  // 8 个字母位是否高档
  const isHighBit: boolean[] = DIMS.map((l) => v[letterToDim(l as TasteLetter)] > HIGH_THRESHOLD);
  const intervalIndex = parseInt(isHighBit.map((b) => (b ? '1' : '0')).join(''), 2);
  const intervalKey = indexToKey(intervalIndex);

  // allIntervals:8 维全排序
  const allIntervals: RenderedInterval[] = [];
  for (let i = 0; i < 8; i++) {
    const letter = DIMS[i] as TasteLetter;
    const value = v[letterToDim(letter)];
    const tierLabel = tierLabels[letter]!;
    const isHigh = isHighBit[i]!;
    const isExtreme = value >= EXTREME_THRESHOLD;
    let label: string;
    let copy: string;
    if (isHigh) {
      const entry = loadInterval(intervalIndex);
      if (entry) {
        label = entry.label;
        copy = entry.copy;
      } else {
        label = tierLabel;
        copy = `${tierLabel}的代表,你可能爱这一口`;
      }
    } else {
      label = tierLabel;
      copy = `${tierLabel},日常口味`;
    }
    allIntervals.push({
      letter,
      index: isHigh ? intervalIndex : -1,
      key: isHigh ? intervalKey : '',
      label,
      copy,
      value,
      tierLabel,
      grade: valueToGrade(value),
      isHigh,
      isExtreme,
    });
  }
  // 按"与 50 绝对距离"降序(master §三-7)
  allIntervals.sort((x, y) => Math.abs(y.value - 50) - Math.abs(x.value - 50));
  const intervals = allIntervals.slice(0, topNIntervals);

  // extremes
  const extremes: RenderedExtreme[] = [];
  for (const r of allIntervals) {
    if (!r.isExtreme) continue;
    const ex = loadExtreme(r.letter.toLowerCase());
    if (!ex) continue;
    extremes.push({ letter: r.letter, label: ex.label, copy: ex.copy });
  }

  // synergy
  let synergy: RenderedSynergy | null = null;
  const top2 = pickTop2High(v);
  if (top2) {
    const entry = loadSynergy(top2.a, top2.b);
    const source = entry.letters ? `${entry.letters.join('-').toLowerCase()}.json` : '_fallback.json';
    let copy = pickOne(entry.copy);
    if (entry.template) {
      const aName = letterToChinese(top2.a);
      const bName = letterToChinese(top2.b);
      copy = entry.template.replace(/\{a\}/g, aName).replace(/\{b\}/g, bName);
    }
    synergy = { label: entry.label, copy, a: top2.a, b: top2.b, source };
  }

  // allround(std < 15)
  let allround: RenderedAllround | null = null;
  if (s < STD_ALLROUND) {
    const entry = loadAllround();
    if (entry) allround = { label: entry.label, copy: pickOne(entry.copy) };
  }

  // avoid(永远显示)
  let avoid: RenderedAvoid | null = null;
  const minLetter = pickMinLetter(v);
  const avoidEntry = loadAvoid(minLetter.toLowerCase());
  if (avoidEntry) {
    avoid = { letter: minLetter, label: avoidEntry.label, copy: pickOne(avoidEntry.copy) };
  }

  // topDishes
  let topDishes: DishEntry[] = [];
  const dishes = loadDishes();
  if (dishes) {
    const scored = dishes.map((d) => ({ d, score: blendedScore(v, d.vector) }));
    scored.sort((x, y) => y.score - x.score);
    topDishes = scored.slice(0, topNDishes).map((s) => s.d);
  }

  return {
    vector: v,
    raw,
    std: s,
    intervals,
    allIntervals,
    extremes,
    synergy,
    allround,
    avoid,
    topDishes,
    tierLabels,
  };
}
