import type { WeightVector, DimensionVector, TasteLetter, DietaryRestriction } from './types';
import { DIMS, letterToChinese, letterToTierLabel, letterToDim, valueToGrade, type Grade } from './keys';
import { normalize, std } from './normalize';
import { blendedScore } from './similarity';
import {
  loadInterval,
  loadSynergy,
  loadAllround,
  loadDishes,
  type DishEntry,
} from './loaders';

const STD_ALLROUND = 15;        // master §7 全能文案触发
const HIGH_THRESHOLD = 60;      // master §7
const DEFAULT_TOP_N_DISHES = 5;

/** Mulberry32 PRNG(从 adaptiveSelector 复制,避免跨模块依赖)。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===== 渲染数据结构 =====

/**
 * 单维渲染项:雷达图 + 8 维档位明细的数据源。
 * 只保留被消费的字段(letter/value/tierLabel/grade/isHigh);
 * 旧多卡片机制用的 label/copy/index/key 已随重构移除。
 */
export interface RenderedInterval {
  letter: TasteLetter;
  value: number;
  tierLabel: string;
  grade: Grade;
  isHigh: boolean;
}

export interface RenderedSynergy {
  label: string;
  copy: string;
  a: TasteLetter;
  b: TasteLetter;
  source: string;
}

export interface RenderedAllround {
  label: string;
  copy: string;
}

/** 菜系推荐数据 */
export interface RenderedCuisine {
  cuisine: string;
  /** 该菜系 top3 菜(按 blendedScore)均值,范围 (0,1] */
  score: number;
  /** 绝对匹配度百分比 = Math.round(score * 100) */
  percent: number;
  /** 该菜系在池中的总菜数(辅助) */
  dishCount: number;
}

export interface AssembledResult {
  /** 归一化 [0, 100] 后的 8 维向量 */
  vector: DimensionVector;
  /** 原始累加 profile(未归一化) */
  raw: WeightVector;
  /** 8 维标准差 */
  std: number;
  /** 个性头衔:整体组合画像名(如「嗜辣派」「辣咸浓」「味觉全才」),每组合唯一 */
  profileLabel: string;
  /** 一段长综合评价(~100 字整体人格定性;联动信息已并入)。allround 分支下 UI 走 allround,此字段仍生成备分享卡之外的场景使用 */
  profileCopy: string;
  /** 全 8 维(按 |value-50| 降序;雷达图 + 8 维明细的数据源) */
  allIntervals: RenderedInterval[];
  /** 联动文案(仅 Top1 + Top2 都 > 60 触发);UI 已并入 profileCopy,字段保留供内部/分享卡 */
  synergy: RenderedSynergy | null;
  /** 全能文案(std < 15 触发,独立分支) */
  allround: RenderedAllround | null;
  /** 推荐菜 */
  topDishes: DishEntry[];
  /** 推荐菜系 */
  topCuisines: RenderedCuisine[];
  /** 8 维档位标签,供雷达图轴标注 */
  tierLabels: Record<TasteLetter, string>;
}

// ===== 长评价素材池(humanizer-zh 润色) =====
// 两套句池按高档维度数分桶 + index 散列选取:
//   - SCENE:吃饭场景句(无联动时填补,使段落成 3 句)
//   - TAIL :口味态度收尾句
// 都不点维度名,只写场景/态度;"清淡型/适中型/重口型"各自落到气质相符的句子。

const SCENE_LIGHT = [ // highCount <= 1:清淡 / 单一突出
  '下馆子你也不爱点大菜，一份顺口的就够',
  '你吃饭图省心，调料堆太狠的菜反倒把你绕晕',
  '外卖翻半天，最后点的还是那几样老菜',
  '别人研究新店，你认准家门口那家懒得换',
];
const SCENE_MID = [ // highCount 2-3
  '工作日你吃得随便，周末才想整点重的',
  '朋友问吃什么，你张口就能报出菜名',
  '不是什么都吃，但合你口的那几道绝不凑合',
  '冰箱里常备你的招牌食材，饿了随时开火',
];
const SCENE_HEAVY = [ // highCount >= 4
  '一桌菜你恨不得每样都夹两筷子，单吃一道你觉得亏',
  '重油重辣的馆子你最熟，清淡的你记不住几家',
  '夜宵摊是你的主场，烤串小龙虾越晚越精神',
  '出门吃饭你专挑味重的店，白水煮的你坐不住',
];

const TAIL_LIGHT = [
  '说到底，你对吃的不较真，但合胃口的那几样，你认得死死的',
  '花里胡哨的菜你反倒吃不惯，一碗热汤下肚就踏实',
  '外食也好家里也好，你要的从来就是个舒服',
  '你的舌头不刁，但凡对上味的，你能记很久',
];
const TAIL_MID = [
  '点菜你心里有谱，不该上的绝不多嘴',
  '对味的多吃两口，不对味的碰都不碰，你这人干脆',
  '你不跟风点网红菜，吃的就是自己那套准',
  '味道上的事你有脾气，但不折腾',
];
const TAIL_HEAVY = [
  '说白了，凑合的饭局你宁可饿着回家煮面',
  '桌上味道越杂你越来劲，单打独斗的菜你觉得没劲',
  '酸甜冷热辣咸你都接得住，换个人早受不了',
  '你这嘴惯得刁，糊弄不过去，得有真东西才咽得下',
];

