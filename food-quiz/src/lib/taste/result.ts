import type { WeightVector, DimensionVector, TasteLetter } from './types';
import { DIMS, letterToChinese, letterToTierLabel, letterToDim, indexToKey, valueToGrade, type Grade } from './keys';
import { normalize, std } from './normalize';
import { blendedScore } from './similarity';
import {
  loadInterval,
  loadExtreme,
  loadSynergy,
  loadAllround,
  loadDishes,
  type DishEntry,
} from './loaders';

const STD_ALLROUND = 15;        // master §三-8 全能文案触发
const HIGH_THRESHOLD = 60;      // master §三-2
const EXTREME_THRESHOLD = 90;   // master §三-2
const DEFAULT_TOP_N_INTERVALS = 3;
const DEFAULT_TOP_N_DISHES = 5;

/** Mulberry32 PRNG(从 adaptiveSelector 复制,避免跨模块依赖)。 */
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
  /** 推荐菜(Phase 5 才有 dishes.json;每菜系最多 1 道,跨菜系多样) */
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
  options?: { topNIntervals?: number; topNDishes?: number; maxAbs?: number; seed?: number },
): AssembledResult {
  const topNIntervals = options?.topNIntervals ?? DEFAULT_TOP_N_INTERVALS;
  const topNDishes = options?.topNDishes ?? DEFAULT_TOP_N_DISHES;
  // session seed:同一画像每次进入 result 阶段传不同 seed,推荐菜锚点
  // 从 Top-K 高分池里加权抽样,避免"两次测试推到一样的菜"。
  // 若不传,默认用 Math.random,保持调用方不感知;测试需要确定性时显式传值。
  const rng = options?.seed !== undefined ? mulberry32(options.seed) : Math.random;

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

  // 味觉特征去重:所有高档维度共享同一条 interval 文案(整体组合的 label+copy),
  // top1 保留整体文案,其余高档维度改用 tierLabel + 维度独立描述,
  // 避免 ResultCard「味觉特征」top3 显示三条一模一样。
  const topLabel = intervals[0]?.label ?? '';
  const topCopy = intervals[0]?.copy ?? '';
  for (let i = 1; i < intervals.length; i++) {
    const iv = intervals[i]!;
    if (!iv.isHigh) continue;
    if (iv.label === topLabel) iv.label = iv.tierLabel;
    if (iv.copy === topCopy) iv.copy = `${letterToChinese(iv.letter)}味偏好突出，${iv.tierLabel}`;
  }

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

  // 避雷指南已下线(avoid 字段不再生成;loadAvoid 数据保留以备将来恢复)

  // topDishes —— 「匹配池内加权随机抽样」选菜:
  //   - 仅从 popular 库(过滤冷门)
  //   - 候选池 = blendedScore ≥ 0.6 × 最高分 的所有菜(动态阈值,不限定个数)
  //   - 池太小(< topN) 时放宽到全 popular,保证至少能凑齐 topN
  //   - 池内按 score² 加权抽样(高分易中、低分仍有机会)
  //   - 唯一硬约束:不重菜名(同菜系/同地区都允许)
  //   - 同 seed → 确定性(测试可复现);App.tsx 每次进 result 阶段传新 seed → 每次随机不同
  let topDishes: DishEntry[] = [];
  const dishes = loadDishes();
  if (dishes) {
    const popular = dishes.filter((d) => d.popular !== false);
    const scored = popular.map((d) => ({ d, score: blendedScore(v, d.vector) }));
    scored.sort((a, b) => b.score - a.score);
    const topScore = scored[0]?.score ?? 0;
    // 匹配池:分数 ≥ 60% 最高分;若池内不足 topN,扩到全库保证可凑齐
    const MATCH_RATIO = 0.6;
    let pool = scored.filter((s) => s.score >= topScore * MATCH_RATIO);
    if (pool.length < topNDishes) pool = scored;
    // 加权随机抽 topN 道(按 score² 加权,无放回)
    const seenNames = new Set<string>();
    const remaining = pool.slice();
    while (topDishes.length < topNDishes && remaining.length > 0) {
      const weights = remaining.map((p) => Math.max(0.001, p.score) ** 2);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      let pickedIdx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i]!;
        if (r <= 0) { pickedIdx = i; break; }
      }
      const picked = remaining.splice(pickedIdx, 1)[0]!;
      if (seenNames.has(picked.d.name)) continue; // 去重菜名
      seenNames.add(picked.d.name);
      topDishes.push(picked.d);
    }
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
    topDishes,
    tierLabels,
  };
}
