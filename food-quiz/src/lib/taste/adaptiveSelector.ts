import type { QuizQuestion, TasteDimension, WeightVector, Sharpness } from './types';
import { ZERO_VECTOR, sharpnessOf } from './types';
import { questionBank } from '../../content/questions/questions.loader';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/** 题目区间常量(master plan):动态 25–45,基础 25 题,自相矛盾才追问至 45。 */
export const MIN_QUESTIONS = 25;
export const MAX_QUESTIONS = 45;
/** 剪枝阈值:某维 raw 落入拒绝区的边界。 */
export const PRUNE_THRESHOLD = -30;

/** P6.2 犀利度分层比例:前 10 题 60% 选 smooth,20 题后 60% 选 sharp。 */
export const EARLY_SMOOTH_RATIO = 0.6;
export const LATE_SHARP_RATIO = 0.6;
/** 完全重复阈值:与最近 1 题余弦 ≥ 此值视为雷同,跳过(P7.1 0.98 → 0.85)。 */
export const EXACT_DEDUP_THRESHOLD = 0.85;
/** 二级去重:与最近 2-5 题维度覆盖重合数 > 此值视为覆盖雷同,跳过。 */
export const COVER_OVERLAP_THRESHOLD = 3;
/** 三级去重:与最近 5 题主题向量余弦 ≥ 此值的题,评分阶段 × 0.3^n 降权。 */
export const TOPIC_OVERLAP_THRESHOLD = 0.7;
/** 四级全局去重:最近 N 题窗口内,同一题最多出现 1 次。 */
export const GLOBAL_DEDUP_WINDOW = 10;
/** 追问机制 A(同主题强弱不一致):两题主题向量余弦 ≥ 此值视为同主题。 */
export const THEME_SIM = 0.6;
/** 追问机制 A:同主题两题,用户在某维的归一化表态强度差 ≥ 此值视为强弱背离。 */
export const INCONSISTENCY_GAP = 0.45;
/** 追问机制 B(强弱波动):某维强信号阈值,|w| ≥ 此值视为用户在该维明确表态。 */
export const STRONG_W = 18;
/** 追问机制 B:某维弱信号阈值,|w| ≤ 此值视为用户在该维淡漠;同时题里需有强选项可选(题本身能强表态)。 */
export const WEAK_W = 5;
/** 追问机制 B:用户既强又弱,但 profile 推到 |值| ≥ 此值后视为已澄清,该维脱离追问集合(收敛)。 */
export const CLARIFIED_ABS = 140;
/** 追问机制 C(覆盖度追问):某维累计 |weight| 总和 < 此值视为欠探索。 */
export const COVERAGE_FLOOR = 180;
/** 追问机制 C:题库中某维平均 |weight|/题 < 此值时,跳过该维(题库本身无法充分探索,如苦维)。 */
export const BANK_MIN_DENSITY = 25;
/** 低响应维度窗口:基于最近 N 题的 profile 增量。 */
const LOW_RESPONSE_WINDOW = 5;
/** P8.1 stem 全 session 软惩罚:累计出现 n 次 → 评分 × penalty[n](capped at 4)。 */
export const STEM_DEDUP_SOFT_PENALTY: readonly number[] = [1.0, 0.3, 0.1, 0.03, 0.01];
/** P8.1 后期额外折扣:全 session 内某 stem 累计 ≥ 2 次时,候选评分 × 此值。 */
export const STEM_DEDUP_LATE_DOUBLE_PENALTY = 0.3;
/** P8.1 后期 stem 去重启动阈值:已答 ≥ 此值才启用硬折扣(避免早期题池饿死)。 */
export const STEM_DEDUP_LATE_THRESHOLD = 20;

/**
 * 题库各维平均信号密度(模块级缓存,避免 detectPursueDims 重复计算)。
 * 用于机制 C:密度 < BANK_MIN_DENSITY 的维度(如苦维 ≈ 14.4)被跳过,避免永久追问。
 */
const BANK_DENSITY: Record<TasteDimension, number> = (() => {
  const out = {} as Record<TasteDimension, number>;
  for (const d of DIMS) {
    let total = 0;
    for (const q of questionBank.questions) {
      for (const o of q.options) total += Math.abs(o.weights[d] || 0);
    }
    out[d] = total / questionBank.questions.length;
  }
  return out;
})();

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
 * 候选 q 与最近 1 题的主题向量余弦 ≥ EXACT_DEDUP_THRESHOLD → 视为完全雷同,排除。
 * (P7.1:从最近 2 题收紧到最近 1 题,与阈值 0.85 协同放大去重力度。)
 */
