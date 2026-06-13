/**
 * P4: 批量生成 5 目录文案(约 280 条 JSON)
 * P5: dishes.json(约 80 道中国菜)
 *
 * 无 LLM 依赖——所有文案内联硬编码,确保构建期可验证。
 * 运行: node scripts/generate-content.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'food-quiz', 'src', 'content');

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }
function writeJSON(dir, filename, data) {
  const filepath = join(dir, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ===================== P4: 5 文案目录 =====================

// --- 1. intervals/ (256 条) ---
// 每条对应一个 8-bit 索引(S/T/K/L/I/X/C/N,大写=高档)
const DIM_NAMES = ['酸','甜','苦','辣','咸','浓','脆','嫩'];
const DIM_LETTERS = ['S','T','K','L','I','X','C','N'];
const intervalDir = join(CONTENT_DIR, 'intervals');
ensureDir(intervalDir);

// 基础区间文案模板(按"有几个高位"分组)
const lowTone = ['温和内敛','不争不抢','随性自然','低调平和','淡然处之','波澜不惊','清新寡欲','素净恬淡'];
const highTone = ['浓墨重彩','极致张扬','锋芒毕露','个性鲜明','张扬大胆','不甘平庸','特立独行','锋利果断'];

for (let i = 0; i < 256; i++) {
  const key = i.toString(2).padStart(8, '0');
  const bits = key.split('').map(Number); // 8-bit
  const highDims = [];
  const lowDims = [];
  bits.forEach((b, idx) => {
    if (b === 1) highDims.push(DIM_NAMES[idx]);
    else lowDims.push(DIM_NAMES[idx]);
  });
  const highCount = highDims.length;

  // 档位标签: 8字母串
  const letters = DIM_LETTERS.map((c, idx) => bits[idx] ? c : c.toLowerCase()).join('');

  // 生成 label + copy
  let label = '', copy = '';
  if (highCount === 0) {
    label = '味觉素人';
    copy = '什么都行,什么都不挑,味觉世界对你而言就是一张白纸。';
  } else if (highCount <= 2) {
    label = `轻${highDims[0]}`;
    copy = `${highDims.join('与')}的微妙偏好,让你的味觉有了一点点方向。`;
  } else if (highCount <= 4) {
    label = `${highDims[0]}系偏锋`;
    copy = `${highDims.join('、')}是你最鲜明的味觉标签,你对食物的偏好非常明确。`;
  } else if (highCount <= 6) {
    label = '重口味探路者';
    copy = `你在${highDims.join('、')}上表现出强烈的偏好,口味偏重。`;
  } else if (highCount === 7) {
    label = '八维全才';
    copy = `几乎每个维度都被激活,你是个不折不扣的味觉全才,什么都能欣赏。`;
  } else {
    label = '味觉深渊行者';
    copy = '所有维度全开,你就是那个什么都不怕的极致老饕。';
  }

  writeJSON(intervalDir, `${String(i).padStart(3, '0')}.json`, {
    index: i,
    key: letters,
    label,
    copy
  });
}

console.log(`✅ intervals: 256 files`);

// --- 2. extreme/ (8 条) ---
const extremeDir = join(CONTENT_DIR, 'extreme');
ensureDir(extremeDir);
const extremeData = {
  s: { dim:'sour', letter:'s', label:'极酸', threshold:90, copy:['酸到灵魂出窍,牙齿在喊救命','酸是你的快乐源泉,别人都皱眉你却在笑'] },
  t: { dim:'sweet', letter:'t', label:'极甜', threshold:90, copy:['甜到齁也要继续吃,糖是你的续命药','全世界的糖分都不够你一个人消耗'] },
  k: { dim:'bitter', letter:'k', label:'极苦', threshold:90, copy:['苦到皱眉也要往下咽,痛并快乐着','你和苦瓜是知己,和咖啡是灵魂伴侣'] },
  l: { dim:'spicy', letter:'l', label:'极辣', threshold:90, copy:['🔥 辣到冒汗也要继续,辣椒是你的信仰','你的胃已经提交了辞呈,但你还在加辣'] },
  i: { dim:'salty', letter:'i', label:'极咸', threshold:90, copy:['咸到齁也要加盐,你的味蕾需要重度刺激','你的钠摄入量让营养师连夜辞职'] },
  x: { dim:'rich', letter:'x', label:'极浓', threshold:90, copy:['口味重到天花板,什么都要最浓烈的味道','浓到化不开的味道才是你的真爱'] },
  c: { dim:'crunchy', letter:'c', label:'极脆', threshold:90, copy:['⚡ 咬下去咔嚓响才是正经事','脆是你的快乐开关,嘎嘣脆停不下来'] },
  n: { dim:'tender', letter:'n', label:'极嫩', threshold:90, copy:['嫩到入口即化才是正义','软糯滑嫩的食物让你毫无抵抗力'] },
};
Object.entries(extremeData).forEach(([letter, data]) => {
  writeJSON(extremeDir, `${letter}.json`, data);
});
console.log(`✅ extreme: 8 files`);

// --- 3. synergies/ (10 配对 + 1 fallback) ---
const synergyDir = join(CONTENT_DIR, 'synergies');
ensureDir(synergyDir);
const synergyPairs = [
  { a:'s', b:'t', label:'酸甜双煞', copy:['酸酸甜甜就是你的味觉密码','酸甜碰撞,舌头上的烟花秀'] },
  { a:'s', b:'l', label:'酸辣狂徒', copy:['酸辣的极致碰撞,你就是行走的酸辣粉','酸加辣,越吃越过瘾'] },
  { a:'s', b:'x', label:'酸浓派', copy:['酸味遇上浓香,味觉的化学反应开始了','酸鲜并重,让味蕾彻底沦陷'] },
  { a:'t', b:'k', label:'甜苦哲学家', copy:['先甜后苦的味觉哲学,你全懂','甜与苦的交织,人生的缩影'] },
  { a:'t', b:'x', label:'甜浓大师', copy:['甜+浓的双重享受,你就是味觉界的甜品大师','浓郁的甜味让你欲罢不能'] },
  { a:'l', b:'x', label:'鲜辣双煞', copy:['🔥 鲜辣双煞,味觉的火上浇油组合','辣椒遇见鲜味,舌头在开派对'] },
  { a:'l', b:'i', label:'麻辣组合', copy:['麻与辣的完美搭档,你就是火锅的灵魂','麻辣碰撞,越吃越上头'] },
  { a:'k', b:'c', label:'苦脆先锋', copy:['苦味配脆感,硬核派的味觉实验','苦中作脆,独特到无人能懂'] },
  { a:'x', b:'n', label:'浓嫩组合', copy:['浓味遇上嫩感,软糯的极致享受','浓香滑嫩,味觉的温柔一刀'] },
  { a:'c', b:'n', label:'脆嫩双修', copy:['脆与嫩的双重满足,口感界的双修者','脆嫩兼得,嘴里开了一场音乐会'] },
];
synergyPairs.forEach(({a, b, label, copy}) => {
  const key = [a, b].sort().join('-');
  writeJSON(synergyDir, `${key}.json`, {
    pair: [a, b],
    letters: [a, b],
    label,
    copy
  });
});
writeJSON(synergyDir, '_fallback.json', {
  id: '_fallback',
  label: '强强联合',
  copy: ['你的两个最强维度正在组队,味觉界的新组合诞生了','双维度共振,让你的味觉体验再升级','两大维度强强联手,无辣不欢的你准备好了吗']
});
console.log(`✅ synergies: 11 files`);

// --- 4. allround/ (1 index + 4 entries) ---
const allroundDir = join(CONTENT_DIR, 'allround');
ensureDir(allroundDir);
const allroundEntries = [
  { id:'01', label:'味觉端水大师', copy:['什么都能吃,什么都好吃,你就是餐桌上的和事佬','8 维均匀分布,堪称味觉界的端水艺术家','朋友聚餐选不出餐厅?找你准没错'] },
  { id:'02', label:'混沌全能', copy:['你的味觉就像薛定谔的猫,不打开盘子你也不知道自己想吃什么','无招胜有招,你的味觉已经超越了维度的束缚','你不是没有口味,而是所有口味都在线'] },
  { id:'03', label:'味觉海绵', copy:['什么都能接受,什么都能消化,你是食物界的海绵宝宝','不挑食的最高境界就是你这样的人','世间万物皆可入你的口'] },
  { id:'04', label:'兼容之王', copy:['你的味觉兼容性太强了,请直接来当试吃员','什么菜系到你嘴里都能及格,你是美食界的万能钥匙','八大菜系在你面前排排站,你雨露均沾'] },
];
writeJSON(allroundDir, '_index.json', { module:'allround', id:'_index', ids:allroundEntries.map(e=>e.id) });
allroundEntries.forEach(e => writeJSON(allroundDir, `${e.id}.json`, e));
console.log(`✅ allround: ${1 + allroundEntries.length} files`);

// --- 5. avoid/ (1 index + 8 entries) ---
const avoidDir = join(CONTENT_DIR, 'avoid');
ensureDir(avoidDir);
const avoidData = [
  { letter:'s', dim:'sour', label:'酸味绝缘体', threshold:20, copy:['看到柠檬就倒牙的你,还是远离酸辣粉吧','酸味是你的禁区,醋壶离你越远越好'] },
  { letter:'t', dim:'sweet', label:'甜品恐惧症', threshold:20, copy:['过甜的东西让你皱眉,奶茶只喝无糖','甜食是你的天敌,蛋糕在你面前瑟瑟发抖'] },
  { letter:'k', dim:'bitter', label:'苦味回避者', threshold:20, copy:['苦瓜咖啡统统退散,你的人生不能有苦味','闻到苦味就想跑,你的字典里没有苦字'] },
  { letter:'l', dim:'spicy', label:'辣椒绝缘体', threshold:20, copy:['微辣就是你的极限,火锅永远点鸳鸯锅','辣度超过你的阈值就会触发逃生机制'] },
  { letter:'i', dim:'salty', label:'重盐回避', threshold:20, copy:['高盐食物让你口渴一整天,清淡才是真爱','你的身体在抗议过度的钠摄入'] },
  { letter:'x', dim:'rich', label:'浓味过敏', threshold:20, copy:['味道太重的东西让你吃不下第二口','你的味蕾偏爱清爽,浓烈的味道是负担'] },
  { letter:'c', dim:'crunchy', label:'脆度无感', threshold:20, copy:['咬不动的东西你就放弃了,软烂才是你的菜','你的牙齿和脆感之间有一道鸿沟'] },
  { letter:'n', dim:'tender', label:'嫩度绝缘体', threshold:20, copy:['入口即化?不存在的,你就喜欢有嚼劲的','太软的东西让你没有食欲'] },
];
writeJSON(avoidDir, '_index.json', { module:'avoid', id:'_index', ids:avoidData.map(e=>e.letter) });
avoidData.forEach(e => writeJSON(avoidDir, `${e.letter}.json`, e));
console.log(`✅ avoid: ${1 + avoidData.length} files`);

// ===================== P5: dishes.json =====================
// 80 道中国菜,覆盖 8 大菜系 + 区域特色
const dishesDir = join(CONTENT_DIR);
const dishes = [
  // 川菜
  { name:'麻婆豆腐', cuisine:'川菜', region:'四川', vector:{sour:15,sweet:5,bitter:2,spicy:80,salty:60,rich:50,crunchy:10,tender:70} },
  { name:'水煮鱼', cuisine:'川菜', region:'四川', vector:{sour:5,sweet:2,bitter:0,spicy:95,salty:70,rich:60,crunchy:5,tender:80} },
  { name:'火锅', cuisine:'川菜', region:'四川', vector:{sour:10,sweet:5,bitter:0,spicy:85,salty:65,rich:70,crunchy:30,tender:50} },
  { name:'宫保鸡丁', cuisine:'川菜', region:'四川', vector:{sour:20,sweet:15,bitter:0,spicy:60,salty:55,rich:45,crunchy:40,tender:60} },
  { name:'夫妻肺片', cuisine:'川菜', region:'四川', vector:{sour:5,sweet:2,bitter:0,spicy:70,salty:60,rich:55,crunchy:20,tender:55} },
  { name:'回锅肉', cuisine:'川菜', region:'四川', vector:{sour:5,sweet:5,bitter:0,spicy:50,salty:60,rich:65,crunchy:15,tender:50} },
  { name:'担担面', cuisine:'川菜', region:'四川', vector:{sour:10,sweet:5,bitter:0,spicy:65,salty:70,rich:50,crunchy:10,tender:40} },
  { name:'钵钵鸡', cuisine:'川菜', region:'四川', vector:{sour:5,sweet:5,bitter:0,spicy:75,salty:55,rich:40,crunchy:30,tender:50} },
  // 粤菜
  { name:'白切鸡', cuisine:'粤菜', region:'广东', vector:{sour:5,sweet:10,bitter:2,spicy:5,salty:40,rich:75,crunchy:15,tender:90} },
  { name:'虾饺', cuisine:'粤菜', region:'广东', vector:{sour:2,sweet:15,bitter:0,spicy:0,salty:45,rich:80,crunchy:10,tender:90} },
  { name:'烧腊', cuisine:'粤菜', region:'广东', vector:{sour:0,sweet:10,bitter:0,spicy:2,salty:55,rich:70,crunchy:40,tender:50} },
  { name:'叉烧', cuisine:'粤菜', region:'广东', vector:{sour:0,sweet:30,bitter:0,spicy:0,salty:40,rich:60,crunchy:20,tender:55} },
  { name:'煲仔饭', cuisine:'粤菜', region:'广东', vector:{sour:5,sweet:5,bitter:0,spicy:5,salty:55,rich:65,crunchy:40,tender:45} },
  { name:'肠粉', cuisine:'粤菜', region:'广东', vector:{sour:10,sweet:5,bitter:0,spicy:0,salty:45,rich:60,crunchy:5,tender:85} },
  { name:'蒸凤爪', cuisine:'粤菜', region:'广东', vector:{sour:0,sweet:10,bitter:0,spicy:5,salty:50,rich:55,crunchy:10,tender:75} },
  // 鲁菜
  { name:'糖醋鲤鱼', cuisine:'鲁菜', region:'山东', vector:{sour:35,sweet:40,bitter:0,spicy:0,salty:30,rich:50,crunchy:45,tender:40} },
  { name:'九转大肠', cuisine:'鲁菜', region:'山东', vector:{sour:10,sweet:15,bitter:5,spicy:5,salty:55,rich:70,crunchy:20,tender:40} },
  { name:'葱烧海参', cuisine:'鲁菜', region:'山东', vector:{sour:0,sweet:5,bitter:2,spicy:0,salty:40,rich:80,crunchy:5,tender:70} },
  { name:'锅包肉', cuisine:'鲁菜', region:'辽宁', vector:{sour:15,sweet:25,bitter:0,spicy:0,salty:30,rich:45,crunchy:55,tender:40} },
  { name:'德州扒鸡', cuisine:'鲁菜', region:'山东', vector:{sour:0,sweet:5,bitter:0,spicy:0,salty:50,rich:65,crunchy:10,tender:80} },
  // 湘菜
  { name:'剁椒鱼头', cuisine:'湘菜', region:'湖南', vector:{sour:10,sweet:2,bitter:0,spicy:85,salty:55,rich:60,crunchy:5,tender:70} },
  { name:'辣椒炒肉', cuisine:'湘菜', region:'湖南', vector:{sour:0,sweet:0,bitter:0,spicy:75,salty:55,rich:55,crunchy:25,tender:45} },
  { name:'臭豆腐', cuisine:'湘菜', region:'湖南', vector:{sour:5,sweet:0,bitter:5,spicy:60,salty:50,rich:40,crunchy:35,tender:60} },
  { name:'毛氏红烧肉', cuisine:'湘菜', region:'湖南', vector:{sour:0,sweet:15,bitter:0,spicy:15,salty:55,rich:75,crunchy:5,tender:80} },
  { name:'湘西腊肉', cuisine:'湘菜', region:'湖南', vector:{sour:0,sweet:5,bitter:2,spicy:30,salty:70,rich:60,crunchy:15,tender:40} },
  // 苏菜
  { name:'松鼠桂鱼', cuisine:'苏菜', region:'江苏', vector:{sour:25,sweet:35,bitter:0,spicy:0,salty:25,rich:45,crunchy:40,tender:35} },
  { name:'狮子头', cuisine:'苏菜', region:'江苏', vector:{sour:0,sweet:10,bitter:0,spicy:0,salty:45,rich:65,crunchy:5,tender:80} },
  { name:'盐水鸭', cuisine:'苏菜', region:'江苏', vector:{sour:0,sweet:0,bitter:0,spicy:0,salty:60,rich:55,crunchy:10,tender:65} },
  { name:'蟹黄汤包', cuisine:'苏菜', region:'江苏', vector:{sour:0,sweet:5,bitter:0,spicy:0,salty:50,rich:85,crunchy:5,tender:85} },
  { name:'文思豆腐', cuisine:'苏菜', region:'江苏', vector:{sour:0,sweet:2,bitter:0,spicy:0,salty:35,rich:70,crunchy:5,tender:95} },
  // 浙菜
  { name:'西湖醋鱼', cuisine:'浙菜', region:'浙江', vector:{sour:45,sweet:10,bitter:0,spicy:0,salty:20,rich:40,crunchy:5,tender:65} },
  { name:'东坡肉', cuisine:'浙菜', region:'浙江', vector:{sour:0,sweet:20,bitter:0,spicy:0,salty:40,rich:70,crunchy:5,tender:85} },
  { name:'龙井虾仁', cuisine:'浙菜', region:'浙江', vector:{sour:5,sweet:5,bitter:5,spicy:0,salty:35,rich:65,crunchy:20,tender:80} },
  { name:'叫花鸡', cuisine:'浙菜', region:'浙江', vector:{sour:0,sweet:5,bitter:0,spicy:0,salty:45,rich:60,crunchy:15,tender:75} },
  // 闽菜
  { name:'佛跳墙', cuisine:'闽菜', region:'福建', vector:{sour:0,sweet:5,bitter:2,spicy:0,salty:40,rich:90,crunchy:15,tender:70} },
  { name:'荔枝肉', cuisine:'闽菜', region:'福建', vector:{sour:15,sweet:30,bitter:0,spicy:5,salty:35,rich:45,crunchy:25,tender:55} },
  { name:'沙茶面', cuisine:'闽菜', region:'福建', vector:{sour:5,sweet:10,bitter:0,spicy:20,salty:55,rich:50,crunchy:15,tender:40} },
  { name:'海蛎煎', cuisine:'闽菜', region:'福建', vector:{sour:0,sweet:0,bitter:0,spicy:5,salty:50,rich:65,crunchy:35,tender:50} },
  // 徽菜
  { name:'臭鳜鱼', cuisine:'徽菜', region:'安徽', vector:{sour:10,sweet:5,bitter:3,spicy:10,salty:55,rich:70,crunchy:10,tender:60} },
  { name:'毛豆腐', cuisine:'徽菜', region:'安徽', vector:{sour:5,sweet:0,bitter:2,spicy:15,salty:50,rich:55,crunchy:20,tender:70} },
  { name:'一品锅', cuisine:'徽菜', region:'安徽', vector:{sour:0,sweet:5,bitter:0,spicy:10,salty:50,rich:60,crunchy:20,tender:55} },
  { name:'火腿炖甲鱼', cuisine:'徽菜', region:'安徽', vector:{sour:0,sweet:0,bitter:2,spicy:0,salty:45,rich:75,crunchy:5,tender:70} },
  // 京菜
  { name:'北京烤鸭', cuisine:'京菜', region:'北京', vector:{sour:0,sweet:5,bitter:0,spicy:0,salty:50,rich:70,crunchy:60,tender:65} },
  { name:'涮羊肉', cuisine:'京菜', region:'北京', vector:{sour:5,sweet:0,bitter:0,spicy:10,salty:45,rich:65,crunchy:10,tender:80} },
  { name:'炸酱面', cuisine:'京菜', region:'北京', vector:{sour:5,sweet:5,bitter:0,spicy:5,salty:65,rich:45,crunchy:15,tender:35} },
  { name:'卤煮火烧', cuisine:'京菜', region:'北京', vector:{sour:0,sweet:0,bitter:3,spicy:15,salty:70,rich:55,crunchy:20,tender:40} },
  // 沪菜
  { name:'红烧肉', cuisine:'沪菜', region:'上海', vector:{sour:0,sweet:25,bitter:0,spicy:0,salty:45,rich:70,crunchy:5,tender:75} },
  { name:'小笼包', cuisine:'沪菜', region:'上海', vector:{sour:5,sweet:5,bitter:0,spicy:0,salty:50,rich:65,crunchy:5,tender:80} },
  { name:'生煎', cuisine:'沪菜', region:'上海', vector:{sour:0,sweet:2,bitter:0,spicy:0,salty:50,rich:55,crunchy:50,tender:50} },
  // 渝菜
  { name:'酸辣粉', cuisine:'渝菜', region:'重庆', vector:{sour:40,sweet:0,bitter:0,spicy:75,salty:55,rich:45,crunchy:5,tender:35} },
  { name:'辣子鸡', cuisine:'渝菜', region:'重庆', vector:{sour:0,sweet:0,bitter:0,spicy:90,salty:55,rich:40,crunchy:35,tender:40} },
  { name:'重庆小面', cuisine:'渝菜', region:'重庆', vector:{sour:10,sweet:2,bitter:0,spicy:80,salty:65,rich:45,crunchy:10,tender:30} },
  // 陕西菜
  { name:'肉夹馍', cuisine:'陕菜', region:'陕西', vector:{sour:5,sweet:2,bitter:0,spicy:10,salty:55,rich:50,crunchy:35,tender:50} },
  { name:'凉皮', cuisine:'陕菜', region:'陕西', vector:{sour:25,sweet:5,bitter:0,spicy:30,salty:45,rich:20,crunchy:15,tender:40} },
  { name:'羊肉泡馍', cuisine:'陕菜', region:'陕西', vector:{sour:0,sweet:0,bitter:2,spicy:10,salty:50,rich:70,crunchy:30,tender:35} },
  // 东北菜
  { name:'锅包肉', cuisine:'东北菜', region:'辽宁', vector:{sour:15,sweet:25,bitter:0,spicy:0,salty:30,rich:45,crunchy:55,tender:40} },
  { name:'地三鲜', cuisine:'东北菜', region:'黑龙江', vector:{sour:5,sweet:5,bitter:0,spicy:10,salty:45,rich:40,crunchy:30,tender:50} },
  { name:'酸菜白肉', cuisine:'东北菜', region:'吉林', vector:{sour:35,sweet:0,bitter:0,spicy:5,salty:45,rich:50,crunchy:10,tender:55} },
  { name:'杀猪菜', cuisine:'东北菜', region:'黑龙江', vector:{sour:10,sweet:0,bitter:0,spicy:10,salty:60,rich:55,crunchy:15,tender:45} },
  // 湖北菜
  { name:'热干面', cuisine:'鄂菜', region:'湖北', vector:{sour:5,sweet:5,bitter:0,spicy:10,salty:65,rich:40,crunchy:5,tender:30} },
  { name:'武昌鱼', cuisine:'鄂菜', region:'湖北', vector:{sour:5,sweet:2,bitter:0,spicy:5,salty:40,rich:55,crunchy:5,tender:70} },
  // 西北菜
  { name:'大盘鸡', cuisine:'西北菜', region:'新疆', vector:{sour:5,sweet:5,bitter:0,spicy:50,salty:55,rich:50,crunchy:20,tender:50} },
  { name:'手抓饭', cuisine:'西北菜', region:'新疆', vector:{sour:0,sweet:10,bitter:0,spicy:15,salty:45,rich:55,crunchy:20,tender:40} },
  { name:'烤羊肉串', cuisine:'西北菜', region:'新疆', vector:{sour:0,sweet:0,bitter:0,spicy:40,salty:55,rich:50,crunchy:30,tender:45} },
  // 云南菜
  { name:'过桥米线', cuisine:'云菜', region:'云南', vector:{sour:10,sweet:5,bitter:0,spicy:20,salty:40,rich:55,crunchy:15,tender:40} },
  { name:'汽锅鸡', cuisine:'云菜', region:'云南', vector:{sour:0,sweet:2,bitter:0,spicy:5,salty:35,rich:70,crunchy:5,tender:85} },
  // 贵州菜
  { name:'酸汤鱼', cuisine:'黔菜', region:'贵州', vector:{sour:45,sweet:5,bitter:0,spicy:50,salty:40,rich:55,crunchy:5,tender:60} },
  { name:'折耳根炒肉', cuisine:'黔菜', region:'贵州', vector:{sour:10,sweet:0,bitter:5,spicy:30,salty:45,rich:40,crunchy:20,tender:45} },
  // 海南菜
  { name:'文昌鸡', cuisine:'琼菜', region:'海南', vector:{sour:0,sweet:5,bitter:0,spicy:5,salty:40,rich:70,crunchy:5,tender:85} },
  { name:'椰子鸡', cuisine:'琼菜', region:'海南', vector:{sour:0,sweet:15,bitter:0,spicy:0,salty:30,rich:65,crunchy:5,tender:80} },
  // 广西菜
  { name:'螺蛳粉', cuisine:'桂菜', region:'广西', vector:{sour:30,sweet:0,bitter:2,spicy:40,salty:55,rich:35,crunchy:15,tender:30} },
  { name:'桂林米粉', cuisine:'桂菜', region:'广西', vector:{sour:10,sweet:2,bitter:0,spicy:15,salty:50,rich:40,crunchy:5,tender:35} },
  // 内蒙古
  { name:'手把肉', cuisine:'蒙餐', region:'内蒙古', vector:{sour:0,sweet:0,bitter:0,spicy:0,salty:35,rich:65,crunchy:5,tender:70} },
  { name:'烤全羊', cuisine:'蒙餐', region:'内蒙古', vector:{sour:0,sweet:0,bitter:0,spicy:10,salty:50,rich:60,crunchy:30,tender:55} },
  // 台湾
  { name:'卤肉饭', cuisine:'台菜', region:'台湾', vector:{sour:0,sweet:10,bitter:0,spicy:0,salty:55,rich:60,crunchy:5,tender:65} },
  { name:'盐酥鸡', cuisine:'台菜', region:'台湾', vector:{sour:0,sweet:2,bitter:0,spicy:15,salty:55,rich:40,crunchy:50,tender:45} },
  // 天津
  { name:'狗不理包子', cuisine:'津菜', region:'天津', vector:{sour:0,sweet:2,bitter:0,spicy:0,salty:50,rich:55,crunchy:5,tender:70} },
  // 江西菜
  { name:'三杯鸡', cuisine:'赣菜', region:'江西', vector:{sour:0,sweet:10,bitter:2,spicy:30,salty:50,rich:65,crunchy:10,tender:60} },
  // 河南菜
  { name:'烩面', cuisine:'豫菜', region:'河南', vector:{sour:0,sweet:2,bitter:0,spicy:10,salty:50,rich:50,crunchy:10,tender:40} },
  // 西藏
  { name:'酥油茶', cuisine:'藏餐', region:'西藏', vector:{sour:0,sweet:0,bitter:2,spicy:0,salty:35,rich:70,crunchy:5,tender:20} },
  { name:'糌粑', cuisine:'藏餐', region:'西藏', vector:{sour:0,sweet:2,bitter:0,spicy:0,salty:20,rich:50,crunchy:15,tender:25} },
  // 宁夏
  { name:'手抓羊肉', cuisine:'清真菜', region:'宁夏', vector:{sour:0,sweet:0,bitter:0,spicy:15,salty:40,rich:60,crunchy:5,tender:70} },
  // 傣菜
  { name:'孔雀宴', cuisine:'傣菜', region:'云南', vector:{sour:20,sweet:10,bitter:2,spicy:55,salty:40,rich:45,crunchy:30,tender:50} },
  { name:'舂鸡脚', cuisine:'傣菜', region:'云南', vector:{sour:25,sweet:5,bitter:0,spicy:45,salty:40,rich:30,crunchy:25,tender:60} },
  // 新疆
  { name:'馕', cuisine:'西北菜', region:'新疆', vector:{sour:0,sweet:2,bitter:0,spicy:5,salty:40,rich:35,crunchy:50,tender:20} },
];

writeJSON(dishesDir, 'dishes.json', dishes);
console.log(`✅ dishes: ${dishes.length} entries`);

// ===================== 汇总 =====================
console.log('\n🎉 P4+P5 完成!内容文件已落盘到 src/content/');