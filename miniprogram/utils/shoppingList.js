// 买菜清单聚合 / 热量合计 / 菜单文档构建（纯函数）
const { formatDateKey } = require('./date');

// '500克' → {num:500, unit:'克'}；无法数值化返回 null
function parseAmount(amount) {
  if (typeof amount !== 'string') return null;
  const m = amount.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { num: parseFloat(m[1]), unit: m[2] };
}

// 合并两段用量：同单位数值相加保留单位；否则用 '/' 连接
function mergeAmount(a, b) {
  if (!a) return b || '';
  if (!b) return a;
  const pa = parseAmount(a);
  const pb = parseAmount(b);
  if (pa && pb && pa.unit === pb.unit) {
    const sum = pa.num + pb.num;
    return `${Number.isInteger(sum) ? sum : +sum.toFixed(2)}${pa.unit}`;
  }
  return `${a}/${b}`;
}

// 份数换算：可数值化的用量 × 份数；不可数值化或份数为 1 保持原文
function multiplyAmount(amount, qty) {
  if (!qty || qty === 1) return amount || '';
  const pa = parseAmount(amount);
  if (!pa) return amount || '';
  const scaled = pa.num * qty;
  return `${Number.isInteger(scaled) ? scaled : +scaled.toFixed(2)}${pa.unit}`;
}

// 从各菜 ingredients 聚合买菜清单：同名合并、缺 name 的项过滤、按首次出现排序、用量按份数(_qty)翻倍
function aggregateShoppingList(dishes) {
  const order = [];
  const byName = {};
  (dishes || []).forEach((dish) => {
    const qty = dish._qty || 1;
    (dish.ingredients || []).forEach((ing) => {
      if (!ing || !ing.name) return;
      const amount = multiplyAmount(ing.amount, qty);
      if (!byName[ing.name]) {
        byName[ing.name] = { name: ing.name, amount, bought: false };
        order.push(ing.name);
      } else {
        byName[ing.name].amount = mergeAmount(byName[ing.name].amount, amount);
      }
    });
  });
  return order.map((name) => byName[name]);
}

// 热量合计：非数字（null/undefined）按 0，份数（qty）参与合计
function sumCalories(items) {
  return (items || []).reduce(
    (sum, it) => sum + (typeof it.calories === 'number' ? it.calories : 0) * (it.qty || 1),
    0
  );
}

// 构建菜单文档：items 存快照（dish_id/name/封面photo/type/calories/qty份数），
// 菜品日后被删/改，历史菜单不烂；qty 用于手选菜单（默认 1）
function buildMenuDoc({ picks, requirements, mode }) {
  const items = (picks || []).map((p) => ({
    dish_id: p._id,
    name: p.name,
    photo: (p.photos || [])[0] || '',
    type: p.type,
    calories: typeof p.calories === 'number' ? p.calories : null,
    qty: p._qty || 1,
  }));

  return {
    date: formatDateKey(new Date()),
    items,
    requirements,
    mode,
    total_calories: sumCalories(items),
    shopping_list: aggregateShoppingList(picks),
  };
}

module.exports = { aggregateShoppingList, sumCalories, buildMenuDoc };
