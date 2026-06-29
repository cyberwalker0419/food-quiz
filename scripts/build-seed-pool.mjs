// scripts/build-seed-pool.mjs
// 构造 warm-up seed pool:8 维各 6 题(=48),score = std(topicVector) + 0.3·maxDim,
// smooth 优先(建基线)、不足 sharp 补,overlap(centeredCos)>0.6 去换皮。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');
const OUT = resolve(__dirname, '../food-quiz/src/content/questions/seed-pool.json');
const bank = JSON.parse(readFileSync(QPATH, 'utf-8'));
const DIMS = ['sour', 'sweet', 'temperature', 'spicy', 'salty', 'rich', 'crunchy', 'tender'];
const PER_DIM = 6;
const OVERLAP_CAP = 0.85;

const topicVector = (q) => {
  const out = {}; for (const d of DIMS) out[d] = 0;
  const n = q.options.length || 1;
  for (const o of q.options) for (const d of DIMS) out[d] += Math.abs(o.weights[d] || 0);
  for (const d of DIMS) out[d] /= n;
  return out;
};
const stdv = (v) => { const a = DIMS.map((d) => v[d]); const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const primaryDim = (v) => { let bd = DIMS[0], bm = -1; for (const d of DIMS) { if (v[d] > bm) { bm = v[d]; bd = d; } } return bd; };
const maxSingle = (v) => Math.max(...DIMS.map((d) => v[d]));
const centeredCos = (a, b) => {
  const ma = DIMS.reduce((s, d) => s + a[d], 0) / DIMS.length, mb = DIMS.reduce((s, d) => s + b[d], 0) / DIMS.length;
  let dot = 0, na = 0, nb = 0;
  for (const d of DIMS) { const va = a[d] - ma, vb = b[d] - mb; dot += va * vb; na += va * va; nb += vb * vb; }
  const den = Math.sqrt(na * nb); return den < 1e-9 ? 0 : dot / den;
};
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const isSmooth = (q) => q.options.length !== 2;

const slots = {};
const stats = { smooth: 0, sharp: 0 };
const dimCandCount = {};
for (const d of DIMS) {
  const cands = bank.questions.filter((q) => primaryDim(topicVector(q)) === d);
  dimCandCount[d] = cands.length;
  const score = (x) => x.s - 0.5 * (picked.length ? avg(picked.map((p) => centeredCos(x.tv, p.tv))) : 0);
  const scored = cands.map((q) => { const tv = topicVector(q); return { q, tv, s: stdv(tv) + 0.3 * maxSingle(tv) }; });
  const picked = [];
  for (const pool of [scored.filter((x) => isSmooth(x.q)), scored.filter((x) => !isSmooth(x.q))]) {
    pool.sort((a, b) => (stdv(b.tv) + 0.3 * maxSingle(b.tv)) - (stdv(a.tv) + 0.3 * maxSingle(a.tv)));
    for (const c of pool) {
      if (picked.length >= PER_DIM) break;
      const overlap = picked.length ? avg(picked.map((p) => centeredCos(c.tv, p.tv))) : 0;
      if (overlap > OVERLAP_CAP) continue;
      picked.push(c);
    }
    if (picked.length >= PER_DIM) break;
  }
  slots[d] = picked.map((x) => x.q.id);
  for (const x of picked) { if (isSmooth(x.q)) stats.smooth++; else stats.sharp++; }
}

writeFileSync(OUT, JSON.stringify({ version: 1, slots }, null, 2) + '\n', 'utf-8');
console.log('=== seed-pool 构造 ===');
for (const d of DIMS) console.log(`  ${d.padEnd(12)} 池${slots[d].length}/候选${dimCandCount[d]}  [${slots[d].slice(0, 4).join(',')}...]`);
console.log(`smooth ${stats.smooth} / sharp ${stats.sharp} (sharp 率 ${((stats.sharp / (stats.smooth + stats.sharp)) * 100).toFixed(0)}%)`);
