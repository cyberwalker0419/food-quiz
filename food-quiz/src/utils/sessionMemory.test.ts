import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadRecentAskedIds,
  loadRecentAskedCounts,
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

  it('loadRecentAskedCounts:EMA 按轮次距离加权(最近=1.0,前=0.5,再前=0.25)', () => {
    recordSession(['old']);      // 最早 → distance=2 → weight=0.25
    recordSession(['mid']);      // 中   → distance=1 → weight=0.5
    recordSession(['recent']);   // 最近 → distance=0 → weight=1.0
    const counts = loadRecentAskedCounts();
    expect(counts.get('recent')).toBe(1.0);
    expect(counts.get('mid')).toBe(0.5);
    expect(counts.get('old')).toBe(0.25);
  });

  it('loadRecentAskedCounts:同题跨轮 EMA 累加(最近+最早=1.0+0.25=1.25,非旧整数 2)', () => {
    recordSession(['x']);        // 最早 distance=2
    recordSession(['other']);
    recordSession(['x']);        // 最近 distance=0
    const counts = loadRecentAskedCounts();
    expect(counts.get('x')).toBe(1.25);
    expect(counts.get('other')).toBe(0.5);
  });

  it('loadRecentAskedCounts:单轮 weight=1.0(等价旧整数计数,App 层 Map 不变)', () => {
    recordSession(['a', 'b']);
    const counts = loadRecentAskedCounts();
    expect(counts.get('a')).toBe(1.0);
    expect(counts.get('b')).toBe(1.0);
  });

  it('loadRecentAskedCounts:空存储 → 空 Map', () => {
    expect(loadRecentAskedCounts().size).toBe(0);
  });
});
