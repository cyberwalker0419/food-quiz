// scripts/regen-questions-v7.mjs
// 修 T9 质量缺陷(荒谬菜品对+重复):回退 q274+,同 cuisine 配对(合理对比)+菜品对去重,重生成到 450。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');
const DPATH = resolve(__dirname, '../food-quiz/src/content/dishes.json');
const bank = JSON.parse(readFileSync(QPATH, 'utf-8'));
const dishes = JSON.parse(readFileSync(DPATH, 'utf-8'));

// 回退 T9 新题(q274+),保 222(T5+T7 态)
bank.questions = bank.questions.filter((q) => { const m = /^q(\d+)$/.exec(q.id); return m && +m[1] < 274; });

const DIM_FLAVOR = { sour: 'flavor-axis.sour-driven', sweet: 'flavor-axis.sweet-driven', spicy: 'flavor-axis.spicy-driven', salty: 'flavor-axis.salty-driven', rich: 'flavor-axis.rich-driven', crunchy: 'flavor-axis.crunchy-driven', tender: 'flavor-axis.tender-driven' };
const CU_REGION = { 川菜: 'region.sichuan-chongqing', 渝菜: 'region.sichuan-chongqing', 粤菜: 'region.cantonese', 鲁菜: 'region.northern', 京菜: 'region.northern', 津菜: 'region.northern', 冀菜: 'region.northern', 豫菜: 'region.northern', 晋菜: 'region.northern', 东北菜: 'region.northern', 蒙餐: 'region.northern', 北方菜: 'region.northern', 苏菜: 'region.shanghai', 浙菜: 'region.shanghai', 沪菜: 'region.shanghai', 西北菜: 'region.northwest', 陕菜: 'region.northwest', 甘菜: 'region.northwest', 湘菜: 'region.hunan', 西餐: 'region.foreign' };
const dom = (v) => { let bd = 'rich', bm = -1; for (const d in DIM_FLAVOR) { if (Math.abs(v[d] || 0) > bm) { bm = Math.abs(v[d] || 0); bd = d; } } return bd; };
const ingTag = (d) => { const n = d.name; if (/虾|蟹|鱼|贝|海参|鱿鱼|鳝|鳗|蚝|带鱼|鲍|扇贝/.test(n)) return 'ingredient.seafood'; if (/面|饭|粉|饼|饺|包|粥|馍|糕|条/.test(n)) return 'ingredient.staple'; if (d.isVegetarian) return 'ingredient.vegetable'; return 'ingredient.meat'; };
const topicsOf = (fmt, d) => { const t = [fmt]; const r = CU_REGION[d.cuisine]; if (r) t.push(r); t.push(DIM_FLAVOR[dom(d.vector)]); t.push(ingTag(d)); const cats = new Set(); const out = []; for (const x of t) { const c = x.split('.')[0]; if (cats.has(c) || out.length >= 3) continue; cats.add(c); out.push(x); } return out; };

const pool = dishes.filter((d) => d.popular !== false && d.vector);
const byCu = {}; for (const d of pool) { (byCu[d.cuisine] ??= []).push(d); }
const cus = Object.keys(byCu).filter((c) => byCu[c].length >= 2);

const CTX = ['周末窝家', '加班到深夜', '朋友聚会', '生日宴上', '雨天午后', '大冷天', '三伏天', '夜宵时分', '早餐时刻', '发工资那天', '心情有点差', '感冒没啥胃口'];
const DVS = [
  (a, b, c) => `${a}和${b}摆一块，你先夹哪盘？`,
  (a, b, c) => `${c}，${a}还是${b}，更馋哪个？`,
  (a, b, c) => `${a}配${b}只能留一个，你留下谁？`,
  (a, b, c) => `${c}，桌上${a}和${b}，你筷子先伸向哪个？`,
  (a, b, c) => `${a}和${b}，今天你的胃更偏向哪个？`,
  (a, b, c) => `${c}，${a}和${b}的香味，哪个先勾住你？`,
  (a, b, c) => `菜单上${a}和${b}，${c}，你点哪个？`,
  (a, b, c) => `${a}还是${b}，${c}？`,
];

