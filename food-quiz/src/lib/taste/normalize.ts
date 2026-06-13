import type { DimensionVector, WeightVector, TasteDimension } from './types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/**
 * 8 维原始权重 → [0, 100] 归一化向量。
 * 算法:对每维 raw_k,先按 max(|raw|) 缩放,再 clip 到 [0, 100]。
 * 负值不会"被吃掉":raw 越负,目标值越接近 0(raw 越正越接近 100)。
 * 这是简化版 Min-Max,单测覆盖边界。
 */
export function normalize(raw: WeightVector, maxAbs?: number): DimensionVector {
  const m =
    maxAbs ??
    Math.max(1, ...DIMS.map((d) => Math.abs(raw[d] || 0)));
  const out = {} as DimensionVector;
  for (const d of DIMS) {
    const v = 50 + (25 * (raw[d] || 0)) / m;
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

/** 标准余弦相似度(不去中心化)。所有 dim ∈ [0, 100],自动非负。 */
export function cosineSim(a: DimensionVector, b: DimensionVector): number {
  let dot = 0, magA = 0, magB = 0;
  for (const d of DIMS) {
    dot += a[d] * b[d];
    magA += a[d] * a[d];
    magB += b[d] * b[d];
  }
  const denom = Math.sqrt(magA * magB);
  if (denom < 1e-9) return 0;
  return dot / denom;
}

/** 欧氏距离。 */
export function euclideanDist(a: DimensionVector, b: DimensionVector): number {
  let s = 0;
  for (const d of DIMS) {
    const diff = a[d] - b[d];
    s += diff * diff;
  }
  return Math.sqrt(s);
}
