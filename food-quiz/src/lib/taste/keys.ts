import type { TasteDimension, TasteLetter } from './types';

/**
 * 8 维单字母常量(顺序固定,不可重排)
 * - S = 酸 sour
 * - T = 甜 sweet
 * - H = 热 temperature(上桌冷热)
 * - L = 辣 spicy
 * - I = 咸 salty   (第 2 字母,因「浓」占 X 让位)
 * - X = 浓 rich
 * - C = 脆 crunchy
 * - N = 嫩 tender
 */
export const DIMS = ['S', 'T', 'H', 'L', 'I', 'X', 'C', 'N'] as const satisfies readonly TasteLetter[];

/** 8 维顺序的英文字段名,与 DIMS 一一对应 */
export const DIM_FIELDS = [
  'sour',
  'sweet',
  'temperature',
  'spicy',
  'salty',
  'rich',
  'crunchy',
  'tender',
] as const satisfies readonly TasteDimension[];

/** 8 维顺序的中文名,与 DIMS 一一对应;第 6 位为「浓」 */
export const DIM_CHINESE = ['酸', '甜', '热', '辣', '咸', '浓', '脆', '嫩'] as const;

/** 单字母 → 英文驼峰字段名 */
export function letterToDim(letter: TasteLetter): TasteDimension {
  const idx = DIMS.indexOf(letter);
  if (idx < 0) throw new Error(`Unknown letter: ${letter}`);
  return DIM_FIELDS[idx];
}

/** 单字母 → 中文名(供结果页和模板占位符 {a} {b} 使用) */
export function letterToChinese(letter: TasteLetter): string {
  const idx = DIMS.indexOf(letter);
  if (idx < 0) throw new Error(`Unknown letter: ${letter}`);
  return DIM_CHINESE[idx];
}

/** 英文字段名 → 单字母 */
export function dimToLetter(dim: TasteDimension): TasteLetter {
  const idx = DIM_FIELDS.indexOf(dim);
  if (idx < 0) throw new Error(`Unknown dim: ${dim}`);
  return DIMS[idx];
}

/**
 * 8 字符索引串 → 3 位十进制序号
 * 大写→1,小写→0,S T H L I X C N 顺序对应 bit7..bit0
 * 例:"StHliXcN" → S(1) t(0) H(1) l(0) i(0) X(1) c(0) N(1) → 0b10100101 = 165
 */
export function keyToIndex(key: string): number {
  if (key.length !== 8) throw new Error(`key length must be 8, got ${key.length}: ${key}`);
  for (const c of key) {
    const upper = c.toUpperCase();
    if (!DIMS.includes(upper as TasteLetter)) {
      throw new Error(`Invalid char in key: ${c}`);
    }
  }
  return parseInt(
    key
      .split('')
      .map((c) => (c === c.toUpperCase() ? '1' : '0'))
      .join(''),
    2
  );
}

/** 3 位十进制序号 → 8 字符索引串 */
export function indexToKey(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 255) {
    throw new Error(`index must be integer 0..255, got ${index}`);
  }
  return DIMS.map((c, i) => ((index >> (7 - i)) & 1 ? c : c.toLowerCase())).join('');
}

/** 把字母按键值大小写归一化:大写=高,小写=低 */
export function isHigh(letter: string): boolean {
  return letter === letter.toUpperCase();
}

/**
 * 两档中文渲染标签(原三档中的极档已合并入高档,文案不再区分)。
 * - 除「浓」维外:低档 = 低<中文名>,高档 = 重<中文名>
 * - 「浓」维(letter = X):低档 = 清淡,高档 = 浓
 * - 「热」维(letter = H):三档平分单字 — 凉(<33) / 温(33≤x<66) / 烫(≥66)
 * - score 阈值(非 H/X 维): ≤ 60 低档, > 60 高档
 *
 * 注:本函数与 valueToGrade 互不替换,前者驱动文案选择,
 * 后者仅用于雷达 / bar / 徽章颜色(五等级 A/B/C/D/E)。
 * 温度维三档切点(33/66)与底层 interval 选文件统一 60 阈值(bit5)不同,
 * "温"档横跨 60 切点属正常(显示层与选文件层解耦)。
 */
export function letterToTierLabel(letter: TasteLetter, score: number): string {
  if (!Number.isFinite(score)) {
    throw new Error(`score must be a finite number, got ${score}`);
  }
  if (letter === 'H') {
    if (score >= 66) return '烫';
    if (score >= 33) return '温';
    return '凉';
  }
  const isX = letter === 'X';
  if (score > 60) {
    return isX ? '浓' : `重${letterToChinese(letter)}`;
  }
  return isX ? '清淡' : `低${letterToChinese(letter)}`;
}

/**
 * 五等级视觉档位(A/B/C/D/E,每档 20 分)。
 * 仅用于"8 维图视觉层"(雷达 / bar / 数值标注),**不**取代低/重文案触发。
 *
 * 阈值(归一化后 [0, 100]):
 * | 档 | 区间        | 含义       |
 * |:--:|:----------:|:----------|
 * | A  | [80, 100]  | 顶档       |
 * | B  | [60, 80)   | 高         |
 * | C  | [40, 60)   | 中         |
 * | D  | [20, 40)   | 低         |
 * | E  | [0, 20)    | 底档       |
 *
 * 注:本函数与 letterToTierLabel 互不替换,二者并行存在。
 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export function valueToGrade(value: number): Grade {
  if (!Number.isFinite(value)) {
    throw new Error(`value must be a finite number, got ${value}`);
  }
  if (value >= 80) return 'A';
  if (value >= 60) return 'B';
  if (value >= 40) return 'C';
  if (value >= 20) return 'D';
  return 'E';
}