let maxN = 0; for (const q of bank.questions) { const m = /^q(\d+)$/.exec(q.id); if (m) maxN = Math.max(maxN, +m[1]); }
let nextId = maxN + 1;
const newQs = []; const seen = new Set(); let attempts = 0;
while (newQs.length < 216 && attempts < 8000) {
  attempts++;
  const cu = cus[Math.floor(Math.random() * cus.length)];
  const arr = byCu[cu];
  const d1 = arr[Math.floor(Math.random() * arr.length)];
  const d2 = arr[Math.floor(Math.random() * arr.length)];
  if (d1.name === d2.name) continue;
  const key = [d1.name, d2.name].sort().join('|');
  if (seen.has(key)) continue;
  seen.add(key);
  const rnd = newQs.length; const ctx = CTX[rnd % CTX.length];
  newQs.push({ id: `q${nextId++}`, stem: DVS[rnd % DVS.length](d1.name, d2.name, ctx), options: [{ id: 'a', label: d1.name, weights: { ...d1.vector } }, { id: 'b', label: d2.name, weights: { ...d2.vector } }], topics: topicsOf('format.dish-vs-dish', d1) });
}
// 12 道 3选项温度 smooth 题(提温度密度+smooth)
const W = (o) => ({ sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0, ...o });
const HOT = [['滚烫羊汤', W({ temperature: 85, tender: 30, rich: 25, salty: 15 })], ['刚出锅砂锅', W({ temperature: 88, rich: 35, tender: 25 })], ['热腾腾包子', W({ temperature: 82, tender: 40 })], ['沸腾火锅', W({ temperature: 86, spicy: 70, rich: 40 })]];
const WARM = [['温热奶茶', W({ temperature: 45, sweet: 35, rich: 20 })], ['常温豆浆', W({ temperature: 40, sweet: 25, rich: 15 })], ['温热的粥', W({ temperature: 48, salty: 20, tender: 30 })], ['暖过的黄酒', W({ temperature: 50, rich: 30 })]];
const COLD = [['冰镇可乐', W({ temperature: -70, sweet: 40 })], ['冰棍', W({ temperature: -75, sweet: 50 })], ['凉拌黄瓜', W({ temperature: -30, crunchy: 55, sour: 20 })], ['刨冰', W({ temperature: -82, sweet: 55 })]];
const SC = ['三九天推开门', '大冷天', '连阴雨', '冬天夜里', '刚从外面回来', '冻得直跺脚', '暖气停了', '刮大风', '春运候车', '滑雪回来', '加班到半夜', '淋了雨'];
for (let i = 0; i < 12; i++) { const h = HOT[i % 4], w = WARM[i % 4], c = COLD[i % 4]; newQs.push({ id: `q${nextId++}`, stem: `${SC[i % SC.length]}，${h[0]}、${w[0]}、${c[0]}，你端哪个？`, options: [{ id: 'a', label: h[0], weights: h[1] }, { id: 'b', label: w[0], weights: w[1] }, { id: 'c', label: c[0], weights: c[1] }], topics: ['temperature.hot', 'format.scenario-hook', 'ingredient.drink'] }); }

bank.questions.push(...newQs);
writeFileSync(QPATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');
let tt = 0, sm = 0; for (const q of bank.questions) { if (q.options.length >= 3) sm++; for (const o of q.options) tt += Math.abs(o.weights.temperature || 0); }
console.log(`回退到222 + 新增${newQs.length} → 总${bank.questions.length}; 温度密度${(tt / bank.questions.length).toFixed(2)}; smooth${(sm / bank.questions.length * 100).toFixed(0)}%`);