function isExactDuplicate(q: QuizQuestion, recent: QuizQuestion[]): boolean {
  if (recent.length === 0) return false;
  const sig = topicVector(q);
  const last = recent[recent.length - 1];
  if (!last) return false;
  return signatureSim(sig, topicVector(last)) >= EXACT_DEDUP_THRESHOLD;
}

/** 维度覆盖重合数:两个 WeightVector 同时非零的维度数。 */
function coverOverlap(a: WeightVector, b: WeightVector): number {
  let n = 0;
  for (const d of DIMS) {
    if ((a[d] || 0) !== 0 && (b[d] || 0) !== 0) n++;
  }
  return n;
}

/**
 * 二级去重:与最近 2-5 题中任一题的维度覆盖重合数 > COVER_OVERLAP_THRESHOLD → 排除。
 * (最近 1 题已被一级处理,这里只看 2-5。)
 */
function isCoverDuplicate(q: QuizQuestion, recent: QuizQuestion[]): boolean {
  if (recent.length < 2) return false;
  const sig = topicVector(q);
  // recent 末尾第 1 个已在 isExactDuplicate 中处理,这里从倒数第 2 个开始往后看 4 个
  const slice = recent.slice(-5, -1);
  for (const r of slice) {
    if (coverOverlap(sig, topicVector(r)) > COVER_OVERLAP_THRESHOLD) return true;
  }
  return false;
}

/** 四级全局去重:某题在最近 GLOBAL_DEDUP_WINDOW 题窗口内出现次数。 */
function recentOccurrences(
  qid: string,
  askedIds: readonly string[],
): number {
  const window = askedIds.slice(-GLOBAL_DEDUP_WINDOW);
  return window.filter((id) => id === qid).length;
}

/**
 * P8.1 stem 全 session 频次统计:已答所有题(全 askedIds 范围)的 stem 出现次数。
 * - 用户原始诉求"避免后期抽到前期的题"——窗口覆盖整个 session,不是最近 N 题。
 * - 配合 `STEM_DEDUP_SOFT_PENALTY` 使用,索引 = 累计出现次数,capped at 4。
 */
export function getSessionStemCounts(askedIds: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of askedIds) {
    const q = questionBank.questions.find((qq) => qq.id === id);
    if (!q) continue;
    out.set(q.stem, (out.get(q.stem) ?? 0) + 1);
  }
  return out;
}

/** 题在某维上 options 的最大 |权重|(用于归一化用户表态强度)。 */
function maxOptionWeight(q: QuizQuestion, d: TasteDimension): number {
  let m = 0;
  for (const o of q.options) {
    const w = Math.abs(o.weights[d] || 0);
    if (w > m) m = w;
  }
  return m;
}

/**
 * 追问维度检测(渐进式 25–45 模型核心,≥25 后决定是否继续追问)。
 * 三套机制都不依赖负权重,规避"题库各维权重几乎全正"的偏态:
 *
 * 机制 A(同主题强弱不一致):用户在主题相近的两道题上,对共同主维的归一化表态强度
 *   差 ≥ INCONSISTENCY_GAP → 该维判为摇摆。
 * 机制 B(同维强弱波动):用户在某维既给过强信号(|w|≥STRONG_W),又在能强表态的题上
 *   选了弱选项(|w|≤WEAK_W,且题里其他选项 ≥STRONG_W) → 该维判为自相矛盾。
 * 机制 C(覆盖度不足):某维累计信号总量 < COVERAGE_FLOOR → 该维视为欠探索。
 *   题库密度 < BANK_MIN_DENSITY 的维度(如苦维)被自动跳过。
 *
 * 收敛保证:profile 推到 |值| ≥ CLARIFIED_ABS 或累计信号 ≥ COVERAGE_FLOOR 后
 * 该维脱离追问集合,不会卡满 45。
 */
