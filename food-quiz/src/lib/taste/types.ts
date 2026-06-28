// 8 维味觉维度（中文：酸甜热辣咸浓脆嫩）
// 字段名一律英文驼峰;顺序与 keys.ts 的 DIMS 严格一致: S T H L I X C N
export type TasteDimension =
  | 'sour'
  | 'sweet'
  | 'temperature'
  | 'spicy'
  | 'salty'
  | 'rich'
  | 'crunchy'
  | 'tender';

/** 8 维向量:归一化后 ∈ [0, 100] */
export type DimensionVector = Record<TasteDimension, number>;

/** 8 维权重向量:原始分,允许负值,允许超过 100 */
export type WeightVector = Record<TasteDimension, number>;

/** 单字母大写集合(从 keys.ts 复用,避免循环 import) */
export type TasteLetter = 'S' | 'T' | 'H' | 'L' | 'I' | 'X' | 'C' | 'N';

/** 单个选项 */
export interface QuizOption {
  /** 唯一 id,全库唯一,推荐 "q1-a" 形式 */
  id: string;
  /** 展示文案(中文) */
  label: string;
  /**
   * 8 维权重向量
   * - 正值:用户选该项时该维度加分
   * - 负值:用户选该项时该维度减分(用于"我讨厌..."的探测与剪枝)
   * - 0:该项不更新该维度
   */
  weights: WeightVector;
}

/** 单道题目 */
export interface QuizQuestion {
  id: string;
  stem: string;
  options: QuizOption[];
  /**
   * 可选:该题主探的字母(1-3 个)
   * - 留空时,出题引擎自动从 options[*].weights 的 top-K 提取
   * - 填写时,优先级高于自动提取
   */
  probeLetters?: TasteLetter[];
  /**
   * 可选:主题标签(1-3 个),点分格式 "大类.具体"(如 "scene.late-night")。
   * - 用于跨 session 主题级去重(B 任务):替失效的 stem 全文聚合(题干 0 重复 → 频次恒 1)。
   * - 大类: ingredient / scene / region / temperature / format / flavor-axis(词表可动态增添)。
   * - schema 只校验结构(1-3、格式、同大类前缀互斥),不锁白名单 —— 加新标签/大类无需改 schema。
   * - 聚合按 topics[0](主标签),优先级 format > flavor-axis > ingredient。
   */
  topics?: string[];
}

/** 题库根结构 */
export interface QuestionBank {
  version: number;
  questions: QuizQuestion[];
}

/** 8 维全 0 向量(工厂,避免外部共享引用被误改) */
export const ZERO_VECTOR: WeightVector = Object.freeze({
  sour: 0,
  sweet: 0,
  temperature: 0,
  spicy: 0,
  salty: 0,
  rich: 0,
  crunchy: 0,
  tender: 0,
}) as WeightVector;

/**
 * 题目犀利度(派生元数据,不入 JSON):
 * - sharp:   2 选项题,选项权重绝对值大(典型 ±70~80),用于精准探测 / 推动剪枝
 * - smooth:  3 或 4 选项题,选项权重绝对值小(典型 ±30~50),用于建立基线
 */
export type Sharpness = 'sharp' | 'smooth';

/** 题目犀利度判定(派生,不入 JSON):2 选项 → sharp,否则 → smooth */
export function sharpnessOf(q: QuizQuestion): Sharpness {
  return q.options.length === 2 ? 'sharp' : 'smooth';
}

/**
 * 饮食忌口(测试前独立步骤探测,影响菜品推荐过滤)。
 * - no-pork:    不吃猪肉
 * - no-beef:    不吃牛肉
 * - no-lamb:    不吃羊肉
 * - no-chicken: 不吃禽肉(鸡/鸭/鹅)
 * - no-seafood: 不吃鱼鲜(鱼/虾蟹等水产)
 * - no-egg:     不吃蛋(禽蛋/蛋清/蛋黄)
 * - no-offal:   不吃内脏(肝/肠/肺/胃/肫/血等)
 * - vegetarian: 素食(仅推 isVegetarian 菜)
 * - halal:      清真(仅推 isHalal 菜)
 */
export type DietaryRestriction =
  | 'no-pork'
  | 'no-beef'
  | 'no-lamb'
  | 'no-chicken'
  | 'no-seafood'
  | 'no-egg'
  | 'no-offal'
  | 'vegetarian'
  | 'halal';
