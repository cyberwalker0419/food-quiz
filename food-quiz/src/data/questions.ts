// Flavor dimensions: spicy, umami, sweet, sour, crunchy, tender, intense, light
// Each option adds weighted values to these dimensions

export type FlavorKey = 'spicy' | 'umami' | 'sweet' | 'sour' | 'crunchy' | 'tender' | 'intense' | 'light';

type Option = {
  text: string;
  emoji: string;
  flavors: Record<FlavorKey, number>;
  scene?: { social: number; lively: number; share: number }; // dining format matching (optional)
  // Optional: explicitly tag which flavor profile this option leans toward
  // Used by the adaptive question selector for "追问" (follow-up) behavior
  leans?: Partial<Record<FlavorKey, number>>;
};

export type QuestionCategory =
  | 'daily'        // 日常口味
  | 'mood'         // 情绪与场景
  | 'texture'      // 口感与质地
  | 'adventure'    // 食物冒险
  | 'ingredient'   // 食材偏好
  | 'sensory'      // 感官体验
  | 'social'       // 社交与场景
  | 'culture'      // 民族文化
  | 'culture-deep'// 深度对决
  | 'final';       // 终极二选一

export type Question = {
  id: number;
  question: string;
  options: Option[];
  version: 'full' | 'quick'; // 'quick' means included in the 30-question version
  weight: number; // weight multiplier (1=normal, 2=high weight for final questions)
  category: QuestionCategory;
  // Tags used by the adaptive selector to decide when to surface this question
  // as a follow-up to the user's prior answers.
  tags?: {
    // Triggered when the cumulative flavor profile passes these thresholds
    triggers?: Partial<Record<FlavorKey, number>>;
    // Triggered when the user picks a particular cuisine cluster (mood-based follow-ups)
    mood?: ('celebration' | 'comfort' | 'explore' | 'indulge' | 'social' | 'romance' | 'family')[];
  };
  // If true, this question is guaranteed to appear once in the full run
  // (used for breadth coverage)
  essential?: boolean;
};

