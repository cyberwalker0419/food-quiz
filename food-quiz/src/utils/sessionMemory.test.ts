import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadRecentAskedIds,
  loadRecentAskedCounts,
  loadRecentStemCounts,
  recordSession,
  clearRecentSessions,
} from './sessionMemory';

/** Map 实现的最小 Storage 桩,只覆盖 getItem/setItem/removeItem/clear。 */
function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('sessionMemory', () => {
  let original: Storage | undefined;

  beforeEach(() => {
    original = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: Storage }).localStorage = makeStorage();
  });

  afterEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = original;
  });

  it('空存储 → loadRecentAskedIds 返回 []', () => {
    expect(loadRecentAskedIds()).toEqual([]);
  });

  it('recordSession 后能读回(拼平)', () => {
    recordSession(['q1', 'q2', 'q3']);
    expect(loadRecentAskedIds().sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('滚动窗口:保留最近 3 轮,第 4 轮挤掉第 1 轮', () => {
    recordSession(['a1', 'a2']);
    recordSession(['b1', 'b2']);
    recordSession(['c1', 'c2']);
    recordSession(['d1', 'd2']);
    const ids = new Set(loadRecentAskedIds());
    // 第 1 轮 a* 应被挤掉,后 3 轮 b/c/d 保留
    expect(ids.has('a1')).toBe(false);
    expect(ids.has('a2')).toBe(false);
    expect(ids.has('b1')).toBe(true);
    expect(ids.has('d2')).toBe(true);
    expect(ids.size).toBe(6);
  });

  it('maxSessions 截断:只读最近 1 轮', () => {
    recordSession(['a1']);
    recordSession(['b1']);
    recordSession(['c1']);
    expect(loadRecentAskedIds(1).sort()).toEqual(['c1']);
  });

  it('损坏 JSON → 返回 [](不抛错)', () => {
    localStorage.setItem('fq_recent_sessions', '{not json');
    expect(loadRecentAskedIds()).toEqual([]);
  });

  it('非数组结构 → 返回 []', () => {
    localStorage.setItem('fq_recent_sessions', JSON.stringify({ x: 1 }));
    expect(loadRecentAskedIds()).toEqual([]);
  });

  it('元素非 string[] 的脏数据被过滤', () => {
    localStorage.setItem(
      'fq_recent_sessions',
      JSON.stringify([['ok1'], [123, 'bad'], ['ok2']]),
    );
    const ids = loadRecentAskedIds().sort();
    expect(ids).toEqual(['ok1', 'ok2']);
  });

  it('recordSession 过滤非字符串元素', () => {
    // 故意混入非字符串,内部应清洗后存储
    recordSession(['q1', 2 as unknown as string, null as unknown as string]);
    expect(loadRecentAskedIds()).toEqual(['q1']);
  });

  it('clearRecentSessions 清空', () => {
    recordSession(['q1', 'q2']);
    clearRecentSessions();
    expect(loadRecentAskedIds()).toEqual([]);
  });

  it('重复调用 recordSession 重复追加(调用方负责只调一次)', () => {
    recordSession(['q1']);
    recordSession(['q1']);
    const ids = loadRecentAskedIds();
    expect(ids).toEqual(['q1', 'q1']);
  });

  it('recordSession 带 topicsById → loadRecentStemCounts 按主标签计数', () => {
    recordSession(
      ['q1', 'q2', 'q3'],
      {
        q1: ['format.scenario-hook', 'flavor-axis.spicy-driven'],
        q2: ['format.scenario-hook'],
        q3: ['flavor-axis.sour-driven'],
      },
    );
    const stems = loadRecentStemCounts();
    // q1/q2 同主标签 scenario-hook → 频次 2;q3 → 1
    expect(stems.get('format.scenario-hook')).toBe(2);
    expect(stems.get('flavor-axis.sour-driven')).toBe(1);
  });

  it('loadRecentStemCounts 快照缺失(不传 topicsById)→ 回退 id 键', () => {
    recordSession(['q1', 'q2']);
    const stems = loadRecentStemCounts();
    expect(stems.get('q1')).toBe(1);
    expect(stems.get('q2')).toBe(1);
  });

  it('旧形状(string[][])兼容:ids 不丢,loadRecentStemCounts 回退 id 键', () => {
    // 模拟旧版写入的裸 string[][](无 topics 快照)
    localStorage.setItem('fq_recent_sessions', JSON.stringify([['q1', 'q2'], ['q3']]));
    expect(loadRecentAskedIds().sort()).toEqual(['q1', 'q2', 'q3']);
    const stems = loadRecentStemCounts();
    expect(stems.get('q1')).toBe(1);
    expect(stems.get('q3')).toBe(1);
  });

  it('loadRecentStemCounts 滚动窗口:maxSessions 截断', () => {
    recordSession(['a1'], { a1: ['format.scenario-hook'] });
    recordSession(['b1'], { b1: ['format.scenario-hook'] });
    recordSession(['c1'], { c1: ['format.scenario-hook'] });
    recordSession(['d1'], { d1: ['format.scenario-hook'] });
    expect(loadRecentStemCounts(1).get('format.scenario-hook')).toBe(1); // 最近 1 轮
    expect(loadRecentStemCounts().get('format.scenario-hook')).toBe(3); // 最近 3 轮 b/c/d
  });

  it('新形状下 loadRecentAskedCounts 仍按 id 计数', () => {
    recordSession(['q1', 'q2'], { q1: ['format.scenario-hook'], q2: ['flavor-axis.spicy-driven'] });
    recordSession(['q1'], { q1: ['format.scenario-hook'] });
    const counts = loadRecentAskedCounts();
    expect(counts.get('q1')).toBe(2);
    expect(counts.get('q2')).toBe(1);
  });
});
