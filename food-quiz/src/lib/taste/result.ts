/**
 * Phase 2 临时适配层:把新 8 维向量(WeightVector)与旧 cuisines.ts 数据互通。
 * 旧 cuisines.ts 用 FlavorProfile(spicy/umami/sweet/sour/crunchy/tender/intense/light),
 * 新 8 维(酸甜苦辣咸浓脆嫩)无 intense/light,umami 已重命名为 rich。
 *
 * 真实"菜品推荐"将在 Phase 5 引入独立 dishes.json 后替换本模块。
 * 旧 cuisines.ts 整体在 P5 同步删除。
 */
import type { WeightVector } from './types';
import { normalize, cosineSim, euclideanDist } from './normalize';
import type { DimensionVector } from './types';
import { cuisines, type Cuisine, type FlavorProfile } from '../../data/cuisines';

/** 新 8 维 WeightVector → 旧 8 维 FlavorProfile(用于 ranking)。
 *  旧系统无 bitter/salty,新系统无 intense/light → 两者取并集为 10 维时填 0。
 */
export function toFlavorProfile(v: WeightVector): FlavorProfile {
  return {
    sour: v.sour,
    sweet: v.sweet,
    spicy: v.spicy,
    umami: v.rich, // umami → rich
    crunchy: v.crunchy,
    tender: v.tender,
    intense: 0,
    light: 0,
  };
}

/** 把 cuisines 的 profile 视作 WeightVector(umami → rich,intense/light 丢弃)。 */
function cuisineToWeightVector(c: Cuisine): WeightVector {
  return {
    sour: c.profile.sour,
    sweet: c.profile.sweet,
    bitter: 0, // 旧系统无 bitter
    spicy: c.profile.spicy,
    salty: 0, // 旧系统无 salty
    rich: c.profile.umami,
    crunchy: c.profile.crunchy,
    tender: c.profile.tender,
  };
}

/**
 * 混合相似度(master plan):Score = 0.5 · cosineSim + 0.5 · 1/(1+eucDist)
 * 沿用 Pearson 时代"向量化匹配"的精神,但用新引擎的归一化 + 余弦 + 欧氏距离。
 */
export function rankCuisines(profile: WeightVector): { cuisine: Cuisine; score: number }[] {
  const v = normalize(profile);
  return cuisines
    .map((c) => {
      const cv = normalize(cuisineToWeightVector(c));
      const cos = cosineSim(v, cv);
      const dist = euclideanDist(v, cv);
      const score = 0.5 * cos + 0.5 * (1 / (1 + dist));
      return { cuisine: c, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** 取主结果。 */
export function pickPrimary(profile: WeightVector): Cuisine | null {
  return rankCuisines(profile)[0]?.cuisine ?? null;
}

/** 取次结果(剔除主结果,取下 3 个)。 */
export function pickSecondary(profile: WeightVector, primary: Cuisine | null): Cuisine[] {
  const out: Cuisine[] = [];
  for (const { cuisine } of rankCuisines(profile)) {
    if (primary && cuisine.name === primary.name) continue;
    out.push(cuisine);
    if (out.length >= 3) break;
  }
  return out;
}

/** 用于结果页"按 value 排序的 top 3 维度"。返回 8 维。 */
export function topFlavors(profile: WeightVector, n: number = 3): { key: keyof DimensionVector; label: string; value: number }[] {
  const v = normalize(profile);
  const LABELS: Record<keyof DimensionVector, string> = {
    sour: '酸度', sweet: '甜度', bitter: '苦度', spicy: '辣度',
    salty: '咸度', rich: '浓(鲜)度', crunchy: '脆度', tender: '嫩度',
  };
  return (Object.keys(v) as (keyof DimensionVector)[])
    .map((k) => ({ key: k, label: LABELS[k], value: v[k] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}