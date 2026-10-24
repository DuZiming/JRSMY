const { checkQuota } = require('../cloudfunctions/recognizeDish/quota');

const today = '2026-10-24';

describe('checkQuota AI 每日限流', () => {
  test('当日首次调用：允许，计数从 1 开始', () => {
    const r = checkQuota(undefined, today, 20);
    expect(r).toEqual({ allowed: true, nextUsage: { date: today, count: 1 } });
  });

  test('已达上限：拒绝', () => {
    const r = checkQuota({ date: today, count: 20 }, today, 20);
    expect(r.allowed).toBe(false);
    expect(r.nextUsage).toEqual({ date: today, count: 20 });
  });

  test('上限之下：允许并计数加一', () => {
    const r = checkQuota({ date: today, count: 19 }, today, 20);
    expect(r).toEqual({ allowed: true, nextUsage: { date: today, count: 20 } });
  });

  test('usage 是昨天的：重新计数', () => {
    const r = checkQuota({ date: '2026-10-23', count: 20 }, today, 20);
    expect(r).toEqual({ allowed: true, nextUsage: { date: today, count: 1 } });
  });

  test('limit 可传入不同值', () => {
    expect(checkQuota({ date: today, count: 5 }, today, 5).allowed).toBe(false);
  });
});
