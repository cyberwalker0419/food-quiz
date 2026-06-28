// scripts/polish-stems.mjs
// 扫描 + 温和清洗 questions.json 题干的 AI 味(humanizer-zh 机械层)。
// 只改 stem 文字,绝不动 weights(R13 真相源)。语义层去AI味由 humanizer-zh Skill 抽样复核(T7)。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QPATH = resolve(__dirname, '../food-quiz/src/content/questions/questions.json');
const bank = JSON.parse(readFileSync(QPATH, 'utf-8'));

// 安全清洗:删开头填充前缀(humanizer-zh "删填充短语"原则)
const TRIM_PREFIXES = ['此外，', '首先，', '那么，', '其实，', '说实话，', '总而言之，'];
// AI 味报告词(humanizer-zh 高频 AI 词 + 项目黑名单 polish-copy.mjs),仅报告不自动改(语义复杂,留给 Skill)
const AI_REPORT = [
  '彰显', '勾勒', '成就了', '赋予', '格局', '让你觉得', '让你多想',
  '至关重要', '深入探讨', '充满活力', '不仅.*而且', '不仅.*还',
  '共振', '同时在线', '此外', '综上所述', '值得一提的是',
];

const stats = { trimmed: 0, dashNorm: 0, aiHit: [] };
for (const q of bank.questions) {
  let s = q.stem;
  for (const p of TRIM_PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length); stats.trimmed++; }
  }
  // 多个连续破折号归一(———/———— → ——)
  const before = s;
  s = s.replace(/—{3,}/g, '——');
  if (s !== before) stats.dashNorm++;
  q.stem = s;
  for (const pat of AI_REPORT) {
    if (new RegExp(pat).test(q.stem)) {
      stats.aiHit.push({ id: q.id, pat, stem: q.stem.slice(0, 36) });
    }
  }
}

writeFileSync(QPATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');
console.log(`总题数: ${bank.questions.length}`);
console.log(`删填充前缀: ${stats.trimmed} 题`);
console.log(`破折号归一: ${stats.dashNorm} 题`);
console.log(`AI 味命中: ${stats.aiHit.length} 处`);
for (const h of stats.aiHit.slice(0, 30)) console.log(`  ${h.id} [${h.pat}] ${h.stem}`);
