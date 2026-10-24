const { parseAiJson } = require('../miniprogram/utils/aiParse');

describe('parseAiJson AI 返回解析', () => {
  test('纯 JSON 字符串全字段通过', () => {
    const raw = JSON.stringify({
      name: '番茄炒蛋',
      type: 'veg',
      source: 'home',
      tags: ['清淡健康'],
      ingredients: [{ name: '番茄', amount: '2个' }, { name: '鸡蛋', amount: '3个' }],
      calories: 180,
      spicy_level: 0,
    });
    const { ok, data } = parseAiJson(raw);
    expect(ok).toBe(true);
    expect(data).toEqual({
      name: '番茄炒蛋',
      type: 'veg',
      source: 'home',
      tags: ['清淡健康'],
      ingredients: [{ name: '番茄', amount: '2个' }, { name: '鸡蛋', amount: '3个' }],
      calories: 180,
      spicy_level: 0,
    });
  });

  test('带 markdown 代码围栏时剥离后通过', () => {
    const raw = '```json\n{"name":"麻婆豆腐","type":"meat","spicy_level":2}\n```';
    const { ok, data } = parseAiJson(raw);
    expect(ok).toBe(true);
    expect(data.name).toBe('麻婆豆腐');
    expect(data.spicy_level).toBe(2);
  });

  test('type 非法枚举值时丢弃该字段，其余保留', () => {
    const raw = '{"name":"海鲜粥","type":"海鲜","calories":300}';
    const { ok, data } = parseAiJson(raw);
    expect(ok).toBe(true);
    expect(data.type).toBeUndefined();
    expect(data.name).toBe('海鲜粥');
    expect(data.calories).toBe(300);
  });

  test('source 非法枚举值时丢弃', () => {
    const { ok, data } = parseAiJson('{"source":"食堂"}');
    expect(ok).toBe(true);
    expect(data.source).toBeUndefined();
  });

  test('spicy_level 超出 0-3 丢弃', () => {
    const { ok, data } = parseAiJson('{"name":"魔鬼辣","spicy_level":9}');
    expect(ok).toBe(true);
    expect(data.spicy_level).toBeUndefined();
  });

  test('calories 非数字丢弃', () => {
    const { ok, data } = parseAiJson('{"name":"x","calories":"很高"}');
    expect(ok).toBe(true);
    expect(data.calories).toBeUndefined();
  });

  test('JSON 外有杂质文本时用首个 {...} 兜底提取', () => {
    const raw = '识别结果如下：{"name":"白切鸡","type":"meat"} 请确认';
    const { ok, data } = parseAiJson(raw);
    expect(ok).toBe(true);
    expect(data.name).toBe('白切鸡');
  });

  test('完全非 JSON 返回 ok:false 带 error', () => {
    const { ok, data, error } = parseAiJson('这看起来不是一道菜');
    expect(ok).toBe(false);
    expect(data).toEqual({});
    expect(typeof error).toBe('string');
  });

  test('ingredients 中缺 name 的项被过滤', () => {
    const raw = '{"name":"沙拉","ingredients":[{"amount":"适量"},{"name":"生菜","amount":"1颗"}]}';
    const { ok, data } = parseAiJson(raw);
    expect(ok).toBe(true);
    expect(data.ingredients).toEqual([{ name: '生菜', amount: '1颗' }]);
  });

  test('tags 非字符串数组时丢弃', () => {
    const { ok, data } = parseAiJson('{"tags":"清淡"}');
    expect(ok).toBe(true);
    expect(data.tags).toBeUndefined();
  });
});
