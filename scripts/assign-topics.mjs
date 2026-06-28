// scripts/assign-topics.mjs
// 给 questions.json 每题自动挂 topics 多标签(点分 "大类.具体")。
// - 主标签(高可靠):题的"主导维"——该维 options 权重 range(max-min)最大 = 题让用户分化的维。
//   映射 flavor-axis.x-driven 或 temperature.hot/cold(看温度权方向)。
// - 副标签(尽力):format(stem 文本规则)、region/ingredient(关键词词典)。
// B 衰减只用 topics[0](主标签),故副标签粗糙不影响 B;主标签数值可靠。
// 不锁白名单:标签格式由 schema 校验,词表可增。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');

const DIMS = ['sour', 'sweet', 'temperature', 'spicy', 'salty', 'rich', 'crunchy', 'tender'];

// 维 → flavor-axis 标签(temperature 单独处理方向)
const DIM_TO_FLAVOR = {
  sour: 'flavor-axis.sour-driven',
  sweet: 'flavor-axis.sweet-driven',
  spicy: 'flavor-axis.spicy-driven',
  salty: 'flavor-axis.salty-driven',
  rich: 'flavor-axis.rich-driven',
  crunchy: 'flavor-axis.crunchy-driven',
  tender: 'flavor-axis.tender-driven',
};

// 地域词典(stem + options label 文本匹配)
const REGION_KW = {
  'region.sichuan-chongqing': ['麻婆', '水煮', '回锅', '火锅', '麻辣', '钵钵', '夫妻肺片', '辣子', '藤椒', '郫县', '重庆', '川菜', '鱼香', '担担'],
  'region.cantonese': ['烧鹅', '早茶', '肠粉', '煲仔', '白切', '老火', '粤菜', '广式', '虾饺', '叉烧', '煲', '凤爪', '艇仔'],
  'region.northern': ['烤鸭', '炸酱', '锅包', '地三鲜', '东北', '京菜', '鲁菜', '葱爆', '烙', '馒头', '羊汤', '京津冀', '饺子', '包子', '扒鸡', '九转'],
  'region.shanghai': ['小笼', '生煎', '红烧', '糖醋', '江浙', '沪', '本帮', '蟹粉', '糯米', '苏帮', '狮子头'],
  'region.northwest': ['泡馍', '拉面', '凉皮', '肉夹馍', '西北', 'biang', '臊子', '新疆', '兰州', '大盘鸡', '馕', '糌粑', '青稞'],
  'region.hunan': ['剁椒', '腊味', '湘菜', '臭豆腐', '小炒肉', '毛氏'],
  'region.foreign': ['披萨', '汉堡', '寿司', '咖喱', '韩式', '日式', '西餐', '意面', '牛排', '三明治', '刺身', ' taco', '塔可'],
};

// 食材词典
const ING_KW = {
  'ingredient.seafood': ['鱼', '虾', '蟹', '贝', '海鲜', '鲈', '带鱼', '三文鱼', '鱿鱼', '扇贝', '生蚝', '蛤'],
  'ingredient.meat': ['牛肉', '羊肉', '猪肉', '鸡肉', '鸭', '排骨', '红烧肉', '回锅肉', '牛排', '烤鸭', '鸡', '肉'],
  'ingredient.vegetable': ['蔬菜', '蔬', '素菜', '豆腐', '白菜', '西兰花', '菌', '笋', '藕', '青菜', '素'],
  'ingredient.staple': ['米饭', '面条', '米粉', '饼', '粥', '馒头', '饺子', '包子', '炒饭', '面', '饭', '粉'],
  'ingredient.snack': ['小吃', '零食', '串', '烧烤', '炸鸡', '煎饼', '夜宵'],
  'ingredient.drink': ['奶茶', '咖啡', '茶', '豆浆', '酸梅汤', '豆汁', '酒', '饮料', '果汁', '醪糟', '汽水', '可乐'],
  'ingredient.egg': ['鸡蛋', '番茄炒蛋', '蒸蛋', '蛋', '蛋黄'],
};

