// AI 识别每日限流（纯函数，云函数与 Jest 共用）
// checkQuota(usage, today, limit) → { allowed, nextUsage }
// usage: undefined 或 { date: 'YYYY-MM-DD', count: n }（存 users.ai_usage）
function checkQuota(usage, today, limit) {
  // 当日首次（无记录或日期已翻页）：重新计数
  if (!usage || usage.date !== today) {
    return { allowed: true, nextUsage: { date: today, count: 1 } };
  }
  if (usage.count >= limit) {
    return { allowed: false, nextUsage: usage };
  }
  return { allowed: true, nextUsage: { date: today, count: usage.count + 1 } };
}

module.exports = { checkQuota };
