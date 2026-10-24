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

// 从各菜 ingredients 聚合买菜清单：同名合并、缺 name 的项过滤、按首次出现排序
function aggregateShoppingList(dishes) {
  const order = [];
  const byName = {};
  (dishes || []).forEach((dish) => {
    (dish.ingredients || []).forEach((ing) => {
      if (!ing || !ing.name) return;
      if (!byName[ing.name]) {
        byName[ing.name] = { name: ing.name, amount: ing.amount || '', bought: false };
        order.push(ing.name);
      } else {
        byName[ing.name].amount = mergeAmount(byName[ing.name].amount, ing.amount || '');
      }
    });
  });
  return order.map((name) => byName[name]);
}

// 热量合计：非数字（null/undefined）按 0
function sumCalories(items) {
  return (items || []).reduce(
    (sum, it) => sum + (typeof it.calories === 'number' ? it.calories : 0),
    0
  );
}

// 构建菜单文档：items 存快照（dish_id/name/封面photo/type/calories），
// 菜品日后被删/改，历史菜单不烂
function buildMenuDoc({ picks, requirements, mode }) {
  const items = (picks || []).map((p) => ({
    dish_id: p._id,
    name: p.name,
    photo: (p.photos || [])[0] || '',
    type: p.type,
    calories: typeof p.calories === 'number' ? p.calories : null,
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
