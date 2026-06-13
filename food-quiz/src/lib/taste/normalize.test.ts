import { describe, it, expect } from 'vitest';
import { normalize, std, cosineSim, euclideanDist } from './normalize';
import { ZERO_VECTOR } from './types';
import type { DimensionVector } from './types';

const full: DimensionVector = {
  sour: 100, sweet: 100, bitter: 100, spicy: 100,
  salty: 100, rich: 100, crunchy: 100, tender: 100,
};

const zeros: DimensionVector = {
  sour: 0, sweet: 0, bitter: 0, spicy: 0,
  salty: 0, rich: 0, crunchy: 0, tender: 0,
};

describe('normalize', () => {
  it('全 0 → 全 50', () => {
    expect(normalize(ZERO_VECTOR)).toEqual({
      sour: 50, sweet: 50, bitter: 50, spicy: 50,
      salty: 50, rich: 50, crunchy: 50, tender: 50,
    });
  });

  it('极值:某维 = maxAbs → 该维 = 75', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: 100 }, 100);
    expect(out.sour).toBe(75);
  });

  it('极值:某维 = -maxAbs → 该维 = 25', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: -100 }, 100);
    expect(out.sour).toBe(25);
  });

  it('clip 到 [0, 100]', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: 9999, sweet: -9999 }, 100);
    expect(out.sour).toBeLessThanOrEqual(100);
    expect(out.sweet).toBeGreaterThanOrEqual(0);
  });

  it('不传 maxAbs 时自动取 max(|raw|)', () => {
    const out = normalize({ ...ZERO_VECTOR, sour: 80, sweet: 40 });
    expect(out.sour).toBe(75);
    expect(out.sweet).toBeCloseTo(50 + 25 * 40 / 80, 6);
  });
});

describe('std', () => {
  it('全 0 → 0', () => {
    expect(std(zeros)).toBe(0);
  });

  it('全 100 → 0', () => {
    expect(std(full)).toBe(0);
  });

  it('一半 0 一半 100 → 50', () => {
    const v: DimensionVector = {
      sour: 0, sweet: 0, bitter: 0, spicy: 0,
      salty: 100, rich: 100, crunchy: 100, tender: 100,
    };
    expect(std(v)).toBe(50);
  });
});

describe('cosineSim', () => {
  it('同向量 → 1', () => {
    expect(cosineSim(full, full)).toBeCloseTo(1, 6);
  });

  it('零向量 → 0', () => {
    expect(cosineSim(zeros, zeros)).toBe(0);
    expect(cosineSim(zeros, full)).toBe(0);
  });

  it('正交 → 0', () => {
    const a: DimensionVector = { ...zeros, sour: 100, sweet: 100, bitter: 100, spicy: 100, salty: 0, rich: 0, crunchy: 0, tender: 0 };
    const b: DimensionVector = { ...zeros, sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 100, rich: 100, crunchy: 100, tender: 100 };
    expect(cosineSim(a, b)).toBeCloseTo(0, 6);
  });
});

describe('euclideanDist', () => {
  it('同向量 → 0', () => {
    expect(euclideanDist(full, full)).toBe(0);
  });

  it('全 0 vs 全 100 → sqrt(8)*100', () => {
    expect(euclideanDist(zeros, full)).toBeCloseTo(Math.sqrt(8) * 100, 4);
  });
});
