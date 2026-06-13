export type FlavorProfile = {
  spicy: number;   // 辣度
  umami: number;   // 鲜度
  sweet: number;   // 甜度
  sour: number;    // 酸度
  crunchy: number; // 脆度
  tender: number;  // 嫩度
  intense: number; // 浓烈度
  light: number;   // 清淡度
};

export type Cuisine = {
  name: string;
  emoji: string;
  category: 'china';
  profile: FlavorProfile;
  description: string;
  representativeDishes: string[];
  personalityTraits: string[];
};

export const cuisines: Cuisine[] = [
  // ========== 中国菜系 ==========
  {
    name: '川菜',
    emoji: '🌶️',
    category: 'china',
    profile: { spicy: 9, umami: 6, sweet: 2, sour: 2, crunchy: 5, tender: 8, intense: 9, light: 1 },
    description: '麻辣鲜香，热烈奔放',
    representativeDishes: ['麻婆豆腐', '水煮鱼', '宫保鸡丁', '夫妻肺片', '火锅'],
    personalityTraits: ['热情似火', '敢爱敢恨', '追求刺激'],
  },
  {
    name: '粤菜',
    emoji: '🥟',
    category: 'china',
    profile: { spicy: 1, umami: 9, sweet: 5, sour: 2, crunchy: 2, tender: 9, intense: 2, light: 9 },
    description: '清淡鲜美，原汁原味',
    representativeDishes: ['虾饺', '烧腊', '白切鸡', '早茶点心', '清蒸鱼'],
    personalityTraits: ['品味优雅', '追求本真', '细腻温和'],
  },
  {
    name: '鲁菜',
    emoji: '🥘',
    category: 'china',
    profile: { spicy: 1, umami: 8, sweet: 4, sour: 4, crunchy: 4, tender: 5, intense: 7, light: 3 },
    description: '咸鲜醇厚，讲究火候',
    representativeDishes: ['糖醋鲤鱼', '九转大肠', '爆炒腰花', '葱烧海参', '锅包肉'],
    personalityTraits: ['沉稳大气', '讲究规矩', '底蕴深厚'],
  },
  {
    name: '苏菜',
    emoji: '🍮',
    category: 'china',
    profile: { spicy: 1, umami: 5, sweet: 8, sour: 4, crunchy: 2, tender: 8, intense: 4, light: 5 },
    description: '甜润精致，刀工细腻',
    representativeDishes: ['松鼠桂鱼', '狮子头', '盐水鸭', '太湖银鱼', '蟹粉豆腐'],
    personalityTraits: ['温润如玉', '精致生活', '文雅含蓄'],
  },
  {
    name: '浙菜',
    emoji: '🍵',
    category: 'china',
    profile: { spicy: 1, umami: 8, sweet: 5, sour: 6, crunchy: 7, tender: 8, intense: 4, light: 8 },
    description: '清鲜爽嫩，文人菜风',
    representativeDishes: ['东坡肉', '龙井虾仁', '西湖醋鱼', '叫花鸡', '宋嫂鱼羹'],
    personalityTraits: ['诗意浪漫', '清雅脱俗', '书卷气息'],
  },
  {
    name: '闽菜',
    emoji: '🦐',
    category: 'china',
    profile: { spicy: 1, umami: 9, sweet: 5, sour: 6, crunchy: 4, tender: 8, intense: 4, light: 7 },
    description: '鲜香醇厚，善于调汤',
    representativeDishes: ['佛跳墙', '荔枝肉', '鱼丸汤', '拌海蜇', '沙县小吃'],
    personalityTraits: ['温柔内敛', '善于调和', '海纳百川'],
  },
  {
    name: '湘菜',
    emoji: '🔥',
    category: 'china',
    profile: { spicy: 8, umami: 6, sweet: 2, sour: 7, crunchy: 3, tender: 5, intense: 8, light: 1 },
    description: '酸辣浓郁，火辣过瘾',
    representativeDishes: ['剁椒鱼头', '辣椒炒肉', '臭豆腐', '腊味合蒸', '毛氏红烧肉'],
    personalityTraits: ['火辣直爽', '坚韧不拔', '有脾气'],
  },
  {
    name: '徽菜',
    emoji: '🍄',
    category: 'china',
    profile: { spicy: 1, umami: 5, sweet: 2, sour: 2, crunchy: 2, tender: 7, intense: 7, light: 2 },
    description: '重油重色，山珍为要',
    representativeDishes: ['臭鳜鱼', '毛豆腐', '火腿炖甲鱼', '胡适一品锅', '徽州饼'],
    personalityTraits: ['深沉厚重', '不事张扬', '回味无穷'],
  },
  {
    name: '云南菜',
    emoji: '🌿',
    category: 'china',
    profile: { spicy: 5, umami: 8, sweet: 2, sour: 7, crunchy: 7, tender: 8, intense: 5, light: 5 },
    description: '酸辣鲜香，野生菌菇，民族风情，自然本味',
    representativeDishes: ['过桥米线', '菌子火锅', '孔雀宴', '鲜花饼', '傣味烤鸡'],
    personalityTraits: ['天然自由', '多元包容', '浪漫不羁'],
  },
  {
    name: '贵州菜',
    emoji: '🐟',
    category: 'china',
    profile: { spicy: 8, umami: 6, sweet: 2, sour: 8, crunchy: 4, tender: 5, intense: 7, light: 2 },
    description: '酸辣为主，发酵风味，酸汤鱼，少数民族特色',
    representativeDishes: ['酸汤鱼', '丝娃娃', '肠旺面', '折耳根炒肉', '豆腐丸子'],
    personalityTraits: ['敢尝敢试', '酸辣自由', '民俗味浓'],
  },
  {
    name: '新疆菜',
    emoji: '🥩',
    category: 'china',
    profile: { spicy: 2, umami: 5, sweet: 2, sour: 2, crunchy: 5, tender: 7, intense: 5, light: 2 },
    description: '烤肉香料，馕面食，粗犷豪迈，奶制品丰富',
    representativeDishes: ['烤羊肉串', '大盘鸡', '手抓饭', '馕', '烤包子'],
    personalityTraits: ['豪爽大气', '热情好客', '草原自由'],
  },
  {
    name: '藏菜',
    emoji: '🏔️',
    category: 'china',
    profile: { spicy: 2, umami: 5, sweet: 2, sour: 2, crunchy: 5, tender: 5, intense: 4, light: 4 },
    description: '酥油茶糌粑，高原粗犷，奶肉为主',
    representativeDishes: ['酥油茶', '糌粑', '风干肉', '青稞酒', '藏香猪'],
    personalityTraits: ['高原纯净', '坚韧深沉', '信仰之力'],
  },
  {
    name: '壮菜',
    emoji: '🌺',
    category: 'china',
    profile: { spicy: 5, umami: 5, sweet: 2, sour: 7, crunchy: 5, tender: 5, intense: 4, light: 4 },
    description: '五色糯米，酸嘢，热带风味，少数民族特色',
    representativeDishes: ['五色糯米饭', '螺蛳粉', '酸嘢', '柠檬鸭', '桂林米粉'],
    personalityTraits: ['热情似花', '酸甜自由', '民族之魂'],
  },

  // ========== 新增中国地方菜 + 民族菜 + 港澳台 ==========
  {
    name: '东北菜',
    emoji: '🥟',
    category: 'china',
    profile: { spicy: 2, umami: 8, sweet: 3, sour: 5, crunchy: 4, tender: 7, intense: 8, light: 2 },
    description: '分量豪迈，炖菜为主，咸鲜浓郁',
    representativeDishes: ['猪肉炖粉条', '小鸡炖蘑菇', '锅包肉', '地三鲜', '酸菜白肉'],
    personalityTraits: ['豪爽大气', '朴实热情', '讲究实在'],
  },
  {
    name: '陕西菜',
    emoji: '🍜',
    category: 'china',
    profile: { spicy: 7, umami: 5, sweet: 1, sour: 8, crunchy: 6, tender: 4, intense: 7, light: 1 },
    description: '面食王国，酸辣咸香，黄土风情',
    representativeDishes: ['肉夹馍', 'biangbiang 面', '羊肉泡馍', '凉皮', '岐山臊子面'],
    personalityTraits: ['粗犷豪迈', '面食信徒', '秦汉古风'],
  },
  {
    name: '湖北菜',
    emoji: '🐟',
    category: 'china',
    profile: { spicy: 5, umami: 8, sweet: 2, sour: 3, crunchy: 5, tender: 8, intense: 5, light: 6 },
    description: '鱼米之乡，咸鲜微辣，蒸菜见长',
    representativeDishes: ['清蒸武昌鱼', '排骨藕汤', '热干面', '沔阳三蒸', '潜江小龙虾'],
    personalityTraits: ['温润如水', '荆楚风骨', '讲究本味'],
  },
  {
    name: '客家菜',
    emoji: '🍲',
    category: 'china',
    profile: { spicy: 3, umami: 9, sweet: 4, sour: 5, crunchy: 3, tender: 8, intense: 7, light: 3 },
    description: '咸香肥嫩，原汁原味，山野气息',
    representativeDishes: ['梅菜扣肉', '盐焗鸡', '酿豆腐', '客家咸汤圆', '三杯鸭'],
    personalityTraits: ['朴实厚重', '传承坚守', '客家之根'],
  },
  {
    name: '潮汕菜',
    emoji: '🥩',
    category: 'china',
    profile: { spicy: 1, umami: 10, sweet: 3, sour: 2, crunchy: 5, tender: 9, intense: 4, light: 7 },
    description: '清鲜极鲜，牛肉火锅，功夫茶配',
    representativeDishes: ['牛肉火锅', '手打牛肉丸', '潮汕粿品', '卤鹅', '肠粉'],
    personalityTraits: ['极致的鲜', '低调奢华', '匠人精神'],
  },
  {
    name: '京菜',
    emoji: '🦆',
    category: 'china',
    profile: { spicy: 1, umami: 8, sweet: 3, sour: 2, crunchy: 5, tender: 7, intense: 6, light: 4 },
    description: '宫廷烤制，酱香浓郁，京味十足',
    representativeDishes: ['北京烤鸭', '涮羊肉', '炸酱面', '爆肚', '驴打滚'],
    personalityTraits: ['大气端正', '宫廷气派', '讲究规矩'],
  },
  {
    name: '港式',
    emoji: '🍵',
    category: 'china',
    profile: { spicy: 1, umami: 8, sweet: 7, sour: 2, crunchy: 4, tender: 8, intense: 5, light: 5 },
    description: '茶餐厅文化，海鲜烧腊，中西合璧',
    representativeDishes: ['菠萝包', '丝袜奶茶', '云吞面', '叉烧饭', '蛋挞'],
    personalityTraits: ['都市精致', '中西融合', '效率与味道'],
  },
  {
    name: '台湾菜',
    emoji: '🧋',
    category: 'china',
    profile: { spicy: 2, umami: 6, sweet: 6, sour: 4, crunchy: 5, tender: 6, intense: 4, light: 6 },
    description: '闽南底子，融合日式，温柔家常',
    representativeDishes: ['卤肉饭', '蚵仔煎', '珍珠奶茶', '三杯鸡', '台湾牛肉面'],
    personalityTraits: ['温柔小确幸', '多元温柔', '台式浪漫'],
  },
  {
    name: '蒙古菜',
    emoji: '🐑',
    category: 'china',
    profile: { spicy: 2, umami: 7, sweet: 2, sour: 3, crunchy: 4, tender: 8, intense: 6, light: 2 },
    description: '草原牛羊，奶食丰富，烤煮为要',
    representativeDishes: ['烤全羊', '手把肉', '奶茶', '奶豆腐', '蒙古馅饼'],
    personalityTraits: ['草原豪情', '粗犷真诚', '马背上的味'],
  },
];
