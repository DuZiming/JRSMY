// 日期工具（纯函数）：一律本地时区，禁用 toISOString（UTC 偏移会把晚间创建的菜单分到昨天）
function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Date → 'YYYY-MM-DD'
function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 今天往前 n 天（含今天），新在前
function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    days.push(formatDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return days;
}

module.exports = { formatDateKey, lastNDays };