// format 推断(stem 文本)
function inferFormat(stem) {
  if (/(多大程度|多爱|多喜欢|有多|几分|强烈|程度)/.test(stem)) return 'format.preference-strength';
  if (/(接受|讨厌|不吃|敢不敢|能不能|受得了|忌口|偏爱|受不了)/.test(stem)) return 'format.ingredient-attitude';
  if (/(脆|嫩|软|硬|口感|嚼劲|酥|糯)/.test(stem)) return 'format.texture-pursuit';
  // 场景钩子(优先于二选一,因为场景题常含"更")
  if (/(饿|加班|生日|聚会|请客|约会|周末|夏天|冬天|下雨|天冷|深夜|夜宵|早餐|午饭|晚饭|推开门|眼前|摆在|桌上|招待|朋友来)/.test(stem)) return 'format.scenario-hook';
  if (/(还是|哪个|VS|对比|vs)/.test(stem)) return 'format.dish-vs-dish';
  return null;
}

// 题主导维:每维 options 权重 range(max-min),取最大(题让用户分化的维)
function dominantDims(q, topN = 2) {
  const scored = DIMS.map((d) => {
    let mx = -Infinity;
    let mn = Infinity;
    let absMax = 0;
    for (const o of q.options) {
      const w = o.weights[d] || 0;
      if (w > mx) mx = w;
      if (w < mn) mn = w;
      if (Math.abs(w) > absMax) absMax = Math.abs(w);
    }
    return { d, range: mx - mn, mx, absMax };
  }).sort((a, b) => b.range - a.range);
  return scored.slice(0, topN).filter((s) => s.range > 0);
}

function dimToTopic(d, q) {
  if (d === 'temperature') {
    // 温度方向:max 正→hot,max 负更绝对→cold
    let mxPos = 0;
    let mxNeg = 0;
    for (const o of q.options) {
      const w = o.weights.temperature || 0;
      if (w > mxPos) mxPos = w;
      if (w < mxNeg) mxNeg = w;
    }
    return Math.abs(mxPos) >= Math.abs(mxNeg) ? 'temperature.hot' : 'temperature.cold';
  }
  return DIM_TO_FLAVOR[d] ?? null;
}

function inferTopics(q) {
  const topics = [];
  const cats = new Set();
  const add = (t) => {
    if (!t) return;
    const cat = t.split('.')[0];
    if (cats.has(cat)) return;
    if (topics.length >= 3) return;
    cats.add(cat);
    topics.push(t);
  };
  // 主标签优先级:format(若识别) > 主导维 flavor-axis/temperature
  add(inferFormat(q.stem));
  const doms = dominantDims(q);
  for (const s of doms) add(dimToTopic(s.d, q));
  // region/ingredient 词典(文本匹配,各取首个命中)
  const text = q.stem + ' ' + q.options.map((o) => o.label).join(' ');
  for (const [topic, kws] of Object.entries(REGION_KW)) {
    if (kws.some((kw) => text.includes(kw))) { add(topic); break; }
  }
  for (const [topic, kws] of Object.entries(ING_KW)) {
    if (kws.some((kw) => text.includes(kw))) { add(topic); break; }
  }
  return topics;
}

// —— 主流程 ——
const raw = readFileSync(QPATH, 'utf-8');
const bank = JSON.parse(raw);
let noTopic = 0;
const mainDist = {}; // 主标签 topics[0] 分布
const allDist = {};  // 全部标签出现次数
for (const q of bank.questions) {
  const topics = inferTopics(q);
  if (topics.length === 0) {
    noTopic++;
    q.topics = ['flavor-axis.rich-driven']; // 兜底(不会发生,range>0 总有主导维)
  } else {
    q.topics = topics;
  }
  mainDist[q.topics[0]] = (mainDist[q.topics[0]] ?? 0) + 1;
  for (const t of q.topics) allDist[t] = (allDist[t] ?? 0) + 1;
}

writeFileSync(QPATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');

// 统计
console.log(`总题数: ${bank.questions.length}`);
console.log(`无 topics(兜底): ${noTopic}`);
console.log(`\n主标签(topics[0])分布:`);
for (const [t, n] of Object.entries(mainDist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(34)} ${n}`);
}
console.log(`\n全部标签出现次数:`);
for (const [t, n] of Object.entries(allDist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(34)} ${n}`);
}