/** highCount → 气质桶(scene 池, tail 池) */
function pickBuckets(highCount: number): { scene: readonly string[]; tail: readonly string[] } {
  if (highCount <= 1) return { scene: SCENE_LIGHT, tail: TAIL_LIGHT };
  if (highCount <= 3) return { scene: SCENE_MID, tail: TAIL_MID };
  return { scene: SCENE_HEAVY, tail: TAIL_HEAVY };
}

/**
 * 拼装一段整体人格定性长评价(~80–100 字)。
 * = 整体组合画像 + 中段(联动浓缩句,否则吃饭场景句) + 口味态度收尾;不逐维罗列。
 * 各素材均已 humanize;中段与收尾按 highCount 分桶、用不同散列独立选取,避免撞同一句。
 */
function buildProfileCopy(
  overallCopy: string,
  synergyCopy: string | null,
  highCount: number,
  hash: number,
): string {
  const { scene, tail } = pickBuckets(highCount);
  const parts: string[] = [];
  if (overallCopy) parts.push(overallCopy);
  // 中段:有联动用联动浓缩句,否则用场景句补足(保证段落始终 3 句)
  parts.push(synergyCopy ?? scene[Math.abs(hash) % scene.length]!);
  parts.push(tail[Math.abs(hash >> 3) % tail.length]!);
  return parts.filter(Boolean).join('。') + '。';
}

// ===== 工具 =====

/** Top 1 + Top 2 是否都 > HIGH_THRESHOLD(60) */
function pickTop2High(v: DimensionVector): { a: TasteLetter; b: TasteLetter } | null {
  const sorted = DIMS
    .map((letter) => ({ letter: letter as TasteLetter, value: v[letterToDim(letter as TasteLetter)] }))
    .sort((x, y) => y.value - x.value);
  const top1 = sorted[0]!;
  const top2 = sorted[1]!;
  if (top1.value <= HIGH_THRESHOLD || top2.value <= HIGH_THRESHOLD) return null;
  return { a: top1.letter, b: top2.letter };
}

/** 从 copy 数组里随机选 1 条;copy 是字符串则原样返回 */
function pickOne(copy: readonly string[] | string | undefined): string {
  if (Array.isArray(copy)) {
    if (copy.length === 0) return '';
    return copy[Math.floor(Math.random() * copy.length)]!;
  }
  if (typeof copy === 'string') return copy;
  return '';
}

/**
 * 忌口过滤(纯函数,可独立单测):菜品是否满足**全部**忌口(交集)。
 * - 空限制数组 → true(无忌口)
 * - 每条 restriction 都必须通过,任一不满足 → false
 * - no-egg/no-offal:对应标记 === true 即排除(未标记者放行)
 * - vegetarian/halal:要求对应标记严格 === true(未标记者不放行)
 */
export function passesDietary(d: DishEntry, restrictions: DietaryRestriction[]): boolean {
  if (!restrictions || restrictions.length === 0) return true;
  const mt = d.meatTypes ?? [];
  for (const r of restrictions) {
    switch (r) {
      case 'no-pork':
        if (mt.includes('pork')) return false;
        break;
      case 'no-beef':
        if (mt.includes('beef')) return false;
        break;
      case 'no-lamb':
        if (mt.includes('lamb')) return false;
        break;
      case 'no-chicken':
        if (mt.includes('chicken')) return false;
        break;
      case 'no-seafood':
        if (mt.includes('fish') || mt.includes('seafood')) return false;
        break;
      case 'no-egg':
        if (d.isContainsEgg === true) return false;
        break;
      case 'no-offal':
        if (d.isOffal === true) return false;
        break;
      case 'vegetarian':
        if (d.isVegetarian !== true) return false;
        break;
      case 'halal':
        if (d.isHalal !== true) return false;
        break;
    }
  }
  return true;
}

// ===== 主入口 =====

/**
 * 8 维归一化向量 → 完整渲染结构。
 *
 * 文案形态(重构后):「味觉特征」是一段 ~100 字长综合评价(profileCopy),
 * 由整体组合画像 + 联动浓缩 + 口气质收尾拼成,不再逐维罗列卡片。
 * - 任一文案/菜品模块缺失 → 该字段为 null/空数组,**不抛错**。
 */
