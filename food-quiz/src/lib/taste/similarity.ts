import type { DimensionVector, TasteDimension } from './types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'temperature', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/** 标准余弦相似度(不去中心化)。 */
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

/** 混合相似度(master plan):0.5·cos + 0.5·1/(1+dist) */
export function blendedScore(a: DimensionVector, b: DimensionVector): number {
  return 0.5 * cosineSim(a, b) + 0.5 * (1 / (1 + euclideanDist(a, b)));
}
