import type { DimensionVector, WeightVector, TasteDimension } from './types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/**
 * 8 维原始权重 → [0, 100] 归一化向量。
 * 算法:对每维 raw_k,按 max(|raw|) 缩放后线性映射到 [0, 100],中点 50。
 * - raw =  maxAbs → v = 100
 * - raw = -maxAbs → v = 0
 * - raw = 0       → v = 50
 * 单测覆盖边界;P3 高档(> 60)能正确触发。
 */
export function normalize(raw: WeightVector, maxAbs?: number): DimensionVector {
  const m =
    maxAbs ??
    Math.max(1, ...DIMS.map((d) => Math.abs(raw[d] || 0)));
  const out = {} as DimensionVector;
  for (const d of DIMS) {
    const v = 50 + (50 * (raw[d] || 0)) / m;
    out[d] = Math.max(0, Math.min(100, v));
  }
  return out;
}

/** 8 维向量标准差(总体标准差,除以 N)。用于 P3 全能文案判定(std < 15)。 */
export function std(vec: DimensionVector): number {
  const values = DIMS.map((d) => vec[d]);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// similarity 函数在 P3 拆出,本文件 re-export 保持向后兼容
export { cosineSim, euclideanDist, blendedScore } from './similarity';
