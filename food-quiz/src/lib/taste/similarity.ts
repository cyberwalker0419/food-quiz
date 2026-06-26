import type { DimensionVector, TasteDimension } from './types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'bitter', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

/** 标准余弦相似度(不去中心化)。保留供画像评估/选题 closestTo 用(不改,避免污染问题一)。 */
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

/**
 * 去中心化余弦:先减 8 维均值再算余弦。值 [-1,1]。
 * 问题二:标准余弦对全正 [0,100] 归一化向量天然 0.9+(全正象限夹角小),压缩画像差异。
 * 减均值后向量围绕 0 有正有负,夹角反映真实"形状差异"。常数向量(无形状)→ 0。
 */
export function centeredCosineSim(a: DimensionVector, b: DimensionVector): number {
  const n = DIMS.length;
  let meanA = 0, meanB = 0;
  for (const d of DIMS) { meanA += a[d]; meanB += b[d]; }
  meanA /= n; meanB /= n;
  let dot = 0, magA = 0, magB = 0;
  for (const d of DIMS) {
    const da = a[d] - meanA;
    const db = b[d] - meanB;
    dot += da * db;
    magA += da * da;
    magB += db * db;
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

/**
 * 混合相似度(master plan):0.5·cos + 0.5·1/(1+dist)。
 * 问题二:cos 项改用去中心化余弦(映射 [0,1] 保非负),让推荐菜/菜系匹配按"形状差异"
 * 而非"都正"排序——大菜系(川菜)不再凭全正压缩对各画像虚高,小菜系特色菜能突围。
 */
export function blendedScore(a: DimensionVector, b: DimensionVector): number {
  const cos = (centeredCosineSim(a, b) + 1) / 2;
  return 0.5 * cos + 0.5 * (1 / (1 + euclideanDist(a, b)));
}
