import { describe, it, expect } from 'vitest';
import {
  loadInterval,
  loadExtreme,
  loadSynergy,
  loadAllround,
  loadAvoid,
  loadDishes,
} from './loaders';

describe('loadInterval', () => {
  it('缺文件 → null', () => {
    expect(loadInterval(0)).toBeNull();
  });

  it('非法 index 抛错防御(返回 null)', () => {
    expect(loadInterval(-1)).toBeNull();
    expect(loadInterval(256)).toBeNull();
    expect(loadInterval(1.5)).toBeNull();
  });
});

describe('loadExtreme', () => {
  it('缺文件 → null', () => {
    expect(loadExtreme('s')).toBeNull();
  });

  it('任意字母输入不抛错', () => {
    expect(() => loadExtreme('z')).not.toThrow();
  });
});

describe('loadSynergy', () => {
  it('未命中具体文件 → 走 _fallback 或硬编码兜底,返回带 copy 的 entry', () => {
    const r = loadSynergy('L', 'X');
    expect(r).toBeTruthy();
    expect(typeof r.label).toBe('string');
    // copy 是数组或字符串,任一种能拿到内容即可
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
  it('缺 _index.json → null', () => {
    expect(loadAllround()).toBeNull();
  });
});

describe('loadAvoid', () => {
  it('缺文件 → null', () => {
    expect(loadAvoid('x')).toBeNull();
  });
});

describe('loadDishes', () => {
  it('缺 dishes.json → null', () => {
    expect(loadDishes()).toBeNull();
  });
});
