import { describe, it, expect } from 'vitest';
import { cosineSim, centeredCosineSim, euclideanDist, blendedScore } from './similarity';
import type { DimensionVector } from './types';

const full: DimensionVector = {
  sour: 100, sweet: 100, temperature: 100, spicy: 100,
  salty: 100, rich: 100, crunchy: 100, tender: 100,
};

const zeros: DimensionVector = {
  sour: 0, sweet: 0, temperature: 0, spicy: 0,
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
    const a: DimensionVector = { ...zeros, sour: 100, sweet: 100, temperature: 100, spicy: 100, salty: 0, rich: 0, crunchy: 0, tender: 0 };
    const b: DimensionVector = { ...zeros, sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 100, rich: 100, crunchy: 100, tender: 100 };
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

describe('centeredCosineSim(去中心化余弦)', () => {
  it('同形状非常数向量 → 1', () => {
    const a: DimensionVector = { ...zeros, sour: 100 };
    expect(centeredCosineSim(a, a)).toBeCloseTo(1, 6);
  });

  it('常数向量(无形状)→ 0(full=[100]×8 减均值=0)', () => {
    expect(centeredCosineSim(full, full)).toBe(0);
  });

  it('形状相反(此 4 维高 vs 彼 4 维高)→ -1', () => {
    const a: DimensionVector = { ...zeros, sour: 100, sweet: 100, temperature: 100, spicy: 100 };
    const b: DimensionVector = { ...zeros, salty: 100, rich: 100, crunchy: 100, tender: 100 };
    expect(centeredCosineSim(a, b)).toBeCloseTo(-1, 6);
  });

  it('解决全正压缩:不同维突出,标准 cos 高但去中心化低(区分力)', () => {
    // sour 突出 vs sweet 突出,其余 50:标准 cos ≈0.91(全正压缩),去中心化 <0(有区分)
    const a: DimensionVector = { sour: 100, sweet: 50, temperature: 50, spicy: 50, salty: 50, rich: 50, crunchy: 50, tender: 50 };
    const b: DimensionVector = { sour: 50, sweet: 100, temperature: 50, spicy: 50, salty: 50, rich: 50, crunchy: 50, tender: 50 };
    expect(cosineSim(a, b)).toBeGreaterThan(0.8);       // 标准 cos 仍压缩
    expect(centeredCosineSim(a, b)).toBeLessThan(0.5);  // 去中心化有区分
  });
});

describe('blendedScore(cos 项去中心化 + 距离项归一化,均映射 [0,1])', () => {
  it('同常数向量(full)→ cos 项 0.5 + dist 项 1 = 0.75', () => {
    expect(blendedScore(full, full)).toBeCloseTo(0.75, 2);
  });

  it('zeros vs full(均常数)→ cos 项 0.5 + dist 项 0(最大距离归一化为 0) = 0.25', () => {
    expect(blendedScore(zeros, full)).toBeCloseTo(0.25, 4);
  });

  it('形状相反 → 去中心化 cos=-1 映射 0;距离最大归一化 0 → blended=0', () => {
    const a: DimensionVector = { ...zeros, sour: 100, sweet: 100, temperature: 100, spicy: 100 };
    const b: DimensionVector = { ...zeros, salty: 100, rich: 100, crunchy: 100, tender: 100 };
    expect(blendedScore(a, b)).toBeCloseTo(0, 4);
  });
});
