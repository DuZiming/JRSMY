const { TYPE, TYPE_ORDER, AI_DAILY_LIMIT } = require('../miniprogram/utils/constants');

test('菜品类型枚举包含 MEAT=meat', () => {
  expect(TYPE.MEAT).toBe('meat');
});

test('TYPE_ORDER 覆盖五个类型', () => {
  expect(TYPE_ORDER).toHaveLength(5);
});

test('AI 每日限流为 20 次', () => {
  expect(AI_DAILY_LIMIT).toBe(20);
});
