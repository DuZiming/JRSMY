const { formatDateKey, lastNDays } = require('../miniprogram/utils/date');

describe('formatDateKey 本地日期', () => {
  test('本地时区生成 YYYY-MM-DD（晚间不落入昨天）', () => {
    expect(formatDateKey(new Date(2026, 9, 24, 23, 59))).toBe('2026-10-24');
    expect(formatDateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  test('补零两位', () => {
    expect(formatDateKey(new Date(2026, 10, 5, 12, 0))).toBe('2026-11-05');
  });
});

describe('lastNDays', () => {
  test('含今天共 n 天，首项是今天，逐日递减', () => {
    const days = lastNDays(7);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(formatDateKey(new Date()));
    expect(days[1]).toBe(formatDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000)));
    expect(days[6]).toBe(formatDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  });
});
