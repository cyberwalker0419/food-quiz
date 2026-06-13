import { describe, it, expect } from 'vitest';
import { stripBrackets } from './strip-brackets.mjs';

describe('stripBrackets', () => {
  it.each([
    // 中英文括号
    ['麻酱 + 腐乳 + 香菜(醇厚派)', '麻酱 + 腐乳 + 香菜'],
    ['美式咖啡/黑咖啡(苦派)', '美式咖啡/黑咖啡'],
    ['提拉米苏(微苦咖啡 + 软)', '提拉米苏'],
    // 全角括号
    ['麻婆豆腐（香辣派）', '麻婆豆腐'],
    // 中英混合
    ['我从不蘸料(原味党)', '我从不蘸料'],
    // 末尾有连接符
    ['麻酱 + 腐乳 + 香菜 (醇厚派) +', '麻酱 + 腐乳 + 香菜'],
    ['柠檬/百香果派(酸甜)、', '柠檬/百香果派'],
    // 无括号
    ['微苦咖啡', '微苦咖啡'],
    ['', ''],
    // 多对括号
    ['火锅(麻辣) + 烧烤(烟熏)', '火锅 + 烧烤'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(stripBrackets(input)).toBe(expected);
  });

  it('括号内含嵌套引号不干扰', () => {
    expect(stripBrackets('蛋糕(巧克力"甘"派)')).toBe('蛋糕');
  });

  it('空括号删除', () => {
    expect(stripBrackets('提拉米苏()')).toBe('提拉米苏');
  });

  it('多对括号 + 末尾连接符', () => {
    expect(stripBrackets('A(1) + B(2) + ')).toBe('A + B');
  });

  it('连接符在中段保留', () => {
    expect(stripBrackets('A(x) + B(y)')).toBe('A + B');
  });
});
