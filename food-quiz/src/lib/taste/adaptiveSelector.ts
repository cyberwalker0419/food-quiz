import type { QuizQuestion, TasteDimension, WeightVector } from './types';
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
 * 选题主入口:
 *   - 已达到 MAX → 返回 null
 *   - 当前题数 < MIN → 随机(取种子随机)
 *   - 否则按信息增益评分,top-5 加权抽样
 *   - 剪枝过滤:被剪枝维的题不进 top-5
 *   - 归一化 profile 后 std < 5 → 提前停止(由 shouldStop 处理)
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
    pool = pool.filter((q) => !isPruned(q, pruned));
    // 兜底:剪枝后题库空了,放宽剪枝
    if (pool.length === 0) pool = questionBank.questions.filter((q) => !asked.has(q.id));
  }

  if (pool.length === 0) return null;

  // 早期(MIN 之前)→ 纯随机
  if (count < MIN_QUESTIONS) {
    return pool[Math.floor(rand() * pool.length)]!;
  }

  // 信息增益评分
  // gain = Σ opt∈q Σ d∈DIMS (|profile_d|) · (|opt.weights_d|)
  //   - profile 越大的维,被该题改动后信息量越大
  //   - 某 option 在该维权重越大,改动越剧烈
  const scored = pool.map((q) => {
    let gain = 0;
    for (const opt of q.options) {
      for (const d of DIMS) {
        const w = opt.weights[d] || 0;
        if (w === 0) continue;
        gain += Math.abs(state.profile[d] || 0) * Math.abs(w);
      }
    }
    return { q, gain };
  });
  scored.sort((a, b) => b.gain - a.gain);

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
