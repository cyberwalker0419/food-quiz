#!/usr/bin/env node
/**
 * P6.1: 删除 questions.json 中所有 option label 里的括号内容(中英文半全角括号)。
 * 保留括号外主体文本。删除后再次扫描,残留 > 0 即报错退出。
 *
 * 运行: node scripts/strip-brackets.mjs
 * 测试: npx vitest run scripts/strip-brackets.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'food-quiz', 'src', 'content', 'questions', 'questions.json');

/**
 * 删除一个 label 里所有中英文半全角括号的内容。
 * - 范围:  (xxx)  (xxx)  （xxx）  (xxx）
 * - 不会删除括号外的文本
 * - 末尾连接符/空白会被清理
 */
export function stripBrackets(label) {
  // 1) 删括号内容(包含括号 + 内层空白)
  let out = label.replace(/[(（][^()（）]*[)）]/g, '');
  // 2) 删尾随的连接符/空白(连续多次,处理 " +" "、 " 之类)
  out = out.replace(/[\s+\-、，,]+$/g, '');
  // 3) 删前面多余空白
  return out.trim();
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
let removed = 0;
let touched = 0;

for (const q of data.questions) {
  for (const opt of q.options) {
    const before = opt.label;
    const after = stripBrackets(before);
    if (after !== before) {
      if (after.length === 0) {
        console.error(`ERROR: q=${q.id} opt=${opt.id} 清理后变空 (原: "${before}")`);
        process.exit(1);
      }
      opt.label = after;
      touched++;
      // 统计被删除的括号对数
      const matches = before.match(/[(（][^()（）]*[)）]/g) || [];
      removed += matches.length;
    }
  }
}

// 二次扫描:确认无残留
let remaining = 0;
for (const q of data.questions) {
  for (const opt of q.options) {
    const matches = opt.label.match(/[(（][^()（）]*[)）]/g) || [];
    if (matches.length > 0) {
      console.error(`ERROR: q=${q.id} opt=${opt.id} label="${opt.label}" 残留 ${matches.length} 处括号`);
      remaining += matches.length;
    }
  }
}
if (remaining > 0) {
  console.error(`✗ 残留 ${remaining} 处括号,中止`);
  process.exit(1);
}

// 写回(2 空格缩进 + 末尾换行,匹配原文件)
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✔ 已清理 ${touched} 个选项,删除 ${removed} 处括号`);
console.log(`✔ 剩余 0 处括号(已二次扫描验证)`);
