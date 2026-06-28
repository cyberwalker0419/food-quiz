// scripts/add-temperature-questions.mjs
// 追加 8 道温度维题(4 hot + 2 cold + 2 负权探针),解瓶颈③:
// 温度维密度 24.8 → ~28(过 BANK_MIN_DENSITY=25),≤-40 负权探针 1 → 7(消除 coverage 约束3 单点)。
// 温度正权=热食(q64 已证),负权=冷食/避热。weights 自定义(温度主导,场景偏好题非纯菜品)。
// 题干自然中文语序,T7 humanizer 再润色。topics 手挂(temperature.* + format.scenario-hook)。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');
const bank = JSON.parse(readFileSync(QPATH, 'utf-8'));

// 找最大数字 id,新题用 q{max+1}..
let maxN = 0;
for (const q of bank.questions) {
  const m = /^q(\d+)$/.exec(q.id);
  if (m) maxN = Math.max(maxN, +m[1]);
}

const W = (o) => ({
  sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0, ...o,
});

const newQs = [
  {
    stem: '数九寒天推开门，先想捧一口热汤，还是先剥根冰棍？',
    options: [
      { id: 'a', label: '先来口热汤暖暖', weights: W({ temperature: 85, tender: 40, rich: 30, salty: 20 }) },
      { id: 'b', label: '就馋根冰棍', weights: W({ temperature: -55, sweet: 50 }) },
    ],
    topics: ['temperature.hot', 'format.scenario-hook'],
  },
  {
    stem: '连下三天雨，砂锅咕嘟冒着热气，凉拌拍黄瓜还带着冰碴，你扑哪个？',
    options: [
      { id: 'a', label: '扑向砂锅', weights: W({ temperature: 88, rich: 40, tender: 30, crunchy: 15 }) },
      { id: 'b', label: '夹拍黄瓜', weights: W({ temperature: -25, crunchy: 55, sour: 20 }) },
    ],
    topics: ['temperature.hot', 'format.scenario-hook'],
  },
  {
    stem: '刚从冷风里缩回来，第一口想下肚的是滚烫的，还是常温的？',
    options: [
      { id: 'a', label: '滚烫的', weights: W({ temperature: 90 }) },
      { id: 'b', label: '常温就行', weights: W({ temperature: 10 }) },
    ],
    topics: ['temperature.hot', 'format.preference-strength'],
  },
  {
    stem: '朋友大冬天硬拉你去吃冰，你心里其实一直惦记一口热乎的？',
    options: [
      { id: 'a', label: '是，惦记热乎的', weights: W({ temperature: 80, rich: 20 }) },
      { id: 'b', label: '不，真想吃冰', weights: W({ temperature: -50, sweet: 40 }) },
    ],
    topics: ['temperature.hot', 'format.scenario-hook'],
  },
  {
    stem: '三伏天正午，一碗刨冰和一碗热汤面摆一块，你端哪个？',
    options: [
      { id: 'a', label: '端刨冰', weights: W({ temperature: -82, sweet: 55 }) },
      { id: 'b', label: '端热汤面', weights: W({ temperature: 70, salty: 30, tender: 20 }) },
    ],
    topics: ['temperature.cold', 'format.scenario-hook'],
  },
  {
    stem: '大暑天出门回来，冰镇酸梅汤和现煮热茶，你先灌哪杯？',
    options: [
      { id: 'a', label: '冰镇酸梅汤', weights: W({ temperature: -78, sour: 40, sweet: 25 }) },
      { id: 'b', label: '现煮热茶', weights: W({ temperature: 55 }) },
    ],
    topics: ['temperature.cold', 'format.scenario-hook'],
  },
  {
    stem: '盛夏三伏，有人拉你去吃刚沸腾打滚的麻辣火锅，你的本能反应？',
    options: [
      { id: 'a', label: '兴奋，走起', weights: W({ temperature: 15, spicy: 75, rich: 40 }) },
      { id: 'b', label: '连连摆手', weights: W({ temperature: -48 }) },
    ],
    topics: ['temperature.cold', 'format.ingredient-attitude'],
  },
  {
    stem: '看见有人零下十度还在舔冰棍，你的真实想法？',
    options: [
      { id: 'a', label: '羡慕，也想来一根', weights: W({ temperature: -52, sweet: 30 }) },
      { id: 'b', label: '完全不能理解', weights: W({ temperature: 25 }) },
    ],
    topics: ['temperature.cold', 'format.ingredient-attitude'],
  },
];

const withIds = newQs.map((q, i) => ({ id: `q${maxN + 1 + i}`, ...q }));
bank.questions.push(...withIds);
writeFileSync(QPATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');

// 统计温度密度 + 探针
let totalTemp = 0;
let pos80 = 0;
let neg40 = 0;
for (const q of bank.questions) {
  for (const o of q.options) {
    const t = o.weights.temperature || 0;
    totalTemp += Math.abs(t);
    if (t >= 80) pos80++;
    if (t <= -40) neg40++;
  }
}
console.log(`新增 ${withIds.length} 题(id q${maxN + 1}..q${maxN + withIds.length})`);
console.log(`总题数: ${bank.questions.length}`);
console.log(`温度密度: ${(totalTemp / bank.questions.length).toFixed(2)}(阈值 25)`);
console.log(`温度≥80 选项: ${pos80}(高分探针)`);
console.log(`温度≤-40 选项: ${neg40}(负权探针,目标≥3)`);
