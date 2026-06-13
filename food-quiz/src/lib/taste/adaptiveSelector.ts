import type { QuizQuestion, TasteDimension, WeightVector, Sharpness } from './types';
import { ZERO_VECTOR, sharpnessOf } from './types';
import { questionBank } from '../../content/questions/questions.loader';

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

/** P6.2 犀利度分层比例:前 10 题 60% 选 smooth,20 题后 60% 选 sharp。 */
export const EARLY_SMOOTH_RATIO = 0.6;
export const LATE_SHARP_RATIO = 0.6;
/** 完全重复阈值:与最近 2 题余弦 ≥ 此值视为雷同,跳过。 */
export const EXACT_DEDUP_THRESHOLD = 0.98;
/** 低响应维度窗口:基于最近 N 题的 profile 增量。 */
const LOW_RESPONSE_WINDOW = 5;

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
 * 题目的"主题向量"= options.weights 在 8 维上的 |w| 均值。
 * - 反映"题整体覆盖哪几个维度",与具体选项无关
 * - 同主题不同题的主题向量仍然可能接近
 */
export function topicVector(q: QuizQuestion): WeightVector {
  const out = { ...ZERO_VECTOR };
  const n = q.options.length;
  if (n === 0) return out;
  for (const opt of q.options) {
    for (const d of DIMS) {
      out[d] += Math.abs(opt.weights[d] || 0);
    }
  }
  for (const d of DIMS) out[d] /= n;
  return out;
}

/** 余弦相似度(用于"完全重复"判定)。 */
export function signatureSim(a: WeightVector, b: WeightVector): number {
  let dot = 0, mA = 0, mB = 0;
  for (const d of DIMS) {
    const va = a[d] || 0;
    const vb = b[d] || 0;
    dot += va * vb;
    mA += va * va;
    mB += vb * vb;
  }
  const denom = Math.sqrt(mA * mB);
  return denom < 1e-9 ? 0 : dot / denom;
}

/** 犀利度匹配权重:count 越靠后 + 题目越犀利,得分越高。
 *  返回 [0, 1],仅用于评分时的乘法加权。
 */
export function sharpnessWeight(count: number, sharpness: Sharpness): number {
  // 阶段判定
  const earlyEnd = Math.floor(MIN_QUESTIONS / 2);   // 10
  const lateStart = MIN_QUESTIONS;                   // 20
  let target: number;  // 0~1,目标"犀利比例"
  if (count < earlyEnd) {
    // early: 目标犀利比例 = (1 - EARLY_SMOOTH_RATIO) = 0.4
    target = 1 - EARLY_SMOOTH_RATIO;
  } else if (count < lateStart) {
    // mid: 平滑过渡,线性插值 0.4 → LATE_SHARP_RATIO
    const ratio = (count - earlyEnd) / (lateStart - earlyEnd);
    target = (1 - EARLY_SMOOTH_RATIO) + (LATE_SHARP_RATIO - (1 - EARLY_SMOOTH_RATIO)) * ratio;
  } else {
    target = LATE_SHARP_RATIO;
  }
  // sharpness 自身:sharp=1, smooth=0
  const self = sharpness === 'sharp' ? 1 : 0;
  // 差距越小,匹配越好;返回 0.5 + 0.5*对称接近度
  const diff = Math.abs(self - target);
  return Math.max(0, 1 - diff * 1.5);
}

/**
 * 找出"低响应维度" — 最近 LOW_RESPONSE_WINDOW 题里,各维 |profile 增量| 排名末 4 位。
 * 用于"追问"策略:从候选池优先选主题向量覆盖这些维度的题。
 */
function lowResponseDims(state: {
  askedIds: string[];
  answers: { weights?: WeightVector }[];
}): Set<TasteDimension> {
  const lastN = state.answers.slice(-LOW_RESPONSE_WINDOW);
  if (lastN.length === 0) return new Set(DIMS);  // 早期:全部算低响应
  const deltas: Record<TasteDimension, number> = { ...ZERO_VECTOR };
  for (const a of lastN) {
    if (!a.weights) continue;
    for (const d of DIMS) {
      deltas[d] += Math.abs(a.weights[d] || 0);
    }
  }
  // 排序:响应小 → 排前面
  const sorted = [...DIMS].sort((a, b) => deltas[a] - deltas[b]);
  return new Set(sorted.slice(0, 4));
}

/**
 * 候选 q 与最近 2 题的主题向量余弦 ≥ EXACT_DEDUP_THRESHOLD → 视为完全雷同,排除。
 */
function isExactDuplicate(q: QuizQuestion, recent: QuizQuestion[]): boolean {
  if (recent.length === 0) return false;
  const sig = topicVector(q);
  for (const r of recent.slice(-2)) {
    if (signatureSim(sig, topicVector(r)) >= EXACT_DEDUP_THRESHOLD) return true;
  }
  return false;
}

