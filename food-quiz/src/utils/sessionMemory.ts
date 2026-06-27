/**
 * 跨 session 出题记忆(P9 多样性优化)。
 *
 * 作用层:第 3 层副作用工具(与 shareImage.ts 同级),**不放 lib/taste/**(第 1 层必须纯函数)。
 * 用 localStorage 记录最近几轮测试出过的题 id,供 adaptiveSelector 施轻惩罚,
 * 让同一台设备上连续多次测试不再老抽到同几道题。
 *
 * 容错:localStorage 不可用(SSR / 隐私模式 / 配额满 / JSON 损坏)→ 静默 no-op / 返回空,
 * 绝不抛错影响主流程。
 */

const KEY = 'fq_recent_sessions';
/** 滚动保留最近 N 轮测试的 askedIds。 */
const MAX_SESSIONS = 3;

type StoredShape = string[][];

/** 读取原始滚动窗口(数组 of askedId 数组),任何异常都返回空数组。 */
function readRaw(): StoredShape {
  if (typeof localStorage === 'undefined') return [];
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (s): s is string[] => Array.isArray(s) && s.every((x) => typeof x === 'string'),
  );
}

/**
 * 读取最近 maxSessions 轮测试出过的全部题 id(拼平)。
 * 用于 pickNextQuestion 的 recentSessionIds 参数。
 */
export function loadRecentAskedIds(maxSessions: number = MAX_SESSIONS): string[] {
  const all = readRaw();
  return all.slice(Math.max(0, all.length - maxSessions)).flat();
}

/** EMA 轮次距离衰减:最近 1 轮 distance=0→weight=1.0;2 轮前→0.5;3 轮前→0.25。
 *  比所有轮次等权计数更合理——旧轮次重复惩罚轻(口味漂移 / 遗忘容忍),最近轮次惩罚重。 */
const EMA_DECAY = 0.5;

/**
 * 读取最近 maxSessions 轮每题的 EMA 加权频次(P11 轻量 SH 频次衰减用)。
 * 不再走 loadRecentAskedIds 的拼平等权计数(.flat 丢轮次),而是直接读 readRaw 保留轮次结构、
 * 按距离加权:末尾=最近一轮 distance=0 weight=1.0,往前 distance 递增 weight=EMA_DECAY^distance,
 * 同题跨轮累加。供 pickNextQuestion 做 SESSION_SOFT_PENALTY^freq(0.7^freq,freq 浮点仍单调降)。
 */
export function loadRecentAskedCounts(maxSessions: number = MAX_SESSIONS): Map<string, number> {
  const all = readRaw();
  const recent = all.slice(Math.max(0, all.length - maxSessions));
  const counts = new Map<string, number>();
  for (let i = 0; i < recent.length; i++) {
    const distance = recent.length - 1 - i;  // 末尾(最近)→distance=0
    const weight = EMA_DECAY ** distance;
    for (const id of recent[i]!) {
      counts.set(id, (counts.get(id) ?? 0) + weight);
    }
  }
  return counts;
}

/**
 * 记录一轮测试的 askedIds,追加进滚动窗口(保留最近 MAX_SESSIONS 轮)。
 * 同一轮重复调用会重复追加——调用方应仅在 quiz 完成时调用一次。
 */
export function recordSession(askedIds: readonly string[]): void {
  if (typeof localStorage === 'undefined') return;
  if (!Array.isArray(askedIds)) return;
  const clean = askedIds.filter((x) => typeof x === 'string');
  const next = [...readRaw(), clean].slice(-MAX_SESSIONS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 配额满 / 隐私模式 → 忽略,不影响主流程 */
  }
}

/** 清空记忆(测试 / 重置用)。 */
export function clearRecentSessions(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}