export function detectPursueDims(
  answers: { questionId?: string; weights?: WeightVector }[],
  profile: WeightVector,
): Set<TasteDimension> {
  const out = new Set<TasteDimension>();

  const answered = answers
    .map((a) => ({
      q: a.questionId ? questionBank.questions.find((qq) => qq.id === a.questionId) : undefined,
      w: a.weights,
    }))
    .filter((x): x is { q: QuizQuestion; w: WeightVector } => !!x.q && !!x.w);

  // 机制 A:同主题题对,共同主维上归一化表态强度严重背离
  for (let i = 0; i < answered.length; i++) {
    for (let j = i + 1; j < answered.length; j++) {
      const A = answered[i]!;
      const B = answered[j]!;
      const tvA = topicVector(A.q);
      const tvB = topicVector(B.q);
      if (signatureSim(tvA, tvB) < THEME_SIM) continue; // 非同主题
      for (const d of DIMS) {
        if ((tvA[d] || 0) <= 0 || (tvB[d] || 0) <= 0) continue; // 非共同主维
        if (Math.abs(profile[d] || 0) >= CLARIFIED_ABS) continue; // 已澄清
        const maxA = maxOptionWeight(A.q, d);
        const maxB = maxOptionWeight(B.q, d);
        if (maxA <= 0 || maxB <= 0) continue;
        const nwA = (A.w[d] || 0) / maxA;
        const nwB = (B.w[d] || 0) / maxB;
        if (Math.abs(nwA - nwB) >= INCONSISTENCY_GAP) out.add(d);
      }
    }
  }

  // 机制 B:某维既有强信号又有"能强表态却没强表态"的弱信号
  for (const d of DIMS) {
    if (Math.abs(profile[d] || 0) >= CLARIFIED_ABS) continue; // 已澄清
    let hi = false;
    let lo = false;
    for (const a of answered) {
      const w = Math.abs(a.w[d] || 0);
      if (w >= STRONG_W) { hi = true; continue; }
      const maxQ = maxOptionWeight(a.q, d);
      if (maxQ >= STRONG_W && w <= WEAK_W) lo = true;
    }
    if (hi && lo) out.add(d);
  }

  // 机制 C: 覆盖度不足 — 某维累计信号总量低于 COVERAGE_FLOOR
  for (const d of DIMS) {
    if (Math.abs(profile[d] || 0) >= CLARIFIED_ABS) continue; // 已澄清
    if (BANK_DENSITY[d] < BANK_MIN_DENSITY) continue;         // 题库无法充分探索(如苦维)
    let userTotal = 0;
    for (const a of answered) {
      userTotal += Math.abs(a.w[d] || 0);
    }
    if (userTotal < COVERAGE_FLOOR) out.add(d);
  }

  return out;
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

  // 完全重复过滤(一级:与最近 1 题余弦 ≥ 0.85 跳过)
  const noExactDup = pool.filter((q) => !isExactDuplicate(q, recent));
  if (noExactDup.length > 0) pool = noExactDup;
  // 兜底:全被过滤 → 退回到未过滤池(避免极端情况死锁)

  // 二级去重:与最近 2-5 题维度覆盖重合数 > 3 跳过
  const noCoverDup = pool.filter((q) => !isCoverDuplicate(q, recent));
  if (noCoverDup.length > 0) pool = noCoverDup;
  // 兜底:全被过滤 → 退回原 pool

  // 四级全局去重:窗口 10 题内同题只能出现 1 次(检测到追问维度时放宽,让相关题更易入选)
  const hasPursue = detectPursueDims(state.answers, state.profile).size > 0;
  if (!hasPursue) {
    const noGlobalDup = pool.filter(
      (q) => recentOccurrences(q.id, state.askedIds) === 0,
    );
    if (noGlobalDup.length > 0) pool = noGlobalDup;
    // 兜底:全被过滤 → 退回原 pool
  }

  // 早期(count < MIN_QUESTIONS)走犀利度匹配权重 + 主题向量对全维覆盖的均匀奖励
  // (早期没有 profile 信息,信息增益退化为"主题向量在 DIMS 上的均匀覆盖")
  // P8.1:加 stem 全 session 软惩罚,让同 stem 尽量不复出。
  const stemCounts = getSessionStemCounts(state.askedIds);
  if (count < MIN_QUESTIONS) {
    const scored = pool.map((q) => {
      const sw = sharpnessWeight(count, sharpnessOf(q));
      // 早期奖励:主题向量在 8 维上分布越均匀越好
      // std 越大 = 维度越分散 = 越能建立基线
      const tv = topicVector(q);
      const mean = DIMS.reduce((s, d) => s + (tv[d] || 0), 0) / DIMS.length;
      const variance = DIMS.reduce((s, d) => s + ((tv[d] || 0) - mean) ** 2, 0) / DIMS.length;
      const std = Math.sqrt(variance);
      // P8.1:stem 软惩罚(全 session 累计)
      const stemCount = stemCounts.get(q.stem) ?? 0;
      const stemPenaltyIdx = Math.min(stemCount, STEM_DEDUP_SOFT_PENALTY.length - 1);
      const stemPenalty = STEM_DEDUP_SOFT_PENALTY[stemPenaltyIdx]!;
      return { q, score: (sw * 10 + std) * stemPenalty };
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

  // 后期(count ≥ MIN_QUESTIONS):犀利度分层 + 追问 + 信息增益 + 追问维度澄清
  const lowResDims = lowResponseDims(state);
  const pursueDims = detectPursueDims(state.answers, state.profile);
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
    // 4) 三级降权:与最近 5 题主题向量余弦 ≥ 0.7 的,每次重合 × 0.3
    let topicPenalty = 1;
    const last5 = recent.slice(-5);
    for (const r of last5) {
      if (signatureSim(tv, topicVector(r)) >= TOPIC_OVERLAP_THRESHOLD) {
        topicPenalty *= 0.3;
      }
    }
    // 5) P8.1:stem 全 session 软惩罚(累计出现 n 次 → 评分 × penalty[n])
    const stemCount = stemCounts.get(q.stem) ?? 0;
    const stemPenaltyIdx = Math.min(stemCount, STEM_DEDUP_SOFT_PENALTY.length - 1);
    let stemPenalty = STEM_DEDUP_SOFT_PENALTY[stemPenaltyIdx]!;
    // 6) P8.1 后期额外折扣:已答 ≥ 20 题 + 该 stem 累计 ≥ 2 → 评分再 × 0.3
    if (count >= STEM_DEDUP_LATE_THRESHOLD && stemCount >= 2) {
      stemPenalty *= STEM_DEDUP_LATE_DOUBLE_PENALTY;
    }

    // 7) 追问加成(≥25 且有追问维度):覆盖追问维度 + sharp 题(2 选项强澄清)
    let contraBoost = 0;
    if (pursueDims.size > 0) {
      let cover = 0;
      for (const d of pursueDims) cover += tv[d] || 0;
      const coverNorm = Math.min(1, cover / 80);
      const sharpBonus = sharpnessOf(q) === 'sharp' ? 1 : 0.4;
      contraBoost = coverNorm * 40 * sharpBonus;
    }

    // 综合分:gain 主项 + 犀利度加成 + 低响应追问 + 矛盾追问加成,再乘 topic/stem 惩罚
    return {
      q,
      score: (gain * (0.6 + 0.4 * sw) + gain * 0.3 * lowCoverNorm + lowCoverNorm * 5 + contraBoost) * topicPenalty * stemPenalty,
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
 * 停止判定(渐进式 25–45 追问模型,由 App.tsx 在每题答完后调用):
 *   - count ≥ MAX(45) → 必停(硬上限)
 *   - count < MIN(25) → 必继续(基础 25 题必答)
 *   - count ≥ MIN → 渐进放宽:题数越多,越容忍残余追问维度
 *
 * 追问维度随 profile 被推高和覆盖度积累而收敛,不卡满 45。
 */
export function shouldStop(state: {
  askedIds: string[];
  answers: { questionId?: string; weights?: WeightVector }[];
  profile: WeightVector;
}): boolean {
  const count = state.askedIds.length;
  if (count >= MAX_QUESTIONS) return true;
  if (count < MIN_QUESTIONS) return false;

  const pursueCount = detectPursueDims(state.answers, state.profile).size;
  if (pursueCount === 0) return true; // 无追问维 → 必停

  // 渐进放宽:题数越多,越容忍残余追问维
  if (count < 33) return false;            // 25-32: 必须全部澄清才停
  if (count < 37) return pursueCount <= 1;  // 33-36: 容忍 1 个残余维
  if (count < 41) return pursueCount <= 2;  // 37-40: 容忍 2 个残余维
  return true;                              // 41+: 足够数据,停
}