/**
 * 选题主入口:
 *   - 达到 MAX → null
 *   - 阶段 1 early (count < 10):smooth 主导
 *   - 阶段 2 mid (10 ≤ count < 20):平滑过渡
 *   - 阶段 3 late (count ≥ 20):sharp 主导 + 追问低响应维
 *   - 剪枝 + 完全重复过滤在所有阶段生效
 *   - 评分 = 犀利度匹配 × 信息增益 + 主题向量对低响应维的覆盖奖励
 */
export function pickNextQuestion(
  state: {
    askedIds: string[];
    answers: { questionId: string; weights?: WeightVector }[];
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
    pool = pool.filter((q) => !isPruned(q, pruned));
    // 兜底:剪枝后题库空了,放宽剪枝
    if (pool.length === 0) pool = questionBank.questions.filter((q) => !asked.has(q.id));
  }

  if (pool.length === 0) return null;

  // 收集最近 N 题对象(用于完全重复判定)
  const recent: QuizQuestion[] = [];
  for (let i = Math.max(0, state.askedIds.length - LOW_RESPONSE_WINDOW); i < state.askedIds.length; i++) {
    const id = state.askedIds[i];
    if (!id) continue;
    const q = questionBank.questions.find((qq) => qq.id === id);
    if (q) recent.push(q);
  }

  // 完全重复过滤(与最近 2 题余弦 ≥ 0.98 跳过)
  const fresh = pool.filter((q) => !isExactDuplicate(q, recent));
  if (fresh.length > 0) pool = fresh;
  // 兜底:全被过滤 → 退回到未过滤池(避免极端情况死锁)

  // 早期(count < MIN_QUESTIONS)走犀利度匹配权重 + 主题向量对全维覆盖的均匀奖励
  // (早期没有 profile 信息,信息增益退化为"主题向量在 DIMS 上的均匀覆盖")
  if (count < MIN_QUESTIONS) {
    const scored = pool.map((q) => {
      const sw = sharpnessWeight(count, sharpnessOf(q));
      // 早期奖励:主题向量在 8 维上分布越均匀越好
      // std 越大 = 维度越分散 = 越能建立基线
      const tv = topicVector(q);
      const mean = DIMS.reduce((s, d) => s + (tv[d] || 0), 0) / DIMS.length;
      const variance = DIMS.reduce((s, d) => s + ((tv[d] || 0) - mean) ** 2, 0) / DIMS.length;
      const std = Math.sqrt(variance);
      return { q, score: sw * 10 + std };
    });
    scored.sort((a, b) => b.score - a.score);
    const topK = scored.slice(0, Math.min(TOP_K, scored.length));
    const r = rand();
    let acc = 0;
    for (let i = 0; i < topK.length; i++) {
      acc += TOP_K_WEIGHTS[i] || 0;
      if (r < acc) return topK[i]!.q;
    }
    return topK[0]!.q;
  }

  // 后期(count ≥ MIN_QUESTIONS):犀利度分层 + 追问 + 信息增益
  const lowResDims = lowResponseDims(state);
  const scored = pool.map((q) => {
    // 1) 信息增益:profile 越大的维,被该题改动后信息量越大
    let gain = 0;
    for (const opt of q.options) {
      for (const d of DIMS) {
        const w = opt.weights[d] || 0;
        if (w === 0) continue;
        gain += Math.abs(state.profile[d] || 0) * Math.abs(w);
      }
    }
    // 2) 犀利度匹配(0~1)
    const sw = sharpnessWeight(count, sharpnessOf(q));
    // 3) 主题向量在低响应维上的覆盖奖励(0~1)
    const tv = topicVector(q);
    let lowCover = 0;
    for (const d of lowResDims) {
      lowCover += tv[d] || 0;
    }
    // 归一化:lowResDims.size = 4,典型 tv 单维 0~100 → 0~400
    const lowCoverNorm = Math.min(1, lowCover / 100);

    // 综合分:gain 主项 + 犀利度加成 + 追问加成
    return {
      q,
      score: gain * (0.6 + 0.4 * sw) + gain * 0.3 * lowCoverNorm + lowCoverNorm * 5,
    };
  });
  scored.sort((a, b) => b.score - a.score);

  // top-5 加权抽样
  const topK = scored.slice(0, Math.min(TOP_K, scored.length));
  const r = rand();
  let acc = 0;
  for (let i = 0; i < topK.length; i++) {
    acc += TOP_K_WEIGHTS[i] || 0;
    if (r < acc) return topK[i]!.q;
  }
  return topK[0]!.q;
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
  // std in [0, 50];< 5 表示非常扁
  // 简化:不调 normalize,直接对 raw profile 估算 std
  const values = DIMS.map((d) => state.profile[d] || 0);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) < 5;
}