export function assembleResult(
  raw: WeightVector,
  options?: { topNDishes?: number; maxAbs?: number; seed?: number; dietary?: DietaryRestriction[] },
): AssembledResult {
  const topNDishes = options?.topNDishes ?? DEFAULT_TOP_N_DISHES;
  const rng = options?.seed !== undefined ? mulberry32(options.seed) : Math.random;

  const v = normalize(raw, options?.maxAbs);
  const s = std(v);

  // 8 维档位标签
  const tierLabels = {} as Record<TasteLetter, string>;
  for (const l of DIMS) {
    const letter = l as TasteLetter;
    tierLabels[letter] = letterToTierLabel(letter, v[letterToDim(letter)]);
  }

  // 8 个字母位是否高档(决定 256 组合 index)
  const isHighBit: boolean[] = DIMS.map((l) => v[letterToDim(l as TasteLetter)] > HIGH_THRESHOLD);
  const intervalIndex = parseInt(isHighBit.map((b) => (b ? '1' : '0')).join(''), 2);
  const highCount = isHighBit.filter(Boolean).length;

  // 整体组合画像(已 humanize 的 intervals/<index>.json)
  const overallEntry = loadInterval(intervalIndex);
  const overallLabel = overallEntry?.label ?? '味觉画像';
  const overallCopy = overallEntry?.copy ?? '你的口味在各种味道之间自成一格';

  // allIntervals:全 8 维,按 |value-50| 降序(雷达图 + 8 维明细数据源)
  const allIntervals: RenderedInterval[] = DIMS
    .map((l, i) => ({
      letter: l as TasteLetter,
      value: v[letterToDim(l as TasteLetter)],
      isHigh: isHighBit[i]!,
    }))
    .sort((x, y) => Math.abs(y.value - 50) - Math.abs(x.value - 50))
    .map(({ letter, value, isHigh }) => ({
      letter,
      value,
      tierLabel: tierLabels[letter]!,
      grade: valueToGrade(value),
      isHigh,
    }));

  // synergy(Top1 + Top2 都 > 60 才触发);其 copy 并入 profileCopy
  let synergy: RenderedSynergy | null = null;
  let synergyCopyForProfile: string | null = null;
  const top2 = pickTop2High(v);
  if (top2) {
    const entry = loadSynergy(top2.a, top2.b);
    const source = entry.letters ? `${entry.letters.join('-').toLowerCase()}.json` : '_fallback.json';
    let copy = pickOne(entry.copy);
    if (entry.template) {
      const aName = letterToChinese(top2.a);
      const bName = letterToChinese(top2.b);
      copy = entry.template.replace(/\{a\}/g, aName).replace(/\{b\}/g, bName);
    }
    synergy = { label: entry.label, copy, a: top2.a, b: top2.b, source };
    synergyCopyForProfile = copy;
  }

  // allround(std < 15,独立分支)
  let allround: RenderedAllround | null = null;
  if (s < STD_ALLROUND) {
    const entry = loadAllround();
    if (entry) allround = { label: entry.label, copy: pickOne(entry.copy) };
  }

  // 一段长综合评价
  const profileCopy = buildProfileCopy(overallCopy, synergyCopyForProfile, highCount, intervalIndex);

  // topDishes(匹配池内加权随机抽样,同 seed 确定性)
  let topDishes: DishEntry[] = [];
  let topCuisines: RenderedCuisine[] = [];
  const dishes = loadDishes();
  if (dishes) {
    const popular = dishes.filter((d) => d.popular !== false);
    // 忌口过滤(交集:每条都满足);过滤后过少则回退 popular,保证总有推荐
    const dietary = options?.dietary ?? [];
    let pool0 = popular;
    if (dietary.length > 0) {
      const filtered = popular.filter((d) => passesDietary(d, dietary));
      if (filtered.length >= topNDishes + 2) pool0 = filtered;
    }
    const scored = pool0.map((d) => ({ d, score: blendedScore(v, d.vector) }));
    scored.sort((a, b) => b.score - a.score);
    const topScore = scored[0]?.score ?? 0;
    const MATCH_RATIO = 0.6;
    let pool = scored.filter((p) => p.score >= topScore * MATCH_RATIO);
    if (pool.length < topNDishes) pool = scored;
    const seenNames = new Set<string>();
    const remaining = pool.slice();
    while (topDishes.length < topNDishes && remaining.length > 0) {
      const weights = remaining.map((p) => Math.max(0.001, p.score) ** 2);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      let pickedIdx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i]!;
        if (r <= 0) { pickedIdx = i; break; }
      }
      const picked = remaining.splice(pickedIdx, 1)[0]!;
      if (seenNames.has(picked.d.name)) continue;
      seenNames.add(picked.d.name);
      topDishes.push(picked.d);
    }

    // 菜系推荐:每菜系取 top3(按 blendedScore)均值作绝对匹配度,大菜系不被不匹配菜拉低
    const cuisineScores: Record<string, number[]> = {};
    for (const { d, score } of scored) {
      const c = d.cuisine;
      if (!cuisineScores[c]) cuisineScores[c] = [];
      cuisineScores[c].push(score); // scored 已降序,前 3 即该菜系最高分
    }
    topCuisines = Object.entries(cuisineScores)
      .map(([cuisine, scores]) => {
        const top3 = scores.slice(0, 3);
        const avg = top3.reduce((a, b) => a + b, 0) / top3.length;
        return {
          cuisine,
          score: avg,
          percent: Math.round(avg * 100),
          dishCount: scores.length,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  return {
    vector: v,
    raw,
    std: s,
    profileLabel: overallLabel,
    profileCopy,
    allIntervals,
    synergy,
    allround,
    topDishes,
    topCuisines: topCuisines ?? [],
    tierLabels,
  };
}
