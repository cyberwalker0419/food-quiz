import { describe, it, expect } from 'vitest';
import {
  loadInterval,
  loadSynergy,
  loadAllround,
  loadAvoid,
  loadDishes,
} from './loaders';

describe('loadInterval', () => {
  it('index 0 → 全低档区间文案', () => {
    const r = loadInterval(0);
    expect(r).toBeTruthy();
    expect(r?.key).toBe('stklixcn');
    expect(typeof r?.label).toBe('string');
  });

  it('非法 index 返回 null（防御）', () => {
    expect(loadInterval(-1)).toBeNull();
    expect(loadInterval(256)).toBeNull();
    expect(loadInterval(1.5)).toBeNull();
  });
});

describe('loadSynergy', () => {
  it('命中或兜底，返回带 copy 的 entry', () => {
    const r = loadSynergy('L', 'X');
    expect(r).toBeTruthy();
    expect(typeof r.label).toBe('string');
    const copyText = Array.isArray(r.copy) ? r.copy.join(' ') : r.copy;
    expect(copyText.length).toBeGreaterThan(0);
  });

  it('字母大小写不敏感', () => {
    const r1 = loadSynergy('l', 'x');
    const r2 = loadSynergy('L', 'X');
    expect(r1.label).toBe(r2.label);
  });

  it('非法字母输入不抛错', () => {
    expect(() => loadSynergy('Z', 'Q')).not.toThrow();
  });
});

describe('loadAllround', () => {
  it('返回全能文案 entry', () => {
    const r = loadAllround();
    expect(r).toBeTruthy();
    expect(typeof r?.label).toBe('string');
  });
});

describe('loadAvoid', () => {
  it('字母 x → 浓维避雷文案', () => {
    const r = loadAvoid('x');
    expect(r).toBeTruthy();
    expect(r?.letter).toBe('x');
  });
});

describe('loadDishes', () => {
  it('返回 dishes.json 全库（245 道）', () => {
    const r = loadDishes();
    expect(r).not.toBeNull();
    expect(r?.length).toBe(245);
    expect(r?.[0]?.name).toBeTruthy();
    expect(r?.[0]?.vector).toBeTruthy();
  });
});