export const questions: Question[] = [
  // ═══════════════════════════════════════════
  // 维度1：日常口味偏好 (8题)
  // ═══════════════════════════════════════════

  {
    id: 1,
    category: 'daily',
    question: '中午肚子咕咕叫了，你最想吃什么？',
    options: [
      { text: '来碗麻辣火锅，辣到出汗才过瘾', emoji: '🍲', flavors: { spicy: 3, umami: 1, sweet: 0, sour: 0, crunchy: 0, tender: 1, intense: 3, light: -2 }, scene: { social: 3, lively: 3, share: 3 } },
      { text: '精致早茶，虾饺烧卖慢慢点', emoji: '🥟', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 0, crunchy: 1, tender: 3, intense: -2, light: 3 }, scene: { social: 2, lively: 1, share: 2 } },
      { text: '酸辣米线或者螺蛳粉，开胃！', emoji: '🍜', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 3, crunchy: 1, tender: 1, intense: 2, light: -2 }, scene: { social: 1, lively: 2, share: 0 } },
      { text: '来份清淡的蒸菜配粥，舒服最重要', emoji: '🍚', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 1, crunchy: 0, tender: 2, intense: -3, light: 3 }, scene: { social: 0, lively: 0, share: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 2,
    category: 'daily',
    question: '下午茶甜品时间，你的灵魂选择是？',
    options: [
      { text: '辣味巧克力，甜中带辣的奇妙碰撞', emoji: '🍫', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 1, crunchy: 1, tender: 1, intense: 3, light: -1 }, scene: { social: 1, lively: 1, share: 0 } },
      { text: '芒果糯米饭/杨枝甘露，甜而不腻', emoji: '🥭', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 2, crunchy: 2, tender: 3, intense: -1, light: 1 }, scene: { social: 1, lively: 1, share: 0 } },
      { text: '抹茶冰糕，抹茶控的极致体验', emoji: '🍰', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 1 }, scene: { social: 1, lively: 0, share: 0 } },
      { text: '红糖糍粑，外酥里糯刚刚好', emoji: '🍡', flavors: { spicy: 0, umami: 1, sweet: 3, sour: 0, crunchy: 3, tender: 2, intense: 0, light: -1 }, scene: { social: 1, lively: 2, share: 1 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 3,
    category: 'daily',
    question: '深夜饥肠辘辘，谁在召唤你？',
    options: [
      { text: '烧烤配啤酒，羊肉串小腰来一串', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 0, crunchy: 3, tender: 2, intense: 3, light: -3 }, scene: { social: 3, lively: 3, share: 3 } },
      { text: '一碗热腾腾的拉面，深夜治愈', emoji: '🍜', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 2, light: 0 }, scene: { social: 1, lively: 0, share: 0 } },
      { text: '螺蛳粉！越夜越精神，酸笋加双倍', emoji: '🍲', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 4, crunchy: 2, tender: 1, intense: 3, light: -3 }, scene: { social: 1, lively: 2, share: 0 } },
      { text: '白粥配小菜，养胃第一名', emoji: '🥣', flavors: { spicy: 0, umami: 1, sweet: 1, sour: 1, crunchy: 0, tender: 2, intense: -4, light: 4 }, scene: { social: 0, lively: 0, share: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 4,
    category: 'daily',
    question: '朋友约你周末聚餐，你第一个想到哪？',
    options: [
      { text: '火锅局！毛肚鸭肠黄喉安排上', emoji: '🫕', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -2 }, scene: { social: 4, lively: 4, share: 4 } },
      { text: '广式早茶店，虾饺烧卖慢慢点', emoji: '🥟', flavors: { spicy: 0, umami: 4, sweet: 0, sour: 2, crunchy: 2, tender: 4, intense: -3, light: 4 }, scene: { social: 2, lively: 0, share: 1 } },
      { text: '大排档，烤翅炒蛏子啤酒走起', emoji: '🍻', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -2 }, scene: { social: 3, lively: 4, share: 3 } },
      { text: '高端私房菜，仪式感拉满', emoji: '🍷', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 0, light: 2 }, scene: { social: 2, lively: 0, share: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 5,
    category: 'daily',
    question: '一个人独处时，最可能吃什么？',
    options: [
      { text: '一碗螺蛳粉，一个人也要酸辣过瘾', emoji: '🍜', flavors: { spicy: 3, umami: 2, sweet: 1, sour: 4, crunchy: 2, tender: 0, intense: 3, light: -3 }, scene: { social: 0, lively: 0, share: 0 } },
      { text: '一碗中式汤面，呼噜呼噜吃完', emoji: '🍜', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 2 }, scene: { social: 0, lively: 0, share: 0 } },
      { text: '随便点份盖浇饭，吃饱就行', emoji: '🍛', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 0, crunchy: 1, tender: 2, intense: 0, light: 0 } },
      { text: '外卖拼盘，饺子凉皮卤味各来点', emoji: '🥗', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 4, tender: 3, intense: -2, light: 3 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 6,
    category: 'daily',
    question: '大热天出汗的时候，你最想喝什么配什么？',
    options: [
      { text: '冰镇酸梅汤配凉拌菜，酸辣开胃', emoji: '🥤', flavors: { spicy: 1, umami: 0, sweet: 2, sour: 4, crunchy: 3, tender: 0, intense: 0, light: 2 } },
      { text: '绿豆汤配白切鸡，清凉解暑', emoji: '🍵', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 0, tender: 3, intense: -3, light: 4 } },
      { text: '冰啤酒配辣炒花甲，来点刺激的', emoji: '🍺', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 2, crunchy: 2, tender: 2, intense: 3, light: -2 } },
      { text: '椰汁配椰子鸡，热带风味降降温', emoji: '🥥', flavors: { spicy: 0, umami: 3, sweet: 3, sour: 2, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 7,
    category: 'daily',
    question: '冬天冷得瑟瑟发抖，什么最能温暖你？',
    options: [
      { text: '麻辣火锅，越辣越暖，汗都出来了', emoji: '🫕', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 4, light: -3 } },
      { text: '羊肉汤配饼，从头暖到脚', emoji: '🍲', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 2, light: 0 } },
      { text: '烤红薯+热奶茶，甜暖治愈', emoji: '🍠', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 0, crunchy: 3, tender: 1, intense: -1, light: 1 } },
      { text: '砂锅菜，咕嘟咕嘟冒热气', emoji: '🥘', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 8,
    category: 'daily',
    question: '如果一周七天可以吃不同菜系，你会怎么选？',
    options: [
      { text: '每天麻辣火锅不重样，辣就完事了', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 4, light: -3 } },
      { text: '每天都有新花样，川粤鲁苏轮流来', emoji: '🌍', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 1, light: 1 } },
      { text: '家常菜最实在，妈妈的味道', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '按心情来，开心吃辣难过吃甜', emoji: '🎭', flavors: { spicy: 2, umami: 2, sweet: 3, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'quick',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度2：味道探索 (8题)
  // ═══════════════════════════════════════════

  {
    id: 9,
    category: 'daily',
    question: '餐厅里你第一个看什么？',
    options: [
      { text: '辣度等级，无辣不欢的我直奔川菜区', emoji: '🌶️', flavors: { spicy: 4, umami: 1, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 3, light: -2 } },
      { text: '有没有当季海鲜，鲜字当头', emoji: '🦞', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 3 } },
      { text: '招牌甜口菜，有没有糖醋红烧', emoji: '🍖', flavors: { spicy: 0, umami: 2, sweet: 4, sour: 2, crunchy: 2, tender: 2, intense: 1, light: -1 } },
      { text: '酸味菜品，开胃的来一份', emoji: '🍋', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 4, crunchy: 2, tender: 2, intense: 0, light: 1 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 10,
    category: 'daily',
    question: '走进厨房，你的第一反应是加什么？',
    options: [
      { text: '辣椒辣椒辣椒！多放花椒更带劲', emoji: '🌶️', flavors: { spicy: 4, umami: 1, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 4, light: -3 } },
      { text: '葱姜蒜爆锅，香才是灵魂', emoji: '🧄', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 1, intense: 3, light: -1 } },
      { text: '酱油白糖，糖色一上立马有那味了', emoji: '🍶', flavors: { spicy: 0, umami: 3, sweet: 4, sour: 1, crunchy: 1, tender: 2, intense: 1, light: -1 } },
      { text: '醋！出锅前淋一圈，酸香提味', emoji: '🫗', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 4, crunchy: 1, tender: 2, intense: 0, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 11,
    category: 'ingredient',
    question: '食材选购时你最先逛哪一区？',
    options: [
      { text: '海鲜水产区，鲜活最重要', emoji: '🐟', flavors: { spicy: 0, umami: 4, sweet: 0, sour: 1, crunchy: 2, tender: 4, intense: -2, light: 3 } },
      { text: '牛羊肉区，大块吃肉最爽', emoji: '🥩', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 3, light: -1 } },
      { text: '蔬菜水果区，应季新鲜来一把', emoji: '🥬', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 2, crunchy: 4, tender: 2, intense: -3, light: 4 } },
      { text: '干货调料区，香料菌菇样样来', emoji: '🍄', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 2, crunchy: 3, tender: 1, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 12,
    category: 'daily',
    question: '吃饭的时候，你是汤派还是干派？',
    options: [
      { text: '无汤不欢，来碗汤才完整', emoji: '🍲', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 2, crunchy: 0, tender: 3, intense: 1, light: 2 } },
      { text: '干锅/炒类最好，有镬气才香', emoji: '🍳', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -2 } },
      { text: '半汤半干刚刚好，拉面盖饭型', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '凉拌菜最清爽，不用汤不用炒', emoji: '🥗', flavors: { spicy: 0, umami: 1, sweet: 1, sour: 3, crunchy: 4, tender: 2, intense: -3, light: 4 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 13,
    category: 'daily',
    question: '主食怎么选？灵魂主食是？',
    options: [
      { text: '白米饭！什么菜都能配', emoji: '🍚', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 0, crunchy: 0, tender: 2, intense: 0, light: 1 } },
      { text: '面条/粉！嗦一口才叫过瘾', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 0 } },
      { text: '饼/馒头！裹着菜吃太爽了', emoji: '🫓', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 3, tender: 1, intense: 0, light: 0 } },
      { text: '米饭面条都不如一块面包', emoji: '🍞', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 1, crunchy: 3, tender: 2, intense: -1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 14,
    category: 'texture',
    question: '炒菜你喜欢什么火候？',
    options: [
      { text: '大火猛炒！镬气要足，焦香才是王道', emoji: '🔥', flavors: { spicy: 1, umami: 3, sweet: 0, sour: 0, crunchy: 4, tender: 1, intense: 4, light: -3 } },
      { text: '小火慢炖，入味才是硬道理', emoji: '🍲', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 1, crunchy: 0, tender: 4, intense: 2, light: -1 } },
      { text: '白灼/清蒸，食材够鲜就不需要火候', emoji: '🥩', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: -3, light: 4 } },
      { text: '油炸！金黄酥脆才叫满足', emoji: '🍤', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 0, crunchy: 5, tender: 1, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 15,
    category: 'ingredient',
    question: '说到鲜味，你最爱的味道是？',
    options: [
      { text: '浓汤的鲜，炖了几个小时的牛骨汤', emoji: '🥣', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 0, crunchy: 0, tender: 3, intense: 2, light: 0 } },
      { text: '海鲜的鲜，刚从海里捞上来的', emoji: '🦐', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 3 } },
      { text: '发酵的鲜，腐乳腊肉泡菜那个味儿', emoji: '🫙', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 3, crunchy: 3, tender: 1, intense: 3, light: -1 } },
      { text: '菌菇的鲜，森林里摘来的山珍', emoji: '🍄', flavors: { spicy: 0, umami: 5, sweet: 2, sour: 1, crunchy: 3, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 16,
    category: 'texture',
    question: '你更偏爱哪种口感？',
    options: [
      { text: '脆！脆皮鸡、炸酥肉、凉拌藕片', emoji: '🥓', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 5, tender: 1, intense: 1, light: -1 } },
      { text: '嫩！豆腐脑、蛋羹、滑蛋牛肉', emoji: '🥚', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 0, tender: 5, intense: -2, light: 3 } },
      { text: '糯！年糕、汤圆、糯米鸡', emoji: '🍡', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 1, tender: 4, intense: -1, light: 0 } },
      { text: '筋道！手擀面、拉面、驴打滚', emoji: '🍜', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 3, tender: 2, intense: 0, light: 0 } },
    ],
    version: 'quick',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度3：场景心情 (8题)
  // ═══════════════════════════════════════════

  {
    id: 17,
    category: 'mood',
    question: '今天升职加薪了，你怎么犒劳自己？',
    options: [
      { text: '请一帮兄弟吃火锅，不醉不归', emoji: '🎉', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 4, light: -3 } },
      { text: '给自己点个顶级海鲜拼盘（大虾/生蚝/扇贝）', emoji: '🦐', flavors: { spicy: 0, umami: 5, sweet: 0, sour: 1, crunchy: 2, tender: 4, intense: -3, light: 4 } },
      { text: '去那家想了很久的米其林餐厅', emoji: '⭐', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 0, light: 1 } },
      { text: '路边摊，大排档，接地气才爽', emoji: '🏮', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -2 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 18,
    category: 'mood',
    question: '失恋了，谁来治愈你的胃？',
    options: [
      { text: '辣到哭才好，辣椒炒一切，辣完就忘了', emoji: '😭🌶️', flavors: { spicy: 4, umami: 1, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 4, light: -3 } },
      { text: '甜的！巧克力蛋糕冰淇淋，甜能治愈一切', emoji: '🍦', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -2, light: 1 } },
      { text: '热汤面，妈妈的味道，暖胃暖心', emoji: '🍜', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 0, tender: 3, intense: 0, light: 3 } },
      { text: '酒精+炸鸡，先睡了明天再说', emoji: '🍗🍺', flavors: { spicy: 1, umami: 3, sweet: 0, sour: 0, crunchy: 3, tender: 1, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 19,
    category: 'mood',
    question: '第一次约会，你带TA去哪吃？',
    options: [
      { text: '精致中餐，蜡烛红酒玫瑰花瓣', emoji: '🕯️', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 0, light: 1 } },
      { text: '私房菜小馆，安静聊天的地方', emoji: '🥘', flavors: { spicy: 0, umami: 5, sweet: 0, sour: 1, crunchy: 2, tender: 4, intense: -2, light: 3 } },
      { text: '一起做饭！情侣厨房甜蜜暴击', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '火锅！虽然会弄花妆，但开心最重要', emoji: '🫕', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 20,
    category: 'social',
    question: '带外地朋友来你的城市，你请TA吃什么？',
    options: [
      { text: '本地最经典的招牌菜，必须骄傲', emoji: '🏆', flavors: { spicy: 2, umami: 4, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '街角不起眼但好吃到飞起的小店', emoji: '🏚️', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 2, crunchy: 2, tender: 1, intense: 3, light: -1 } },
      { text: '网红打卡餐厅，发朋友圈素材+美食', emoji: '📸', flavors: { spicy: 1, umami: 3, sweet: 3, sour: 1, crunchy: 3, tender: 2, intense: 0, light: 1 } },
      { text: '带TA去菜市场，逛吃逛吃最实在', emoji: '🛒', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 3, crunchy: 4, tender: 2, intense: 1, light: 0 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 21,
    category: 'mood',
    question: '过生日，你的愿望是？',
    options: [
      { text: '蛋糕要大！奶油要厚！蜡烛要多！', emoji: '🎂', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: 0, light: 0 } },
      { text: '火锅局！所有朋友围坐一桌', emoji: '🫕', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 4, light: -3 } },
      { text: '家宴，奶奶的手艺，温馨感动', emoji: '👨‍👩‍👧‍👦', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '去一家从没吃过的异国料理', emoji: '✈️', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 2, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 22,
    category: 'mood',
    question: '下雨天窝在家里，你会？',
    options: [
      { text: '煮一锅火锅底料冒菜，追剧配零食', emoji: '📺🍲', flavors: { spicy: 3, umami: 2, sweet: 1, sour: 0, crunchy: 2, tender: 2, intense: 3, light: -2 } },
      { text: '泡一杯热可可配曲奇，文艺青年', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 3, tender: 2, intense: -3, light: 2 } },
      { text: '点个外卖，螺蛳粉+冰可乐', emoji: '🥤', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 3, crunchy: 2, tender: 1, intense: 2, light: -1 } },
      { text: '好好做顿饭，仪式感不能少', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 23,
    category: 'social',
    question: '参加婚礼，最期待哪道菜？',
    options: [
      { text: '龙虾鲍鱼大虾，海鲜全来了！', emoji: '🦞', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: 0, light: 2 } },
      { text: '红烧肉肘子，硬菜才是婚礼的灵魂', emoji: '🍖', flavors: { spicy: 1, umami: 3, sweet: 3, sour: 1, crunchy: 2, tender: 3, intense: 2, light: -1 } },
      { text: '精致的甜品台，每一道都是艺术品', emoji: '🧁', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 1, crunchy: 2, tender: 3, intense: -3, light: 1 } },
      { text: '凉菜拼盘开胃前菜，先吃为敬', emoji: '🥗', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 3, crunchy: 4, tender: 2, intense: -2, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 24,
    category: 'mood',
    question: '考试/面试前，你最想吃什么求好运？',
    options: [
      { text: '全鱼！年年有余，顺顺利利', emoji: '🐟', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 2 } },
      { text: '面条！长长久久，思维通畅', emoji: '🍜', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 1 } },
      { text: '棒棒糖！甜甜蜜利，旗开得胜', emoji: '🍭', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 2, intense: -3, light: 0 } },
      { text: '辣椒炒肉！红红火火，冲就完了', emoji: '🌶️🍖', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 0, crunchy: 2, tender: 2, intense: 4, light: -2 } },
    ],
    version: 'full',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度4：食物冒险 (8题)
  // ═══════════════════════════════════════════

  {
    id: 25,
    category: 'adventure',
    question: '去云贵旅行，你敢尝试生皮/生肉/酸汤吗？',
    options: [
      { text: '必须！白族生皮蘸料，云南的豪迈', emoji: '🍖', flavors: { spicy: 3, umami: 2, sweet: 1, sour: 2, crunchy: 1, tender: 2, intense: 3, light: -1 } },
      { text: '可以试试但只吃熟食，先做攻略', emoji: '🥄', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 2, crunchy: 1, tender: 2, intense: 2, light: 0 } },
      { text: '太怪了不习惯，还是吃米线吧', emoji: '🍜', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: -2, light: 2 } },
      { text: '我带了自己的老干妈！全国通用', emoji: '🌶️', flavors: { spicy: 3, umami: 2, sweet: 1, sour: 0, crunchy: 1, tender: 1, intense: 3, light: -2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 26,
    category: 'adventure',
    question: '有人说折耳根（鱼腥草）好吃，你怎么看？',
    options: [
      { text: '折耳根yyds！蘸水里面不能没有它', emoji: '🌿', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 2, crunchy: 4, tender: 2, intense: 3, light: 0 } },
      { text: '可以接受，凉拌折耳根挺开胃', emoji: '🥗', flavors: { spicy: 1, umami: 1, sweet: 1, sour: 3, crunchy: 4, tender: 2, intense: 1, light: 1 } },
      { text: '味道有点怪，但还是想挑战一下', emoji: '🤔', flavors: { spicy: 1, umami: 1, sweet: 1, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 0 } },
      { text: '达咩！这味道我是永远接受不了的', emoji: '🙅', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: -2, light: 2 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 27,
    category: 'adventure',
    question: '旅行中你遇到一种没见过的食材，你会？',
    options: [
      { text: '拍照+下单！不吃不知道味道多丰富', emoji: '📷', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 2, light: 0 } },
      { text: '问问当地人推荐怎么做好吃', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '找连锁店吃安全的，别冒险', emoji: '🏪', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 1 } },
      { text: '虽然好奇但不吃奇怪的东西', emoji: '🚫', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 28,
    category: 'adventure',
    question: '你最敢接受的辣度是？',
    options: [
      { text: '四川红油/贵州糊辣椒，辣到流泪', emoji: '🌶️🌶️🌶️', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 1, crunchy: 1, tender: 1, intense: 5, light: -4 } },
      { text: '微辣就够了，但可以接受香辣', emoji: '🌶️', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: -1 } },
      { text: '不要辣！但辣味菜品会点微辣试试', emoji: '🫣', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 } },
      { text: '完全不吃辣，甜口党永远忠诚', emoji: '🍯', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 1, crunchy: 2, tender: 3, intense: -3, light: 2 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 29,
    category: 'ingredient',
    question: '云南野生菌季到了，你？',
    options: [
      { text: '马上飞昆明！见手青牛肝菌来一锅', emoji: '🍄', flavors: { spicy: 1, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 3, intense: 2, light: 1 } },
      { text: '可以但是得确认煮熟了才吃（狗头）', emoji: '🐕', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '太危险了，我吃普通的蘑菇就好了', emoji: '🍄', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 } },
      { text: '只敢吃超市买的平菇金针菇', emoji: '🛒', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: -3, light: 3 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 30,
    category: 'adventure',
    question: '如果有一种食物能让你走遍中国，你选？',
    options: [
      { text: '烤串！东北街头的烟火气', emoji: '🍢', flavors: { spicy: 4, umami: 3, sweet: 2, sour: 3, crunchy: 4, tender: 2, intense: 3, light: -1 } },
      { text: '淮扬菜！江南的极简美学', emoji: '🥬', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 4, intense: -2, light: 4 } },
      { text: '川菜！麻辣的香料魔法', emoji: '🌶️', flavors: { spicy: 4, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 4, light: -1 } },
      { text: '中餐！饺子火锅包子什么都行', emoji: '🥟', flavors: { spicy: 2, umami: 4, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 31,
    category: 'adventure',
    question: '你敢尝活章鱼吗？',
    options: [
      { text: '来一份！口感滑溜又Q弹，太刺激了', emoji: '🐙', flavors: { spicy: 0, umami: 5, sweet: 0, sour: 2, crunchy: 3, tender: 5, intense: 2, light: 1 } },
      { text: '想想就好，我更喜欢熟的海鲜', emoji: '🦀', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 1 } },
      { text: '生食有风险，我选醉虾级别', emoji: '🍤', flavors: { spicy: 0, umami: 5, sweet: 0, sour: 1, crunchy: 1, tender: 5, intense: -1, light: 3 } },
      { text: '别说了，我连生蚝都不敢吃', emoji: '🚫', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -3, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 32,
    category: 'daily',
    question: '你最喜欢的早餐风味？',
    options: [
      { text: '肉夹馍+羊肉泡馍，西安风味来一碗', emoji: '🫓', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 3, tender: 3, intense: 2, light: 0 } },
      { text: '豆浆油条，中国胃最踏实的开场', emoji: '🥛', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 1, crunchy: 3, tender: 2, intense: -1, light: 1 } },
      { text: '班尼迪克蛋+咖啡，brunch仪式感', emoji: '🍳', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 1 } },
      { text: '可颂+热巧克力，巴黎的早晨', emoji: '🥐', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 0, crunchy: 4, tender: 2, intense: -2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度5：感官体验 (7题)
  // ═══════════════════════════════════════════

  {
    id: 33,
    category: 'sensory',
    question: '如果食物有颜色，你最爱哪种？',
    options: [
      { text: '红！红油火锅红辣椒红亮亮的酱', emoji: '🔴', flavors: { spicy: 4, umami: 2, sweet: 1, sour: 0, crunchy: 1, tender: 1, intense: 4, light: -3 } },
      { text: '白！白切鸡白粥白玉菇的纯净', emoji: '⚪', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: -3, light: 4 } },
      { text: '绿！翡翠般的青菜和抹茶', emoji: '🟢', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 2, crunchy: 4, tender: 2, intense: -2, light: 3 } },
      { text: '金！金黄酥脆的炸物色香味', emoji: '🟡', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 0, crunchy: 5, tender: 1, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 34,
    category: 'sensory',
    question: '你吃饭时最在意的感官体验是？',
    options: [
      { text: '口感层次！又脆又嫩又糯又滑', emoji: '🎵', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 2, crunchy: 4, tender: 4, intense: 1, light: 0 } },
      { text: '香味！还没吃就馋得不行', emoji: '👃', flavors: { spicy: 2, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '颜值！拍照好看是第一位', emoji: '📱', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 1, crunchy: 3, tender: 3, intense: -1, light: 1 } },
      { text: '热度！刚出锅的镬气最迷人', emoji: '♨️', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 35,
    category: 'sensory',
    question: '什么味道会立刻勾起你的食欲？',
    options: [
      { text: '花椒的麻，闻到就走不动路', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 4, light: -2 } },
      { text: '刚出炉的面包香，碳水天堂', emoji: '🍞', flavors: { spicy: 0, umami: 1, sweet: 3, sour: 0, crunchy: 3, tender: 2, intense: -1, light: 0 } },
      { text: '酸笋的酸爽，臭但上头', emoji: '🍜', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 5, crunchy: 2, tender: 1, intense: 4, light: -2 } },
      { text: '烤肉的烟熏味，灵魂级别的诱惑', emoji: '🥩', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: 4, light: -2 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 36,
    category: 'social',
    question: '吃饭的时候你习惯什么环境音？',
    options: [
      { text: '热闹！餐馆里人声鼎沸最有气氛', emoji: '🗣️', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 0, crunchy: 2, tender: 1, intense: 3, light: -2 } },
      { text: '安静！专心品尝每一口', emoji: '🤫', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 4, intense: -3, light: 4 } },
      { text: '放音乐！爵士乐配红酒牛排', emoji: '🎷', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 1 } },
      { text: '路边摊的吆喝声，烟火人间', emoji: '📣', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 37,
    category: 'sensory',
    question: '你更偏爱热的还是凉的？',
    options: [
      { text: '必须是热的！刚出锅的灵魂', emoji: '♨️', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 0, crunchy: 2, tender: 2, intense: 2, light: -1 } },
      { text: '冰的更好！冰镇饮料配一切', emoji: '🧊', flavors: { spicy: 1, umami: 1, sweet: 2, sour: 3, crunchy: 2, tender: 2, intense: -1, light: 2 } },
      { text: '常温最好，不烫不冰刚刚好', emoji: '🌡️', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 1 } },
      { text: '看心情，夏天冰冬天热', emoji: '🎭', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 1, light: 0 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 38,
    category: 'sensory',
    question: '你相信"色香味"里颜值最重要吗？',
    options: [
      { text: '颜值即正义！不好看的东西不想吃', emoji: '👁️', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 1, crunchy: 3, tender: 3, intense: -1, light: 1 } },
      { text: '味道才是根本，卖相第二', emoji: '👅', flavors: { spicy: 2, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 3, light: 0 } },
      { text: '都要！好看又好吃才是完美的', emoji: '✨', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 1, light: 0 } },
      { text: '好吃就行，奶奶做的最朴素也最棒', emoji: '👵', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 39,
    category: 'texture',
    question: '你心目中的"完美口感"是？',
    options: [
      { text: '外酥里嫩！炸鸡、锅包肉那种', emoji: '🍗', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 0, crunchy: 5, tender: 4, intense: 2, light: -1 } },
      { text: '入口即化！红烧肉炖到那个程度', emoji: '🥩', flavors: { spicy: 0, umami: 4, sweet: 3, sour: 1, crunchy: 0, tender: 5, intense: 1, light: 0 } },
      { text: '弹牙有嚼劲！手打虾滑、鱼丸', emoji: '🦐', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 3, tender: 3, intense: 1, light: 0 } },
      { text: '绵密细腻！像冰淇淋、芋泥那样', emoji: '🍠', flavors: { spicy: 0, umami: 2, sweet: 4, sour: 0, crunchy: 1, tender: 4, intense: -2, light: 1 } },
    ],
    version: 'quick',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度6：终极选择 — 二选一决战 (7题)
  // ═══════════════════════════════════════════

  {
    id: 40,
    category: 'final',
    question: '终极对决！麻婆豆腐 vs 红烧肉，选谁？',
    options: [
      { text: '麻婆豆腐！麻辣鲜香下饭神器', emoji: '🌶️', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 4, light: -2 } },
      { text: '红烧肉！肥而不腻甜咸交织', emoji: '🍖', flavors: { spicy: 0, umami: 3, sweet: 4, sour: 1, crunchy: 1, tender: 4, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 41,
    category: 'final',
    question: '终极对决！海鲜大餐 vs 烤肉盛宴？',
    options: [
      { text: '海鲜！清蒸大虾生蚝扇贝', emoji: '🦞', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 4 } },
      { text: '烤肉！炭火滋滋响的幸福感', emoji: '🥩', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 4, light: -2 } },
    ],
    version: 'quick',
    weight: 2,
  },
  {
    id: 42,
    category: 'final',
    question: '终极对决！火锅 vs 烧烤？',
    options: [
      { text: '火锅！一锅煮天下，围炉而坐', emoji: '🫕', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -2 } },
      { text: '烧烤！炭火串烧自由翻转', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 3, light: -2 } },
    ],
    version: 'quick',
    weight: 2,
  },
  {
    id: 43,
    category: 'final',
    question: '终极对决！粤式精致 vs 北方豪放？',
    options: [
      { text: '粤式早茶！一笼一笼的仪式感', emoji: '🥟', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 4, intense: -3, light: 4 } },
      { text: '中餐！八大菜系百家风味', emoji: '🏮', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 2, light: 0 } },
    ],
    version: 'quick',
    weight: 2,
  },
  {
    id: 44,
    category: 'final',
    question: '终极对决！酸辣 vs 甜咸？',
    options: [
      { text: '酸辣！川黔风味永远的神', emoji: '🍜', flavors: { spicy: 3, umami: 2, sweet: 1, sour: 4, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '甜咸！糖醋排骨红烧肉yyds', emoji: '🍖', flavors: { spicy: 0, umami: 3, sweet: 5, sour: 2, crunchy: 1, tender: 3, intense: 2, light: -1 } },
    ],
    version: 'quick',
    weight: 2,
  },
  {
    id: 45,
    category: 'final',
    question: '终极对决！麻辣火锅 vs 贵州酸汤锅？',
    options: [
      { text: '麻辣火锅！中国胃的终极答案', emoji: '🌶️', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 5, light: -3 } },
      { text: '贵州酸汤锅！苗家米酸开胃', emoji: '🍋', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 5, crunchy: 1, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 46,
    category: 'final',
    question: '终极对决！云南菌菇火锅 vs 四川牛油火锅？',
    options: [
      { text: '云南菌子锅！山珍的鲜美太纯粹', emoji: '🍄', flavors: { spicy: 1, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 3, intense: 2, light: 2 } },
      { text: '四川牛油锅！辣到飞起的快乐', emoji: '🐂', flavors: { spicy: 5, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 5, light: -3 } },
    ],
    version: 'quick',
    weight: 2,
  },

  // ═══════════════════════════════════════════
  // 维度7：民族文化探索 (7题)
  // ═══════════════════════════════════════════

  {
    id: 47,
    category: 'culture',
    question: '你去过或最想去体验哪个民族的美食文化？',
    options: [
      { text: '云南傣族！菠萝饭手抓饭太诱人了', emoji: '🌴', flavors: { spicy: 2, umami: 3, sweet: 3, sour: 3, crunchy: 3, tender: 2, intense: 1, light: 1 } },
      { text: '新疆维吾尔族！烤肉抓饭馕坑肉', emoji: '🐑', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: 2, light: -1 } },
      { text: '贵州苗侗族！酸汤鱼糯米饭', emoji: '🐟', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 5, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '西藏藏族！酥油茶糌粑藏香猪', emoji: '🏔️', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 48,
    category: 'culture',
    question: '以下哪种地方小吃最吸引你？',
    options: [
      { text: '桂林米粉，卤水浇头灵魂所在', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '兰州牛肉面，一清二白三红四绿', emoji: '🍜', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 2, light: -1 } },
      { text: '长沙臭豆腐，闻着臭吃着香', emoji: '🟫', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 2, crunchy: 4, tender: 1, intense: 3, light: -2 } },
      { text: '西安肉夹馍+冰峰，西北硬货', emoji: '🫓', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 3, tender: 3, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 49,
    category: 'culture',
    question: '哪种非遗美食传统让你心动？',
    options: [
      { text: '广东早茶一盅两件，叹早茶', emoji: '🫖', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 0, crunchy: 2, tender: 3, intense: -2, light: 3 } },
      { text: '扬州炒饭的刀工，丁丁匀匀', emoji: '🍚', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 3, tender: 2, intense: 0, light: 1 } },
      { text: '四川泡菜坛子，世代传承的味道', emoji: '🫙', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 5, crunchy: 4, tender: 1, intense: 2, light: -1 } },
      { text: '北京烤鸭，果木炭火片鸭皮', emoji: '🦆', flavors: { spicy: 0, umami: 4, sweet: 3, sour: 1, crunchy: 3, tender: 3, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 50,
    category: 'culture',
    question: '你最想尝试哪条美食路线？',
    options: [
      { text: '沿着丝绸之路：西安→兰州→敦煌→喀什', emoji: '🏜️', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 3, tender: 3, intense: 2, light: 0 } },
      { text: '沿海美食之旅：大连→青岛→厦门→三亚', emoji: '🌊', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 2, crunchy: 3, tender: 4, intense: -1, light: 3 } },
      { text: '西南民族之旅：成都→昆明→贵阳→西江', emoji: '🏔️', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 4, crunchy: 3, tender: 2, intense: 3, light: -1 } },
      { text: '江南水乡之旅：苏州→杭州→绍兴→南京', emoji: '🛶', flavors: { spicy: 0, umami: 3, sweet: 4, sour: 2, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 51,
    category: 'culture',
    question: '哪种饮食仪式感最能打动你？',
    options: [
      { text: '围炉煮茶，炭火慢煨的慢生活', emoji: '🍵', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 0, crunchy: 1, tender: 2, intense: -2, light: 3 } },
      { text: '蒙古祭火烤全羊，草原豪迈', emoji: '🐑', flavors: { spicy: 1, umami: 4, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 4, light: -2 } },
      { text: '广式功夫茶配潮汕牛肉火锅，匠心慢食', emoji: '🍵', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 4, intense: -3, light: 4 } },
      { text: '贵州酸汤煮沸，一锅沸腾的家乡味', emoji: '🍲', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 5, crunchy: 2, tender: 2, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 52,
    category: 'culture',
    question: '你最想挑战哪种少数民族特色食物？',
    options: [
      { text: '哈尼族梯田鱼，稻田里养出来的鲜', emoji: '🐟', flavors: { spicy: 1, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '回族手抓羊肉，原汁原味的草原肉', emoji: '🐑', flavors: { spicy: 1, umami: 4, sweet: 0, sour: 0, crunchy: 2, tender: 4, intense: 2, light: 0 } },
      { text: '白族三道茶，一苦二甜三回味', emoji: '🍵', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 1, crunchy: 1, tender: 2, intense: 1, light: 2 } },
      { text: '蒙古族奶食（奶豆腐奶皮子）', emoji: '🥛', flavors: { spicy: 0, umami: 3, sweet: 3, sour: 2, crunchy: 2, tender: 3, intense: 0, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 53,
    category: 'culture',
    question: '你相信"一方水土养一方人"的饮食观吗？',
    options: [
      { text: '深信！地理气候决定了一切口味偏好', emoji: '🗺️', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '有一定道理，但人也可以突破地域口味', emoji: '🌍', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '我更信"跟着心情走"，开心吃什么', emoji: '💃', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '我只吃妈妈做的菜，那就是最好的', emoji: '👩‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度8：用餐形式 (7题)
  // ═══════════════════════════════════════════

  {
    id: 54,
    category: 'social',
    question: '你最喜欢的聚餐方式是？',
    options: [
      { text: '火锅局！大家围坐一锅，涮什么都开心', emoji: '🫕', flavors: { spicy: 3, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -2 }, scene: { social: 4, lively: 4, share: 4 } },
      { text: '烧烤摊！自己翻串自己蘸料，自由', emoji: '🍢', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 3, light: -2 }, scene: { social: 3, lively: 4, share: 3 } },
      { text: '家庭聚餐！围坐圆桌，共享一道道菜', emoji: '👨‍👩‍👧‍👦', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 0 }, scene: { social: 4, lively: 2, share: 4 } },
      { text: '一个人吃饭，安静享受一个人的时光', emoji: '🍱', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -2, light: 3 }, scene: { social: 0, lively: 0, share: 0 } },
    ],
    version: 'quick',
    weight: 1,
  },
  {
    id: 55,
    category: 'social',
    question: '点菜时你在餐厅里扮演什么角色？',
    options: [
      { text: '点菜大王！所有人忌口我都记得', emoji: '📋', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 }, scene: { social: 4, lively: 2, share: 3 } },
      { text: '看心情点！今天想吃啥点啥', emoji: '🎯', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 }, scene: { social: 1, lively: 2, share: 0 } },
      { text: '让朋友们先点，我随便', emoji: '🤷', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 1 }, scene: { social: 3, lively: 1, share: 2 } },
      { text: '直接来套餐！不想思考太累了', emoji: '🍱', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 0, crunchy: 2, tender: 2, intense: -2, light: 1 }, scene: { social: 0, lively: 1, share: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 56,
    category: 'social',
    question: '分享美食这件事，你怎么看？',
    options: [
      { text: '不分享算什么吃饭！大家分着吃才热闹', emoji: '🍽️', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: -1 }, scene: { social: 4, lively: 3, share: 4 } },
      { text: '各吃各的比较卫生，AA制最公平', emoji: '💳', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 1 }, scene: { social: 0, lively: 0, share: 0 } },
      { text: '我请客！但你们随便点，我埋单', emoji: '💝', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 }, scene: { social: 3, lively: 2, share: 3 } },
      { text: '分享可以，但别动我碗里的！', emoji: '😤', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: -1 }, scene: { social: 2, lively: 3, share: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 57,
    category: 'social',
    question: '你理想中的用餐环境？',
    options: [
      { text: '江边/山顶露天，边吃边看风景', emoji: '🌄', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 2 }, scene: { social: 2, lively: 2, share: 2 } },
      { text: '热闹的大排档，烟火气最抚人心', emoji: '🏮', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -2 }, scene: { social: 3, lively: 4, share: 3 } },
      { text: '安静的高级餐厅，灯光刚刚好', emoji: '🕯️', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: -2, light: 3 }, scene: { social: 2, lively: 0, share: 0 } },
      { text: '家里厨房餐桌，最舒服的地方', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 }, scene: { social: 2, lively: 1, share: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 58,
    category: 'social',
    question: '吃饭时你在干嘛？',
    options: [
      { text: '边吃边聊！不说话这顿饭白吃了', emoji: '💬', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: -1 }, scene: { social: 4, lively: 3, share: 3 } },
      { text: '看剧/刷手机，电子榨菜不可少', emoji: '📱', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: -1, light: 1 }, scene: { social: 0, lively: 0, share: 0 } },
      { text: '专心吃饭！品味每一口食物的美好', emoji: '🧘', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: -2, light: 3 }, scene: { social: 0, lively: 0, share: 0 } },
      { text: '和朋友划拳喝酒！不醉不归', emoji: '🍻', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 4, light: -2 }, scene: { social: 4, lively: 4, share: 3 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 59,
    category: 'social',
    question: '你带别人去探店时是怎样的？',
    options: [
      { text: '打卡网红餐厅，排队两小时也值得', emoji: '📸', flavors: { spicy: 1, umami: 2, sweet: 3, sour: 1, crunchy: 3, tender: 2, intense: 0, light: 1 }, scene: { social: 3, lively: 2, share: 2 } },
      { text: '街边老店！当地人排队的那家', emoji: '🏚️', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 }, scene: { social: 2, lively: 3, share: 2 } },
      { text: '老字号！传承几十年的味道最靠谱', emoji: '🏛️', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '随便一家看起来顺眼的，冒险精神', emoji: '🎲', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 60,
    category: 'social',
    question: '你心目中"最好的饭"是和谁一起吃？',
    options: [
      { text: '和最好的朋友们，吵闹但温暖', emoji: '👫', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: -1 }, scene: { social: 4, lively: 4, share: 3 } },
      { text: '和家人，最踏实最安心的味道', emoji: '👨‍👩‍👧‍👦', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 1 }, scene: { social: 3, lively: 2, share: 3 } },
      { text: '和爱人，浪漫烛光晚餐', emoji: '💑', flavors: { spicy: 0, umami: 3, sweet: 3, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 1 }, scene: { social: 2, lively: 0, share: 0 } },
      { text: '一个人吃最舒服，不用迁就别人', emoji: '🧑', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 }, scene: { social: 0, lively: 0, share: 0 } },
    ],
    version: 'quick',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度9：深度对决 (10题)
  // ═══════════════════════════════════════════

  {
    id: 61,
    category: 'culture-deep',
    question: '你更偏爱哪种"鲜"？',
    options: [
      { text: '海洋的鲜：海鱼、海虾、海蛎子', emoji: '🌊', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 4 } },
      { text: '山野的鲜：松茸、鸡枞菌、竹荪', emoji: '🍄', flavors: { spicy: 1, umami: 5, sweet: 1, sour: 2, crunchy: 3, tender: 3, intense: 2, light: 1 } },
      { text: '时间的鲜：腊肉、腐乳、泡菜', emoji: '🫙', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 4, crunchy: 3, tender: 1, intense: 3, light: -1 } },
      { text: '鲜不重要，够味才是王道', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 5, light: -3 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 62,
    category: 'culture-deep',
    question: '如果让你只用一种调料形容自己，你是？',
    options: [
      { text: '辣椒油！火辣、热情、不可一世', emoji: '🌶️', flavors: { spicy: 5, umami: 1, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 5, light: -3 } },
      { text: '生抽！不抢戏但每一道菜都离不开', emoji: '🫗', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 0, tender: 3, intense: 0, light: 1 } },
      { text: '醋！酸酸甜甜，有点小个性', emoji: '🍋', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 5, crunchy: 2, tender: 2, intense: 1, light: 1 } },
      { text: '白砂糖！甜是我对世界最大的温柔', emoji: '🍯', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -3, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 63,
    category: 'culture-deep',
    question: '你吃饭像什么风格的艺术家？',
    options: [
      { text: '毕加索！热烈奔放，色彩爆炸', emoji: '🎨', flavors: { spicy: 4, umami: 2, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 4, light: -2 } },
      { text: '莫奈！温柔水彩，光影朦胧', emoji: '🌸', flavors: { spicy: 0, umami: 3, sweet: 3, sour: 2, crunchy: 2, tender: 3, intense: -1, light: 3 } },
      { text: '草间弥生！重复、无限、专注', emoji: '🔴', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 3, tender: 3, intense: 1, light: 0 } },
      { text: '巴斯奎特！野性、原始、不羁', emoji: '🔥', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 5, light: -2 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 64,
    category: 'culture-deep',
    question: '你的味蕾是什么性格？',
    options: [
      { text: '社交达人！什么口味都能融入', emoji: '🤝', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '固执己见！就爱那口家乡味', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 1 } },
      { text: '冒险家！没吃过的都要试试', emoji: '🧭', flavors: { spicy: 3, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 3, light: 0 } },
      { text: '美食洁癖！不好吃的坚决不吃', emoji: '🧐', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 65,
    category: 'culture-deep',
    question: '选一个代表你的美食emoji组合？',
    options: [
      { text: '🌶️🌶️🌶️ — 没有辣椒活不了', emoji: '🌶️', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 5, light: -3 } },
      { text: '🍣🍵🌸 — 简约到极致', emoji: '🍣', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 4, intense: -3, light: 4 } },
      { text: '🥘🧄🫓 — 香料与面食的浪漫', emoji: '🧆', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 2, crunchy: 4, tender: 2, intense: 3, light: 0 } },
      { text: '🍛🥥🌴 — 热带椰风咸香', emoji: '🥥', flavors: { spicy: 3, umami: 4, sweet: 3, sour: 3, crunchy: 2, tender: 3, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 66,
    category: 'culture-deep',
    question: '如果美食是一种运动，你选？',
    options: [
      { text: '拳击！正面硬刚，辣的猛的来', emoji: '🥊', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 0, crunchy: 2, tender: 1, intense: 5, light: -3 } },
      { text: '瑜伽！轻盈、平衡、身心合一', emoji: '🧘', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: -3, light: 4 } },
      { text: '登山！挑战自我，攀登美食高峰', emoji: '🏔️', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 0 } },
      { text: '冲浪！随波逐流，哪里有浪去哪里', emoji: '🏄', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 67,
    category: 'culture-deep',
    question: '你的人生美食座右铭是？',
    options: [
      { text: '人生苦短，先吃辣的', emoji: '🌶️', flavors: { spicy: 5, umami: 1, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 5, light: -3 } },
      { text: '细嚼慢咽，品味人生每一刻', emoji: '🍽️', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -2, light: 3 } },
      { text: '海纳百川，什么美食都尝一尝', emoji: '🌊', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 1, light: 0 } },
      { text: '人间烟火气，最抚凡人心', emoji: '🏮', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 3, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 68,
    category: 'final',
    question: '如果可以穿越，你想去哪一朝代当厨师？',
    options: [
      { text: '宋朝！苏轼的东坡肉，文人的饮食巅峰', emoji: '📜', flavors: { spicy: 0, umami: 4, sweet: 3, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '唐朝！胡旋舞配葡萄酒，开放包容', emoji: '🍇', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 0 } },
      { text: '清朝！宫廷御膳，满汉全席', emoji: '👑', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 1, crunchy: 2, tender: 4, intense: 1, light: 0 } },
      { text: '现在！外卖随时到，选择太多了', emoji: '📱', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 69,
    category: 'final',
    question: '你觉得最好的调味是？',
    options: [
      { text: '少即是多，食材够好什么都不加', emoji: '🤫', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: -4, light: 4 } },
      { text: '复合调味，酸甜苦辣鲜层层叠加', emoji: '🎭', flavors: { spicy: 2, umami: 4, sweet: 2, sour: 3, crunchy: 2, tender: 2, intense: 3, light: 0 } },
      { text: '麻辣当道，其他都是配角', emoji: '🌶️', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 5, light: -3 } },
      { text: '家常味道最动人，不花哨但暖心', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 70,
    category: 'final',
    question: '🎯 最终问题：你理想中的美食世界是？',
    options: [
      { text: '一个每天都在开火锅宴的世界！', emoji: '🫕', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 5, light: -3 }, scene: { social: 4, lively: 4, share: 4 } },
      { text: '一个每天都能吃到顶级食材的世界！', emoji: '⭐', flavors: { spicy: 0, umami: 5, sweet: 2, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 3 }, scene: { social: 1, lively: 0, share: 0 } },
      { text: '一个酸辣无处不在的世界！', emoji: '🍋', flavors: { spicy: 4, umami: 2, sweet: 1, sour: 5, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '一个各地风味和平共存的世界！', emoji: '🌍', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },

  // ═══════════════════════════════════════════
  // 维度10：日常口味延伸 (24题) — 作为对「日常偏好」的追问
  // ═══════════════════════════════════════════

  {
    id: 71,
    category: 'daily',
    question: '早餐时间到，你最幸福的搭配是？',
    options: [
      { text: '一碗热粥配一碟咸菜，家的味道', emoji: '🥣', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 1, crunchy: 0, tender: 2, intense: -1, light: 3 } },
      { text: '豆浆加油条，传统中国胃的标准', emoji: '🥛', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 0, crunchy: 4, tender: 2, intense: 0, light: 1 } },
      { text: '煎饼果子加辣！早起就要醒神', emoji: '🥞', flavors: { spicy: 3, umami: 2, sweet: 1, sour: 1, crunchy: 4, tender: 1, intense: 2, light: -1 } },
      { text: '小笼包配醋！一口一个', emoji: '🥟', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 2, crunchy: 2, tender: 3, intense: 0, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { light: 1 } },
  },
  {
    id: 72,
    category: 'daily',
    question: '下午三点钟办公室饿了，你选？',
    options: [
      { text: '麻辣豆干辣条，辣的提神', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -2 } },
      { text: '坚果酸奶，健康又不胖', emoji: '🥜', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 2, crunchy: 4, tender: 2, intense: -1, light: 2 } },
      { text: '奶茶一杯续命，糖分即正义', emoji: '🧋', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 1, intense: -1, light: 0 } },
      { text: '咖啡因党，浓缩美式走起', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 0, sour: 2, crunchy: 0, tender: 0, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 73,
    category: 'daily',
    question: '深夜一集剧看完了，馋了怎么办？',
    options: [
      { text: '点个夜宵外卖，麻辣烫串串', emoji: '🍢', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -2 } },
      { text: '打开冰箱来碗冰淇淋，甜到梦乡', emoji: '🍦', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 0, tender: 4, intense: -2, light: 1 } },
      { text: '忍住！喝杯温水就睡觉', emoji: '🌙', flavors: { spicy: 0, umami: 0, sweet: 0, sour: 0, crunchy: 0, tender: 0, intense: -4, light: 4 } },
      { text: '泡一碗泡面，罪恶但快乐', emoji: '🍜', flavors: { spicy: 2, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 74,
    category: 'daily',
    question: '做饭 vs 点外卖，你怎么选？',
    options: [
      { text: '自己下厨，享受过程，治愈感满满', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '点外卖，省时间，选择多', emoji: '📱', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '半成品加工，5分钟出餐', emoji: '🥘', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 1 } },
      { text: '泡面/速食/便利店，打工人标配', emoji: '🍱', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 1, tender: 1, intense: -1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 75,
    category: 'daily',
    question: '你最喜欢的饮料是？',
    options: [
      { text: '可乐雪碧，碳酸的快乐', emoji: '🥤', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 1, crunchy: 0, tender: 0, intense: 0, light: 1 } },
      { text: '现磨咖啡，苦才是真', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 0, sour: 2, crunchy: 0, tender: 0, intense: 2, light: 1 } },
      { text: '奶茶续命，半糖是底线', emoji: '🧋', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 2, intense: -1, light: 0 } },
      { text: '茶！清茶一杯心旷神怡', emoji: '🍵', flavors: { spicy: 0, umami: 1, sweet: 0, sour: 1, crunchy: 0, tender: 0, intense: -2, light: 4 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 76,
    category: 'daily',
    question: '心情不好的时候，哪种食物最能治愈？',
    options: [
      { text: '甜食！巧克力、蛋糕、冰淇淋', emoji: '🍫', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -1, light: 1 } },
      { text: '辣的！辣到流泪，释放压力', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 1, crunchy: 1, tender: 1, intense: 4, light: -2 } },
      { text: '汤面热汤，暖心暖胃', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 2 } },
      { text: '炸物！卡路里治愈一切', emoji: '🍗', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 0, crunchy: 5, tender: 2, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['comfort'] },
  },
  {
    id: 77,
    category: 'daily',
    question: '一个人的晚餐，你最常吃？',
    options: [
      { text: '简单煮个面/粉，加个蛋', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 2, intense: 0, light: 1 } },
      { text: '外卖叫一份盖饭/炒饭', emoji: '🍛', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 1, tender: 2, intense: 0, light: 1 } },
      { text: '一锅出！麻辣香锅一锅搞定', emoji: '🍲', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '轻食沙拉，身材管理', emoji: '🥗', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 3, crunchy: 4, tender: 2, intense: -2, light: 4 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 78,
    category: 'daily',
    question: '你最爱的小吃类型？',
    options: [
      { text: '煎炸类：炸鸡、薯条、煎饼', emoji: '🍳', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 0, crunchy: 5, tender: 2, intense: 2, light: -1 } },
      { text: '蒸煮类：包子、烧麦、蒸饺', emoji: '🥟', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 0, crunchy: 1, tender: 3, intense: -1, light: 2 } },
      { text: '烧烤类：烤串、烤翅、烤面筋', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 3, light: -1 } },
      { text: '凉拌类：凉皮、凉面、拌黄瓜', emoji: '🥒', flavors: { spicy: 1, umami: 1, sweet: 1, sour: 4, crunchy: 4, tender: 1, intense: 0, light: 3 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 79,
    category: 'daily',
    question: '你更偏爱南方菜还是北方菜？',
    options: [
      { text: '南方！精致细腻、清淡鲜香', emoji: '🌸', flavors: { spicy: 1, umami: 4, sweet: 3, sour: 2, crunchy: 2, tender: 4, intense: 1, light: 3 } },
      { text: '北方！实在豪迈、面食为主', emoji: '🌾', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 2, light: 1 } },
      { text: '中部！南北通吃，酸辣咸鲜都爱', emoji: '🏞️', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 3, crunchy: 2, tender: 3, intense: 2, light: 1 } },
      { text: '无所谓，哪里好吃吃哪里', emoji: '🗺️', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 80,
    category: 'daily',
    question: '你愿不愿意为一道菜等很久？',
    options: [
      { text: '愿意！好东西值得等', emoji: '⏳', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: 1, light: 2 } },
      { text: '看心情，饿了就近解决', emoji: '🚶', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 1 } },
      { text: '不能忍！饿了就立刻吃', emoji: '⚡', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '排队两小时只为一口，美食家心态', emoji: '🎖️', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 81,
    category: 'daily',
    question: '一桌菜里你最先动哪道？',
    options: [
      { text: '荤菜！肉先行', emoji: '🥩', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: 2, light: -1 } },
      { text: '素菜！开胃先来', emoji: '🥬', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 2, crunchy: 3, tender: 2, intense: -1, light: 3 } },
      { text: '汤品！先喝汤开胃', emoji: '🍲', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 0, tender: 2, intense: 0, light: 2 } },
      { text: '米饭！主食先来垫底', emoji: '🍚', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 0, crunchy: 0, tender: 1, intense: 0, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 82,
    category: 'daily',
    question: '你更常做的是哪种口味尝试？',
    options: [
      { text: '新菜式！照着菜谱学', emoji: '📖', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '老菜式！熟悉的味道最稳', emoji: '🔁', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '改良菜！把传统菜换个新做法', emoji: '🧪', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 2, light: 1 } },
      { text: '看心情！今天想吃啥做啥', emoji: '🎲', flavors: { spicy: 2, umami: 2, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 83,
    category: 'daily',
    question: '关于吃辣这件事，你的态度是？',
    options: [
      { text: '能吃辣是种自豪！从不怕', emoji: '🔥', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 4, light: -3 } },
      { text: '吃辣可以，但要够味不耍流氓', emoji: '🌶️', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '微辣是底线，多一点都不要', emoji: '🥲', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 2 } },
      { text: '完全不碰！辣和我没关系', emoji: '🙅', flavors: { spicy: 0, umami: 2, sweet: 3, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { spicy: 2 } },
  },
  {
    id: 84,
    category: 'daily',
    question: '你更喜欢的"鲜"是哪一种？',
    options: [
      { text: '鸡汤的鲜，炖出来浓郁', emoji: '🍗', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 0, crunchy: 0, tender: 4, intense: 2, light: 1 } },
      { text: '海鲜的鲜，清爽原味', emoji: '🦐', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 4 } },
      { text: '菌菇的鲜，山林气息', emoji: '🍄', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 3, tender: 2, intense: 1, light: 1 } },
      { text: '火腿的鲜，时间沉淀', emoji: '🥓', flavors: { spicy: 1, umami: 5, sweet: 1, sour: 2, crunchy: 2, tender: 1, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { umami: 2 } },
  },
  {
    id: 85,
    category: 'daily',
    question: '你最讨厌的食物类型是？',
    options: [
      { text: '太清淡的，没味道像嚼纸', emoji: '😐', flavors: { spicy: 4, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -3 } },
      { text: '太油腻的，吃完犯恶心', emoji: '🤢', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 3, crunchy: 3, tender: 2, intense: -2, light: 4 } },
      { text: '太甜的，甜到齁', emoji: '🍰', flavors: { spicy: 2, umami: 3, sweet: -2, sour: 3, crunchy: 2, tender: 2, intense: 1, light: 1 } },
      { text: '太生的，半生不熟受不了', emoji: '🥩', flavors: { spicy: 1, umami: 1, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 86,
    category: 'daily',
    question: '你吃饭速度是？',
    options: [
      { text: '风卷残云型！10分钟解决', emoji: '💨', flavors: { spicy: 2, umami: 2, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '正常速度，20-30分钟', emoji: '⏰', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 1 } },
      { text: '细嚼慢咽型，一顿饭一小时', emoji: '🧘', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 } },
      { text: '看心情，饿了就快，闲了就慢', emoji: '🎵', flavors: { spicy: 1, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 87,
    category: 'daily',
    question: '你最常点外卖的菜系是？',
    options: [
      { text: '川湘菜！麻辣鲜香开胃', emoji: '🌶️', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '粤式茶餐厅！清淡精致', emoji: '🥟', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: -1, light: 3 } },
      { text: '日韩料理！精致小份', emoji: '🍱', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 2, crunchy: 3, tender: 3, intense: 0, light: 2 } },
      { text: '汉堡炸鸡！快餐解馋', emoji: '🍔', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 3, tender: 2, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 88,
    category: 'daily',
    question: '你最钟情的面食类型是？',
    options: [
      { text: '兰州拉面！一清二白三红四绿五黄', emoji: '🍜', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '武汉热干面！芝麻酱的香醇', emoji: '🌰', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '阳春面！简简单单才是真', emoji: '🍲', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 0, crunchy: 0, tender: 2, intense: -1, light: 3 } },
      { text: '意大利面！番茄奶油罗勒', emoji: '🍝', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 89,
    category: 'daily',
    question: '汤在你心中的地位？',
    options: [
      { text: '灵魂！一顿饭必须有汤', emoji: '🥣', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 0, tender: 2, intense: 0, light: 2 } },
      { text: '重要！好汤是好菜的精髓', emoji: '🍲', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 0, tender: 3, intense: 1, light: 1 } },
      { text: '可有可无，菜好吃就行', emoji: '🍛', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '可有可无！干饭人才是王道', emoji: '🍚', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 0, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 90,
    category: 'daily',
    question: '你更爱哪种「主食+菜」搭配？',
    options: [
      { text: '米饭+红烧，浇在饭上最香', emoji: '🍚', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: 1, light: 0 } },
      { text: '面+浇头，吸满汤汁的灵魂', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 0 } },
      { text: '饼+夹菜，卷起来才过瘾', emoji: '🌯', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 3, tender: 2, intense: 1, light: 0 } },
      { text: '火锅/串串，一锅煮天下', emoji: '🍢', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 91,
    category: 'daily',
    question: '你更喜欢哪种口味的糖果零食？',
    options: [
      { text: '水果糖！清甜不腻', emoji: '🍬', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 2, crunchy: 1, tender: 2, intense: -1, light: 2 } },
      { text: '巧克力！浓郁丝滑', emoji: '🍫', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: 1, light: -1 } },
      { text: '辣味零食！辣的更刺激', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 1, sour: 1, crunchy: 3, tender: 1, intense: 3, light: -2 } },
      { text: '坚果果干！健康零食党', emoji: '🥜', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 1, crunchy: 4, tender: 1, intense: -1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 92,
    category: 'daily',
    question: '你最爱什么季节的应季味道？',
    options: [
      { text: '春鲜！春笋、香椿、草莓', emoji: '🌱', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 3, crunchy: 4, tender: 2, intense: -1, light: 3 } },
      { text: '夏爽！西瓜、酸梅汤、小龙虾', emoji: '🍉', flavors: { spicy: 2, umami: 2, sweet: 3, sour: 4, crunchy: 3, tender: 2, intense: 1, light: 2 } },
      { text: '秋补！大闸蟹、栗子、柿子', emoji: '🦀', flavors: { spicy: 0, umami: 5, sweet: 3, sour: 1, crunchy: 3, tender: 4, intense: 1, light: 1 } },
      { text: '冬暖！羊肉、火锅、烤红薯', emoji: '🍲', flavors: { spicy: 3, umami: 4, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 93,
    category: 'daily',
    question: '你更喜欢哪种「冷食」？',
    options: [
      { text: '冰镇酸梅汤/凉茶，夏日必备', emoji: '🧊', flavors: { spicy: 0, umami: 0, sweet: 3, sour: 4, crunchy: 0, tender: 0, intense: -1, light: 3 } },
      { text: '凉皮/凉面，酸辣开胃', emoji: '🥒', flavors: { spicy: 3, umami: 1, sweet: 1, sour: 4, crunchy: 4, tender: 1, intense: 1, light: 2 } },
      { text: '醉虾/鱼生，海鲜的冷鲜', emoji: '🍤', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 4 } },
      { text: '冰淇淋/冰棍，甜品的冰凉', emoji: '🍦', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 94,
    category: 'daily',
    question: '你更喜欢哪种「热食」？',
    options: [
      { text: '砂锅/煲仔，咕嘟咕嘟的幸福', emoji: '🍲', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 2, light: 0 } },
      { text: '刚出炉的烤物，热气腾腾', emoji: '🥖', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 0, crunchy: 4, tender: 2, intense: 2, light: -1 } },
      { text: '汤面/汤粉，热汤暖身', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 2 } },
      { text: '火锅/麻辣烫，热闹开涮', emoji: '🫕', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -2 } },
    ],
    version: 'full',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度11：食材深度 (20题) — 作为对「食材偏好」的追问
  // ═══════════════════════════════════════════

  {
    id: 95,
    category: 'ingredient',
    question: '海鲜里你最爱哪种？',
    options: [
      { text: '虾！Q弹鲜甜', emoji: '🦐', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 3, tender: 4, intense: -1, light: 3 } },
      { text: '鱼！清蒸最显功夫', emoji: '🐟', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: 0, light: 3 } },
      { text: '蟹！膏满黄肥', emoji: '🦀', flavors: { spicy: 0, umami: 5, sweet: 2, sour: 1, crunchy: 4, tender: 4, intense: 2, light: 0 } },
      { text: '贝壳类！蛤蜊扇贝生蚝', emoji: '🦪', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { umami: 2 } },
  },
  {
    id: 96,
    category: 'ingredient',
    question: '肉类里你最爱哪种？',
    options: [
      { text: '牛肉！牛排、肥牛、牛肉粒', emoji: '🥩', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: 3, light: -1 } },
      { text: '猪肉！红烧肉、回锅肉、排骨', emoji: '🐖', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 4, intense: 2, light: 0 } },
      { text: '羊肉！烤串、涮肉、手抓', emoji: '🐑', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 3, light: -1 } },
      { text: '鸡肉！白切、黄焖、宫保', emoji: '🐔', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 97,
    category: 'ingredient',
    question: '你最喜欢的蔬菜烹饪方式？',
    options: [
      { text: '清炒！保持蔬菜本味', emoji: '🥬', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 1, crunchy: 4, tender: 2, intense: -1, light: 4 } },
      { text: '凉拌！清脆爽口', emoji: '🥒', flavors: { spicy: 1, umami: 1, sweet: 1, sour: 3, crunchy: 4, tender: 2, intense: 0, light: 3 } },
      { text: '干煸！煸出香味最棒', emoji: '🔥', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 0, crunchy: 5, tender: 1, intense: 3, light: -2 } },
      { text: '蒜蓉！蒜香百搭', emoji: '🧄', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 3, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 98,
    category: 'ingredient',
    question: '豆腐的吃法你最爱哪种？',
    options: [
      { text: '麻婆豆腐！麻辣鲜香下饭', emoji: '🌶️', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 3, light: -1 } },
      { text: '蟹粉豆腐！鲜嫩一绝', emoji: '🦀', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: 1, light: 2 } },
      { text: '皮蛋豆腐！凉拌开胃', emoji: '🥚', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 2 } },
      { text: '家常豆腐！煎炸卤煮都好吃', emoji: '🟨', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 3, tender: 3, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 99,
    category: 'ingredient',
    question: '你对内脏类食物的态度？',
    options: [
      { text: '超爱！腰花、大肠、肝片', emoji: '🫀', flavors: { spicy: 2, umami: 4, sweet: 1, sour: 1, crunchy: 3, tender: 3, intense: 3, light: -1 } },
      { text: '可以吃，但要做得好', emoji: '🥢', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 2, light: 0 } },
      { text: '偶尔吃，不主动点', emoji: '🤔', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 1, crunchy: 1, tender: 2, intense: 1, light: 1 } },
      { text: '不吃！心理上接受不了', emoji: '🙅', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 100,
    category: 'ingredient',
    question: '你最喜欢的水果吃法是？',
    options: [
      { text: '直接吃！原味最好', emoji: '🍎', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 3, crunchy: 3, tender: 3, intense: -1, light: 4 } },
      { text: '切盘摆盘！颜值满分', emoji: '🍉', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 2, crunchy: 3, tender: 3, intense: -1, light: 3 } },
      { text: '做甜品/果酱！加工后更迷人', emoji: '🍓', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 1 } },
      { text: '撒辣椒盐！云南吃法', emoji: '🥭', flavors: { spicy: 3, umami: 1, sweet: 3, sour: 3, crunchy: 3, tender: 3, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 101,
    category: 'ingredient',
    question: '你对发酵食品的态度？',
    options: [
      { text: '狂爱！臭豆腐、螺蛳粉、纳豆', emoji: '🫙', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 4, crunchy: 2, tender: 1, intense: 3, light: -1 } },
      { text: '喜欢！泡菜、腐乳、奶酪', emoji: '🧀', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 3, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '能接受，但不会主动选', emoji: '🤷', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 2, crunchy: 2, tender: 2, intense: 0, light: 1 } },
      { text: '不喜欢！味道太冲', emoji: '👃', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: -1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { intense: 2 } },
  },
  {
    id: 102,
    category: 'ingredient',
    question: '香料在你心中的地位？',
    options: [
      { text: '灵魂！花椒八角桂皮必须有', emoji: '🌟', flavors: { spicy: 3, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 3, light: -1 } },
      { text: '重要！用对香料能化腐朽为神奇', emoji: '🧂', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '适量就好，太多会喧宾夺主', emoji: '🤏', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '能不加就不加！食材本味最香', emoji: '🤫', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: -2, light: 4 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 103,
    category: 'ingredient',
    question: '你最爱的碳水化合物是？',
    options: [
      { text: '米饭！一白遮百丑', emoji: '🍚', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 0, crunchy: 0, tender: 1, intense: 0, light: 1 } },
      { text: '面食！面条面包饺子', emoji: '🍞', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 1, crunchy: 1, tender: 2, intense: 0, light: 1 } },
      { text: '粗粮！玉米红薯燕麦', emoji: '🌽', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 0, crunchy: 2, tender: 2, intense: -1, light: 2 } },
      { text: '土豆！怎么做都好吃', emoji: '🥔', flavors: { spicy: 1, umami: 2, sweet: 1, sour: 0, crunchy: 3, tender: 2, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 104,
    category: 'ingredient',
    question: '你喜欢吃甜品还是咸食？',
    options: [
      { text: '甜品党！一天不吃甜就难受', emoji: '🧁', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -1, light: 1 } },
      { text: '咸食党！甜品偶尔吃', emoji: '🥨', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '都爱！看心情和场合', emoji: '🎭', flavors: { spicy: 1, umami: 2, sweet: 3, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 1 } },
      { text: '都不爱！我只吃正餐', emoji: '🍛', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { sweet: 2 } },
  },
  {
    id: 105,
    category: 'ingredient',
    question: '你更偏爱什么部位的肉？',
    options: [
      { text: '肥的！肥肉才是灵魂', emoji: '🥓', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 0, crunchy: 1, tender: 4, intense: 2, light: -1 } },
      { text: '瘦的！健康不油腻', emoji: '🍗', flavors: { spicy: 1, umami: 4, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 2, light: 1 } },
      { text: '肥瘦相间！五花肉才是王道', emoji: '🥩', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 0, crunchy: 1, tender: 4, intense: 2, light: 0 } },
      { text: '无所谓！好吃就行', emoji: '🍖', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 0, crunchy: 1, tender: 3, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 106,
    category: 'ingredient',
    question: '你最喜欢的甜味来源是？',
    options: [
      { text: '蔗糖/白糖，传统甜味', emoji: '🍯', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 0, crunchy: 1, tender: 2, intense: -1, light: 1 } },
      { text: '水果的甜，自然清新', emoji: '🍓', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 2, crunchy: 1, tender: 2, intense: -1, light: 3 } },
      { text: '奶制品的甜，醇厚', emoji: '🥛', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 0, tender: 3, intense: 0, light: 1 } },
      { text: '焦糖/烘焙的甜，深沉', emoji: '🍞', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 2, tender: 2, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
    tags: { triggers: { sweet: 2 } },
  },
  {
    id: 107,
    category: 'ingredient',
    question: '你更偏爱哪种烹饪用油？',
    options: [
      { text: '花生油，传统中式香', emoji: '🥜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 0, crunchy: 3, tender: 2, intense: 2, light: 0 } },
      { text: '菜籽油，川菜灵魂', emoji: '🌻', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 0, crunchy: 3, tender: 2, intense: 2, light: -1 } },
      { text: '橄榄油，地中海风情', emoji: '🫒', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 2, crunchy: 1, tender: 3, intense: 0, light: 3 } },
      { text: '芝麻油，提香点睛', emoji: '🟤', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 108,
    category: 'ingredient',
    question: '你更愿意尝试什么稀有食材？',
    options: [
      { text: '鹅肝/松露，奢华享受', emoji: '🥄', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 0, crunchy: 1, tender: 4, intense: 3, light: -1 } },
      { text: '燕窝/鱼翅，传统滋补', emoji: '🥣', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 0, crunchy: 0, tender: 3, intense: 0, light: 2 } },
      { text: '和牛肉/伊比利亚火腿，顶级肉品', emoji: '🥩', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 0, crunchy: 2, tender: 4, intense: 2, light: 0 } },
      { text: '山野菜/野菌，自然馈赠', emoji: '🌿', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 3, tender: 2, intense: 1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 109,
    category: 'ingredient',
    question: '你最喜欢的味道层次是？',
    options: [
      { text: '单一突出！一种味道打天下', emoji: '🎯', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 0, crunchy: 2, tender: 2, intense: 4, light: -1 } },
      { text: '两种对比！甜咸、酸辣', emoji: '⚖️', flavors: { spicy: 2, umami: 2, sweet: 3, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '三种平衡！酸甜咸鲜齐发', emoji: '🎼', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 1, light: 1 } },
      { text: '多重交织！一口吃出十几种味', emoji: '🌈', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 110,
    category: 'ingredient',
    question: '你最喜欢的鸡蛋做法是？',
    options: [
      { text: '番茄炒蛋！国民下饭神菜', emoji: '🍅', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 3, crunchy: 1, tender: 3, intense: 0, light: 2 } },
      { text: '溏心蛋/温泉蛋，半流心的诱惑', emoji: '🥚', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 0, crunchy: 0, tender: 4, intense: 0, light: 2 } },
      { text: '茶叶蛋/卤蛋，入味十足', emoji: '🍵', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 2, light: 0 } },
      { text: '蛋炒饭！粒粒分明的灵魂', emoji: '🍚', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 0, crunchy: 2, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 111,
    category: 'ingredient',
    question: '关于奶制品，你爱哪种？',
    options: [
      { text: '酸奶！酸甜开胃助消化', emoji: '🥛', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 4, crunchy: 0, tender: 3, intense: -1, light: 3 } },
      { text: '纯牛奶/鲜奶！原味最好', emoji: '🐄', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 0, crunchy: 0, tender: 2, intense: 0, light: 2 } },
      { text: '奶酪/芝士！浓郁奶香', emoji: '🧀', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 0, tender: 3, intense: 2, light: -1 } },
      { text: '奶茶/奶盖茶！奶与茶的结合', emoji: '🧋', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 2, intense: -1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 112,
    category: 'ingredient',
    question: '你愿意尝试昆虫类食物吗？',
    options: [
      { text: '愿意！蛋白质满满', emoji: '🦗', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 0, crunchy: 5, tender: 1, intense: 2, light: -1 } },
      { text: '可以试，但要做得好看', emoji: '🐛', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 0, crunchy: 4, tender: 1, intense: 1, light: 0 } },
      { text: '心理上有点抗拒', emoji: '😬', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 0, light: 1 } },
      { text: '绝对不行！', emoji: '🚫', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: -1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 113,
    category: 'ingredient',
    question: '你最喜欢的酱料是？',
    options: [
      { text: '辣椒酱！老干妈是信仰', emoji: '🌶️', flavors: { spicy: 4, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 3, light: -2 } },
      { text: '番茄酱！百搭神器', emoji: '🍅', flavors: { spicy: 0, umami: 1, sweet: 3, sour: 3, crunchy: 0, tender: 0, intense: -1, light: 2 } },
      { text: '芝麻酱/沙茶酱，香醇浓郁', emoji: '🥜', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 0, crunchy: 1, tender: 1, intense: 2, light: 0 } },
      { text: '海鲜酱/蚝油，鲜美提味', emoji: '🦪', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 0, crunchy: 0, tender: 0, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 114,
    category: 'ingredient',
    question: '你愿意尝试分子料理/创意菜吗？',
    options: [
      { text: '求之不得！科技感满满', emoji: '🧪', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 1 } },
      { text: '可以试试！要好吃才行', emoji: '🔬', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 1 } },
      { text: '还是喜欢传统菜', emoji: '📜', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '花里胡哨！好吃才是真', emoji: '🧐', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度12：情绪场景延伸 (20题) — 作为对「情绪」的追问
  // ═══════════════════════════════════════════

  {
    id: 115,
    category: 'mood',
    question: '生日你最想收到什么美食礼物？',
    options: [
      { text: '定制蛋糕！独一无二', emoji: '🎂', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: 0, light: 0 } },
      { text: '一桌好菜！和家人一起吃', emoji: '🍽️', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '高级餐厅套餐！仪式感拉满', emoji: '🥂', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 2 } },
      { text: '自己下厨做一桌！最有意义', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['celebration'] },
  },
  {
    id: 116,
    category: 'mood',
    question: '如果中了彩票，你第一顿吃什么？',
    options: [
      { text: '米其林三星！奢华一把', emoji: '⭐', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: 1, light: 2 } },
      { text: '龙虾鲍鱼帝王蟹！海味全上', emoji: '🦞', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: 1, light: 1 } },
      { text: '火锅吃到爽！所有菜全点', emoji: '🫕', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -1 } },
      { text: '把所有想吃的小吃全吃一遍', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['celebration'] },
  },
  {
    id: 117,
    category: 'mood',
    question: '加班到深夜，你最想念？',
    options: [
      { text: '一碗妈妈做的热汤面', emoji: '🍜', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 3, intense: 0, light: 2 } },
      { text: '烧烤配啤酒！治愈加班狗', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 0, crunchy: 3, tender: 2, intense: 3, light: -2 } },
      { text: '热咖啡+面包，简单应付', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 0, crunchy: 2, tender: 1, intense: 1, light: 1 } },
      { text: '速食/泡面！效率第一', emoji: '🍜', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 1, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['comfort'] },
  },
  {
    id: 118,
    category: 'mood',
    question: '如果明天就要去远行，你想在旅途中吃？',
    options: [
      { text: '当地特色菜！入乡随俗', emoji: '🗺️', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '带得走的家乡味！乡愁解药', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '街头小吃！最接地气', emoji: '🥟', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 0 } },
      { text: '豪华大餐！旅行就奢侈一把', emoji: '🦞', flavors: { spicy: 0, umami: 5, sweet: 2, sour: 1, crunchy: 1, tender: 4, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['explore'] },
  },
  {
    id: 119,
    category: 'mood',
    question: '你和最好的朋友聚会，最常吃什么？',
    options: [
      { text: '火锅！边涮边聊最佳', emoji: '🫕', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -1 } },
      { text: '烧烤！喝酒撸串最畅快', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 1, crunchy: 3, tender: 2, intense: 3, light: -1 } },
      { text: '下午茶！精致小食配聊天', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 3, sour: 1, crunchy: 2, tender: 2, intense: -1, light: 2 } },
      { text: '私房菜！小众有情调', emoji: '🍷', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['social'] },
  },
  {
    id: 120,
    category: 'mood',
    question: '失恋了最想吃的味道是？',
    options: [
      { text: '甜的！甜甜的治愈一切', emoji: '🍰', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -1, light: 1 } },
      { text: '辣的！让眼泪流出来', emoji: '🌶️', flavors: { spicy: 4, umami: 1, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 4, light: -2 } },
      { text: '酸的！酸到流泪就忘了', emoji: '🍋', flavors: { spicy: 1, umami: 1, sweet: 1, sour: 5, crunchy: 1, tender: 1, intense: 2, light: -1 } },
      { text: '苦的！咖啡黑巧配眼泪', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 0, sour: 1, crunchy: 1, tender: 1, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['comfort'] },
  },
  {
    id: 121,
    category: 'mood',
    question: '第一次见家长/对象父母，你选？',
    options: [
      { text: '中餐厅！稳妥不出错', emoji: '🥢', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '粤菜！精致清淡有诚意', emoji: '🥟', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: -1, light: 3 } },
      { text: '火锅！热闹又亲切', emoji: '🫕', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -1 } },
      { text: '本帮菜/家乡特色！展现诚意', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 3, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['family'] },
  },
  {
    id: 122,
    category: 'mood',
    question: '和爱人约会，最适合什么氛围？',
    options: [
      { text: '中式小酒馆！浪漫优雅', emoji: '🍷', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 2 } },
      { text: '小馆子！温馨家常', emoji: '🍲', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 2, intense: 1, light: 1 } },
      { text: '私房菜！安静不打扰', emoji: '🥢', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: -1, light: 4 } },
      { text: '甜品店！甜蜜暴击', emoji: '🧁', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 1, crunchy: 1, tender: 3, intense: -1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['romance'] },
  },
  {
    id: 123,
    category: 'mood',
    question: '带朋友来你的城市，你最想请TA吃的？',
    options: [
      { text: '本地最有名的老字号', emoji: '🏛️', flavors: { spicy: 1, umami: 4, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 0 } },
      { text: '街角老店！本地人最爱', emoji: '🏚️', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 2, crunchy: 2, tender: 2, intense: 2, light: 0 } },
      { text: '网红打卡！拍照分享', emoji: '📸', flavors: { spicy: 1, umami: 2, sweet: 3, sour: 1, crunchy: 3, tender: 2, intense: 0, light: 1 } },
      { text: '夜市小吃！烟火气最动人', emoji: '🏮', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 2, crunchy: 3, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 124,
    category: 'mood',
    question: '春天到了你最想吃？',
    options: [
      { text: '春笋/香椿/荠菜！时令鲜', emoji: '🌱', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 2, crunchy: 4, tender: 2, intense: -1, light: 3 } },
      { text: '踏青便当！野餐的感觉', emoji: '🍱', flavors: { spicy: 0, umami: 2, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: -1, light: 3 } },
      { text: '青团/春卷！节气美食', emoji: '🍡', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 1, tender: 4, intense: -1, light: 1 } },
      { text: '草莓/樱桃！水果的甜', emoji: '🍓', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 3, crunchy: 1, tender: 3, intense: -1, light: 4 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 125,
    category: 'mood',
    question: '夏日炎炎你最渴望？',
    options: [
      { text: '冰镇西瓜！消暑神器', emoji: '🍉', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 4 } },
      { text: '酸梅汤/冰粉！冰凉解暑', emoji: '🧊', flavors: { spicy: 0, umami: 0, sweet: 3, sour: 3, crunchy: 1, tender: 2, intense: -1, light: 3 } },
      { text: '凉面/凉皮！酸辣开胃', emoji: '🍜', flavors: { spicy: 2, umami: 1, sweet: 1, sour: 3, crunchy: 3, tender: 1, intense: 1, light: 2 } },
      { text: '小龙虾配冰啤酒！夏夜绝配', emoji: '🦞', flavors: { spicy: 3, umami: 4, sweet: 0, sour: 1, crunchy: 3, tender: 3, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 126,
    category: 'mood',
    question: '秋风起，你最想？',
    options: [
      { text: '大闸蟹！膏满黄肥', emoji: '🦀', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 2, tender: 4, intense: 1, light: 1 } },
      { text: '糖炒栗子/烤红薯！街头秋味', emoji: '🌰', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 3, tender: 2, intense: -1, light: 1 } },
      { text: '秋梨润肺！秋天的水果', emoji: '🍐', flavors: { spicy: 0, umami: 0, sweet: 3, sour: 1, crunchy: 2, tender: 3, intense: -1, light: 4 } },
      { text: '羊肉汤！贴秋膘', emoji: '🍲', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 0, crunchy: 1, tender: 3, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 127,
    category: 'mood',
    question: '冬日你最渴望的温暖？',
    options: [
      { text: '火锅！围炉而坐最暖', emoji: '🫕', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -1 } },
      { text: '关东煮/串串！街头暖手', emoji: '🍢', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '热红酒/热可可！温暖饮品', emoji: '🍷', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 1, crunchy: 0, tender: 1, intense: 0, light: 1 } },
      { text: '羊肉/牛肉炖菜！热乎实在', emoji: '🥘', flavors: { spicy: 1, umami: 4, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 128,
    category: 'mood',
    question: '考试周最想念的味道？',
    options: [
      { text: '妈妈牌红烧肉！家的味道', emoji: '🍖', flavors: { spicy: 0, umami: 3, sweet: 3, sour: 1, crunchy: 1, tender: 4, intense: 1, light: 0 } },
      { text: '泡面/速食！最方便', emoji: '🍜', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 1, intense: 1, light: 0 } },
      { text: '咖啡续命！苦中作乐', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 0, sour: 2, crunchy: 0, tender: 0, intense: 2, light: 1 } },
      { text: '奶茶续命！糖分救命', emoji: '🧋', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 1, intense: -1, light: 0 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['comfort'] },
  },
  {
    id: 129,
    category: 'mood',
    question: '结婚纪念日最想吃的？',
    options: [
      { text: '当年约会那家！怀旧重现', emoji: '💕', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '高端宴席！仪式感满满', emoji: '⭐', flavors: { spicy: 0, umami: 3, sweet: 2, sour: 2, crunchy: 1, tender: 3, intense: 1, light: 2 } },
      { text: '在家下厨！两个人世界', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '去新开的网红店！尝鲜', emoji: '🆕', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['romance'] },
  },
  {
    id: 130,
    category: 'mood',
    question: '周末独处的最佳陪伴？',
    options: [
      { text: '一杯咖啡一本书！文艺', emoji: '📚', flavors: { spicy: 0, umami: 1, sweet: 1, sour: 1, crunchy: 1, tender: 1, intense: 0, light: 2 } },
      { text: '一集剧+一桶炸鸡！爽', emoji: '🍗', flavors: { spicy: 1, umami: 3, sweet: 0, sour: 0, crunchy: 5, tender: 2, intense: 2, light: -1 } },
      { text: '一壶茶+点心！禅意', emoji: '🍵', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 0, crunchy: 1, tender: 2, intense: -1, light: 3 } },
      { text: '做饭+音乐！治愈系', emoji: '🎵', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 131,
    category: 'mood',
    question: '暴富后你最想吃什么？',
    options: [
      { text: '私人订制米其林大餐', emoji: '⭐', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: 1, light: 2 } },
      { text: '全国各地的菜都吃一遍', emoji: '🌍', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 2, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '开个私房菜馆！天天吃', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '让最贵的餐厅送餐到家', emoji: '🏠', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 1, tender: 3, intense: 1, light: 2 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['indulge'] },
  },
  {
    id: 132,
    category: 'mood',
    question: '失眠的深夜最想要？',
    options: [
      { text: '热牛奶！助眠经典', emoji: '🥛', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 0, crunchy: 0, tender: 2, intense: 0, light: 2 } },
      { text: '一碗清粥配小菜！养胃', emoji: '🥣', flavors: { spicy: 0, umami: 1, sweet: 1, sour: 1, crunchy: 0, tender: 2, intense: -2, light: 4 } },
      { text: '小酌一杯！酒精助眠', emoji: '🍶', flavors: { spicy: 0, umami: 1, sweet: 2, sour: 1, crunchy: 0, tender: 0, intense: 1, light: 1 } },
      { text: '忍住！空腹入睡最健康', emoji: '🌙', flavors: { spicy: 0, umami: 0, sweet: 0, sour: 0, crunchy: 0, tender: 0, intense: -4, light: 4 } },
    ],
    version: 'full',
    weight: 1,
  },
  {
    id: 133,
    category: 'mood',
    question: '周末朋友突然来访，你会？',
    options: [
      { text: '直接出去下馆子！', emoji: '🚶', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '在家露一手厨艺', emoji: '👨‍🍳', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '叫外卖！一起吃一起看剧', emoji: '📺', flavors: { spicy: 2, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '一起煮火锅！方便又热闹', emoji: '🫕', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 1,
    tags: { mood: ['social'] },
  },
  {
    id: 134,
    category: 'mood',
    question: '做完运动后，你最想？',
    options: [
      { text: '蛋白粉/牛奶！补充蛋白', emoji: '🥛', flavors: { spicy: 0, umami: 1, sweet: 1, sour: 0, crunchy: 0, tender: 2, intense: 0, light: 2 } },
      { text: '鸡胸肉沙拉！健康餐', emoji: '🥗', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 2, crunchy: 3, tender: 3, intense: 0, light: 3 } },
      { text: '碳水！米饭面条随便来', emoji: '🍚', flavors: { spicy: 0, umami: 2, sweet: 1, sour: 0, crunchy: 0, tender: 2, intense: 0, light: 1 } },
      { text: '炸物！运动完就要放纵', emoji: '🍗', flavors: { spicy: 1, umami: 3, sweet: 0, sour: 0, crunchy: 5, tender: 2, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 1,
  },

  // ═══════════════════════════════════════════
  // 维度13：风味挑战与对比 (16题) — 终极追问
  // ═══════════════════════════════════════════

  {
    id: 135,
    category: 'final',
    question: '终极对决！南方面 vs 北方面？',
    options: [
      { text: '南方面！阳春面、苏式汤面、米粉', emoji: '🍜', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
      { text: '北方面！炸酱面、刀削面、biangbiang', emoji: '🥢', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 136,
    category: 'final',
    question: '终极对决！新疆烤肉 vs 蒙古烤肉？',
    options: [
      { text: '新疆烤羊肉串！孜然辣椒烟火气', emoji: '🥩', flavors: { spicy: 3, umami: 4, sweet: 0, sour: 0, crunchy: 2, tender: 3, intense: 4, light: -1 } },
      { text: '蒙古烤全羊！草原豪迈手把肉', emoji: '🐑', flavors: { spicy: 1, umami: 5, sweet: 0, sour: 0, crunchy: 1, tender: 4, intense: 3, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 137,
    category: 'final',
    question: '终极对决！北方面食 vs 南方米食？',
    options: [
      { text: '北方面食！biangbiang/炸酱面/刀削面', emoji: '🍜', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 2, intense: 2, light: 0 } },
      { text: '南方米食！米粉米线煲仔饭', emoji: '🍚', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 1, crunchy: 1, tender: 2, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 138,
    category: 'final',
    question: '终极对决！川式酸汤鱼 vs 贵州酸汤鱼？',
    options: [
      { text: '川式泡椒酸汤鱼！麻辣开胃', emoji: '🌶️', flavors: { spicy: 4, umami: 3, sweet: 1, sour: 4, crunchy: 1, tender: 3, intense: 3, light: 0 } },
      { text: '贵州苗家酸汤鱼！米酸醇厚', emoji: '🍲', flavors: { spicy: 2, umami: 4, sweet: 1, sour: 5, crunchy: 1, tender: 3, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 139,
    category: 'final',
    question: '终极对决！京式甜品 vs 广式甜品？',
    options: [
      { text: '京式！驴打滚、豌豆黄、艾窝窝', emoji: '🍡', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 2, tender: 2, intense: 1, light: 0 } },
      { text: '广式！双皮奶、杨枝甘露、姜撞奶', emoji: '🥣', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 4, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 140,
    category: 'final',
    question: '终极对决！粤式早茶 vs 上海点心？',
    options: [
      { text: '广式早茶！虾饺烧卖艇仔粥', emoji: '🫖', flavors: { spicy: 0, umami: 4, sweet: 1, sour: 0, crunchy: 2, tender: 3, intense: -1, light: 3 } },
      { text: '上海点心！小笼生煎蟹粉包', emoji: '🥟', flavors: { spicy: 0, umami: 4, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 141,
    category: 'final',
    question: '终极对决！螺蛳粉 vs 臭豆腐？',
    options: [
      { text: '螺蛳粉！酸笋的灵魂臭味', emoji: '🍜', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 4, crunchy: 2, tender: 1, intense: 4, light: -2 } },
      { text: '臭豆腐！闻臭吃香的极致', emoji: '🟫', flavors: { spicy: 2, umami: 3, sweet: 1, sour: 2, crunchy: 4, tender: 1, intense: 3, light: -1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 142,
    category: 'final',
    question: '终极对决！烤鸭 vs 炸鸡？',
    options: [
      { text: '北京烤鸭！果木炭火片鸭皮', emoji: '🦆', flavors: { spicy: 0, umami: 4, sweet: 3, sour: 1, crunchy: 4, tender: 3, intense: 2, light: 0 } },
      { text: '炸鸡！金黄酥脆咬下去咔嚓', emoji: '🍗', flavors: { spicy: 1, umami: 3, sweet: 1, sour: 0, crunchy: 5, tender: 2, intense: 2, light: -1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 143,
    category: 'final',
    question: '终极对决！麻辣香锅 vs 麻辣烫？',
    options: [
      { text: '麻辣香锅！干香有嚼劲', emoji: '🌶️', flavors: { spicy: 4, umami: 3, sweet: 0, sour: 0, crunchy: 3, tender: 2, intense: 3, light: -1 } },
      { text: '麻辣烫！汤底浓郁自由搭配', emoji: '🍢', flavors: { spicy: 3, umami: 3, sweet: 0, sour: 1, crunchy: 2, tender: 2, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 144,
    category: 'final',
    question: '终极对决！火锅 vs 烧烤？',
    options: [
      { text: '火锅！涮一切万物皆可煮', emoji: '🫕', flavors: { spicy: 2, umami: 3, sweet: 0, sour: 0, crunchy: 1, tender: 2, intense: 3, light: -1 } },
      { text: '烧烤！炭火滋滋响的市井烟火', emoji: '🍢', flavors: { spicy: 2, umami: 4, sweet: 0, sour: 0, crunchy: 3, tender: 2, intense: 3, light: -2 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 145,
    category: 'final',
    question: '终极对决！家常菜 vs 餐厅菜？',
    options: [
      { text: '家常菜！家的味道最香', emoji: '🏠', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 0, light: 2 } },
      { text: '餐厅菜！精致讲究', emoji: '🍽️', flavors: { spicy: 1, umami: 3, sweet: 2, sour: 1, crunchy: 2, tender: 3, intense: 1, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 146,
    category: 'final',
    question: '终极对决！甜粽子 vs 咸粽子？',
    options: [
      { text: '甜粽子！红枣豆沙蜜枣', emoji: '🍡', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 0, crunchy: 0, tender: 4, intense: -1, light: 1 } },
      { text: '咸粽子！鲜肉蛋黄板栗', emoji: '🥩', flavors: { spicy: 0, umami: 3, sweet: 1, sour: 0, crunchy: 1, tender: 4, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 147,
    category: 'final',
    question: '终极对决！甜豆腐脑 vs 咸豆腐脑？',
    options: [
      { text: '甜的！糖水豆腐脑最经典', emoji: '🥣', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 0, crunchy: 0, tender: 4, intense: -1, light: 2 } },
      { text: '咸的！辣油榨菜才是灵魂', emoji: '🌶️', flavors: { spicy: 2, umami: 2, sweet: 0, sour: 1, crunchy: 1, tender: 4, intense: 2, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 148,
    category: 'final',
    question: '终极对决！汤圆 vs 元宵？',
    options: [
      { text: '汤圆！南方派，糯米皮嫩', emoji: '🍡', flavors: { spicy: 0, umami: 0, sweet: 4, sour: 0, crunchy: 0, tender: 4, intense: -1, light: 1 } },
      { text: '元宵！北方派，馅料扎实', emoji: '⚪', flavors: { spicy: 0, umami: 1, sweet: 4, sour: 0, crunchy: 1, tender: 3, intense: 1, light: 0 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 149,
    category: 'final',
    question: '终极对决！奶茶 vs 咖啡？',
    options: [
      { text: '奶茶！续命神器不能少', emoji: '🧋', flavors: { spicy: 0, umami: 1, sweet: 5, sour: 0, crunchy: 1, tender: 1, intense: -1, light: 0 } },
      { text: '咖啡！苦中作乐', emoji: '☕', flavors: { spicy: 0, umami: 1, sweet: 0, sour: 2, crunchy: 0, tender: 0, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
  {
    id: 150,
    category: 'final',
    question: '🎯 终极问题：如果让你永远只能吃一种味道？',
    options: [
      { text: '辣！辣的永远是我的信仰', emoji: '🌶️', flavors: { spicy: 5, umami: 2, sweet: 0, sour: 0, crunchy: 1, tender: 1, intense: 5, light: -3 } },
      { text: '鲜！清清淡淡才是真', emoji: '🍲', flavors: { spicy: 0, umami: 5, sweet: 1, sour: 1, crunchy: 1, tender: 4, intense: 0, light: 3 } },
      { text: '甜！甜蜜的人生才圆满', emoji: '🍰', flavors: { spicy: 0, umami: 0, sweet: 5, sour: 0, crunchy: 1, tender: 3, intense: -1, light: 1 } },
      { text: '酸！开胃醒神永远不腻', emoji: '🍋', flavors: { spicy: 0, umami: 1, sweet: 1, sour: 5, crunchy: 2, tender: 1, intense: 2, light: 1 } },
    ],
    version: 'full',
    weight: 2,
  },
];

// Generate quick version questions (30 questions) — curated 30 with good coverage
// of every category so the quick run still feels complete.
export const quickQuestions: Question[] = (() => {
  const seen = new Set<number>()
  const out: Question[] = []
  const allQuick = questions.filter((q) => q.version === 'quick')
  const ids = [7, 14, 25, 33, 39, 47, 54, 61, 76, 95, 115, 84, 101]
  for (const q of allQuick) {
    if (!seen.has(q.id)) {
      seen.add(q.id)
      out.push(q)
    }
  }
  for (const id of ids) {
    if (seen.has(id)) continue
    const q = questions.find(q => q.id === id)
    if (!q) throw new Error(`Question ${id} not found`)
    seen.add(q.id)
    out.push(q)
  }
  return out
})()
