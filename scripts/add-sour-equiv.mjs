// scripts/add-sour-equiv.mjs
// 方向1:加 4 道 sour 80-88 等价题,让 mid undercovered 选 sour 时有多个等价候选(UCB 散,破 q505 outlier 垄断)。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');
const bank = JSON.parse(readFileSync(QPATH, 'utf-8'));
const W = (o) => ({ sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0, ...o });
const Q = [
  ['糖醋排骨和糖醋里脊，你更馋哪个的酸甜？', ['糖醋排骨', W({ sour: 60, sweet: 55, salty: 30, crunchy: 25, tender: 30 })], ['糖醋里脊', W({ sour: 65, sweet: 50, crunchy: 40, tender: 25 })]],
  ['酸豆角和泡椒，炒肉你用哪个的酸？', ['酸豆角', W({ sour: 85, salty: 40, spicy: 30, crunchy: 35 })], ['泡椒', W({ sour: 80, spicy: 60, salty: 25 })]],
  ['酸笋和酸萝卜，哪种酸更上头？', ['酸笋', W({ sour: 88, salty: 30, crunchy: 30 })], ['酸萝卜', W({ sour: 82, salty: 35, crunchy: 40 })]],
  ['百香果和西梅，馋酸你选哪个？', ['百香果', W({ sour: 78, sweet: 35 })], ['西梅', W({ sour: 72, sweet: 40 })]],
];
let maxN = 0; for (const q of bank.questions) { const m = /^q(\d+)$/.exec(q.id); if (m) maxN = Math.max(maxN, +m[1]); }
for (let i = 0; i < Q.length; i++) {
  const [stem, a, b] = Q[i];
  bank.questions.push({ id: `q${maxN + 1 + i}`, stem, options: [{ id: 'a', label: a[0], weights: a[1] }, { id: 'b', label: b[0], weights: b[1] }], topics: ['format.dish-vs-dish', 'flavor-axis.sour-driven'] });
}
writeFileSync(QPATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');
console.log(`加 ${Q.length} sour 等价题 → 总 ${bank.questions.length}`);
