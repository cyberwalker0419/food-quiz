// scripts/fix-sour.mjs
// regen 后 sour 密度 24.37<25(dish-vs-dish 菜品酸味弱)→ 机制C 跳过 sour。补 6 道 sour 高权题提密度到≥26。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');
const bank = JSON.parse(readFileSync(QPATH, 'utf-8'));
const W = (o) => ({ sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0, ...o });
const Q = [
  ['柠檬汁和老陈醋，哪种酸更让你皱眉？', ['柠檬汁', W({ sour: 75, sweet: 15 })], ['老陈醋', W({ sour: 88, salty: 20, rich: 15 })]],
  ['酸梅汤和柠檬水，夏天你先灌哪杯？', ['酸梅汤', W({ sour: 60, sweet: 40, temperature: -30 })], ['柠檬水', W({ sour: 70, sweet: 10, temperature: -20 })]],
  ['酸菜鱼和醋溜白菜，哪个的酸更勾你？', ['酸菜鱼', W({ sour: 78, spicy: 50, salty: 40, tender: 40 })], ['醋溜白菜', W({ sour: 82, salty: 25, crunchy: 30 })]],
  ['青柠和黄柠，调酸味你用哪个？', ['青柠', W({ sour: 80, sweet: 5 })], ['黄柠', W({ sour: 70, sweet: 20 })]],
  ['酸汤肥牛和番茄牛腩，你端哪个？', ['酸汤肥牛', W({ sour: 75, spicy: 55, salty: 40, rich: 45, tender: 35 })], ['番茄牛腩', W({ sour: 55, sweet: 30, salty: 35, tender: 40 })]],
  ['山楂和话梅，馋酸你嚼哪个？', ['山楂', W({ sour: 85, sweet: 30 })], ['话梅', W({ sour: 70, sweet: 25, salty: 25 })]],
];
let maxN = 0; for (const q of bank.questions) { const m = /^q(\d+)$/.exec(q.id); if (m) maxN = Math.max(maxN, +m[1]); }
for (let i = 0; i < Q.length; i++) {
  const [stem, a, b] = Q[i];
  bank.questions.push({ id: `q${maxN + 1 + i}`, stem, options: [{ id: 'a', label: a[0], weights: a[1] }, { id: 'b', label: b[0], weights: b[1] }], topics: ['format.dish-vs-dish', 'flavor-axis.sour-driven'] });
}
writeFileSync(QPATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');
let st = 0; for (const q of bank.questions) for (const o of q.options) st += Math.abs(o.weights.sour || 0);
console.log(`补 ${Q.length} sour 题 → 总 ${bank.questions.length}; sour 密度 ${(st / bank.questions.length).toFixed(2)}`);
