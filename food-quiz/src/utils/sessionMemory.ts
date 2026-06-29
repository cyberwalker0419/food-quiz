/**
 * 跨 session 出题记忆(P9 多样性优化 + B 任务主题级衰减)。
 *
 * 作用层:第 3 层副作用工具(与 shareImage.ts 同级),**不放 lib/taste/**(第 1 层必须纯函数)。
 * 用 localStorage 记录最近几轮测试出过的题 id(+ 主题快照),供 adaptiveSelector 施轻惩罚,
 * 让同一台设备上连续多次测试不再老抽到同几道题/同主题。
 *
 * 容错:localStorage 不可用(SSR / 隐私模式 / 配额满 / JSON 损坏)→ 静默 no-op / 返回空,
 * 绝不抛错影响主流程。
 *
 * 存储形状(向后兼容):
 * - 旧版:string[][](每轮一个 askedIds 数组)。
 * - 当前:StoredSession[] = { ids, topics? }[]。topics 是 id→该题 topics[] 的快照,
 *   供 loadRecentStemCounts 做主题级跨 session 衰减(B 任务),无需运行时反查 questionBank。
 * - readRaw 双形状共存:旧 string[] 升级为 { ids: s }(旧 ids 记忆一字不丢),脏数据丢弃。
 */

const KEY = 'fq_recent_sessions';
/** 滚动保留最近 N 轮测试的 askedIds(+ 主题快照)。 */
const MAX_SESSIONS = 3;

/** 单轮记忆:题 id 列表 + 可选的主题快照(id → 该题 topics[])。 */
interface StoredSession {
  ids: string[];
  topics?: Record<string, string[]>;
}

type StoredShape = StoredSession[];

/** 校验 topics 是否为合法的 id→string[] 映射。 */
function isTopicsMap(v: unknown): v is Record<string, string[]> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (!Array.isArray(val) || !val.every((x) => typeof x === 'string')) return false;
  }
  return true;
}

/** 读取原始滚动窗口,任何异常都返回空数组。双形状兼容(旧 string[][] / 新 StoredSession[])。 */
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
  return parsed
    .map((s): StoredSession | null => {
      // 新形状:{ ids, topics? }
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        const o = s as { ids?: unknown; topics?: unknown };
        if (Array.isArray(o.ids) && o.ids.every((x) => typeof x === 'string')) {
          return { ids: o.ids, topics: isTopicsMap(o.topics) ? o.topics : undefined };
        }
      }
      // 旧形状:string[] → 升级为 { ids }(topics 缺失 → loadRecentStemCounts 回退 id 键)
      if (Array.isArray(s) && s.every((x) => typeof x === 'string')) {
        return { ids: s };
      }
      return null; // 脏数据丢弃
    })
    .filter((x): x is StoredSession => x !== null);
}

/**
 * 读取最近 maxSessions 轮测试出过的全部题 id(拼平)。
 * 用于 pickNextQuestion 的 recentSessionIds 参数。
 */
export function loadRecentAskedIds(maxSessions: number = MAX_SESSIONS): string[] {
  const all = readRaw();
  return all.slice(Math.max(0, all.length - maxSessions)).flatMap((s) => s.ids);
}

/**
 * 读取最近 maxSessions 轮每题的出现频次(P11 轻量 SH 频次衰减用)。
 * loadRecentAskedIds 拼平后重复 id 本就多次出现——这里计数还原频次,供 pickNextQuestion
 * 做 SESSION_SOFT_PENALTY^freq 衰减:freq 越高惩罚越重,压制跨 session 高频垄断题。
 * (此前 App 用 new Set(loadRecentAskedIds()) 把频次去重了,本函数恢复它。)
 */
export function loadRecentAskedCounts(maxSessions: number = MAX_SESSIONS): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of loadRecentAskedIds(maxSessions)) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * 读取最近 maxSessions 轮每**主题**的出现频次(B 任务:主题级跨 session 衰减)。
 * 与 loadRecentAskedCounts 对称,但键是题的主标签 topics[0](替失效的题干全文聚合——
 * 题干 0 重复 → 按全文聚合频次恒 1,形同虚设)。
 * - 主题快照存在:按 topics[0] 计数(一题贡献 1 到其主标签)。
 * - 快照缺失(旧形状 / 无 topics):回退用题 id 自身作键(保留 id 级语义,不崩)。
 * 供 pickNextQuestion 做 SESSION_SOFT_PENALTY^topicFreq 衰减,压制跨 session 同主题换皮。
 */
export function loadRecentStemCounts(maxSessions: number = MAX_SESSIONS): Map<string, number> {
  const all = readRaw();
  const sessions = all.slice(Math.max(0, all.length - maxSessions));
  const counts = new Map<string, number>();
  for (const sess of sessions) {
    const topicsById = sess.topics ?? {};
    for (const id of sess.ids) {
      const topics = topicsById[id];
      const key = topics && topics.length > 0 ? topics[0] : id;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * 记录一轮测试的 askedIds(+ 主题快照),追加进滚动窗口(保留最近 MAX_SESSIONS 轮)。
 * 同一轮重复调用会重复追加——调用方应仅在 quiz 完成时调用一次。
 * topicsById 可选:id → 该题 topics[](主标签 topics[0] 供 loadRecentStemCounts)。
 *   不传或某 id 缺失时,loadRecentStemCounts 回退用 id 键。
 */
export function recordSession(
  askedIds: readonly string[],
  topicsById?: Readonly<Record<string, string[]>>,
): void {
  if (typeof localStorage === 'undefined') return;
  if (!Array.isArray(askedIds)) return;
  const clean = askedIds.filter((x) => typeof x === 'string');
  // 只保留实际出现的 id 的 topics 快照,省存储
  let topics: Record<string, string[]> | undefined;
  if (topicsById) {
    const entries = clean
      .filter((id) => Array.isArray(topicsById[id]) && topicsById[id].length > 0)
      .map((id) => [id, topicsById[id]] as const);
    if (entries.length > 0) topics = Object.fromEntries(entries);
  }
  const session: StoredSession = topics ? { ids: clean, topics } : { ids: clean };
  const next = [...readRaw(), session].slice(-MAX_SESSIONS);
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
