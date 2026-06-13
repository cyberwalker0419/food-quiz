import { describe, it, expect } from 'vitest';
import { cosineSim, euclideanDist, blendedScore } from './similarity';
import type { DimensionVector } from './types';

const full: DimensionVector = {
  sour: 100, sweet: 100, bitter: 100, spicy: 100,
  salty: 100, rich: 100, crunchy: 100, tender: 100,
};

const zeros: DimensionVector = {
  sour: 0, sweet: 0, bitter: 0, spicy: 0,
  salty: 0, rich: 0, crunchy: 0, tender: 0,
};

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

describe('blendedScore', () => {
  it('同向量 → 接近 0.5·1 + 0.5·1/(1+0) = 1', () => {
    expect(blendedScore(full, full)).toBeCloseTo(1, 6);
  });

  it('零向量 → 0 + 1/(1+0) = 1(全维度距离 = 100,但 cos=0)', () => {
    // 实际上 full vs zeros:cos=0,dist=sqrt(8)*100,score=0 + 0.5·(1/(1+282.8))≈0.0018
    expect(blendedScore(zeros, full)).toBeCloseTo(0.5 * 0 + 0.5 * (1 / (1 + Math.sqrt(8) * 100)), 4);
  });

  it('完全正交 → cos=0,dist=√8·100≈282.8', () => {
    const a: DimensionVector = { ...zeros, sour: 100, sweet: 100, bitter: 100, spicy: 100, salty: 0, rich: 0, crunchy: 0, tender: 0 };
    const b: DimensionVector = { ...zeros, sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 100, rich: 100, crunchy: 100, tender: 100 };
    // cos=0(无公共非零维),dist=√8·100
    expect(blendedScore(a, b)).toBeCloseTo(0.5 * 0 + 0.5 * (1 / (1 + Math.sqrt(8) * 100)), 4);
  });
});
