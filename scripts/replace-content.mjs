/**
 * 把 flavor-copy-prompt/(已 humanizer 润色)替换到 food-quiz/src/content/。
 *
 * 类型差异(关键):
 *   - intervals IntervalEntry.copy 是 string(loader 校验 typeof === 'string'),
 *     flavor-copy-prompt 里是数组 → 替换时取首项转字符串
 *   - extreme/synergies/allround 的 copy 都是 string[],直接覆盖
 *
 * 不动:avoid(已下线,数据保留)、questions、dishes.json(flavor-copy-prompt 没有)。
 * git 已追踪 src/content,出问题可 git checkout 恢复。
 *
 * 运行: node scripts/replace-content.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'flavor-copy-prompt');
const DST = join(process.cwd(), 'food-quiz', 'src', 'content');

function dump(rel, data) {
  writeFileSync(join(DST, rel), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// intervals:copy 数组 → 字符串
let n = 0;
for (const f of readdirSync(join(SRC, 'intervals'))) {
  const d = JSON.parse(readFileSync(join(SRC, 'intervals', f), 'utf-8'));
  d.copy = Array.isArray(d.copy) ? d.copy[0] : d.copy;
  dump(`intervals/${f}`, d);
  n++;
}
console.log(`✅ intervals ${n} 已替换(copy 转字符串)`);

// extreme / synergies / allround:数组 copy 兼容,直接覆盖
for (const dir of ['extreme', 'synergies', 'allround']) {
  let m = 0;
  for (const f of readdirSync(join(SRC, dir))) {
    const d = JSON.parse(readFileSync(join(SRC, dir, f), 'utf-8'));
    dump(`${dir}/${f}`, d);
    m++;
  }
  console.log(`✅ ${dir} ${m} 已替换`);
}
console.log('\n替换完成。接下来跑 vitest + tsc + build 验证 loader 形状。');
