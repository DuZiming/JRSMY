// 菜单推荐与转盘抽取算法（纯函数，CommonJS 供小程序与 Jest 共用）
const { TYPE_ORDER } = require('./constants');

// 忌口特殊项：'辣' 表示排除所有 spicy_level > 0 的菜
const SPICY_AVOID = '辣';

// 过滤某类型的候选池：类型匹配 + avoid 排除（'辣' 或标签名）+ excludeIds 剔除
function filterPool(dishes, { type, avoid = [], excludeIds = [] }) {
  return dishes.filter((d) => {
    if (d.type !== type) return false;
    if (excludeIds.includes(d._id)) return false;
    if (avoid.includes(SPICY_AVOID) && (d.spicy_level || 0) > 0) return false;
    if (avoid.some((tag) => tag !== SPICY_AVOID && (d.tags || []).includes(tag))) return false;
    return true;
  });
}

// 从池中随机抽一道并移除（保证同一菜单内不重复）
function draw(pool, rng) {
  const idx = Math.floor(rng() * pool.length);
  const [pick] = pool.splice(idx, 1);
  return pick;
}

// 随机整单：按 composition 逐类抽取；近期吃过的优先排除，不够时放宽回全池；
// 池为空的类型记入 skippedTypes（不抛错、不卡死）
function generateMenu(dishes, opts = {}) {
  const { composition = {}, avoid = [], recentDishIds = [], rng = Math.random } = opts;
  const picks = [];
  const skippedTypes = [];

  for (const type of TYPE_ORDER) {
    const need = composition[type] || 0;
    if (need <= 0) continue;

    const base = filterPool(dishes, { type, avoid });
    if (base.length === 0) {
      skippedTypes.push(type);
      continue;
    }

    let pool = base.filter((d) => !recentDishIds.includes(d._id));
    if (pool.length < need) {
      pool = base.slice();
    }

    let taken = 0;
    while (pool.length > 0 && taken < need) {
      picks.push(draw(pool, rng));
      taken += 1;
    }
  }

  return { picks, skippedTypes };
}

// 大转盘：单类型随机抽一道；池空返回 null（重转靠 excludeIds 累加实现）
function pickForWheel(dishes, type, { avoid = [], excludeIds = [], rng = Math.random } = {}) {
  const pool = filterPool(dishes, { type, avoid, excludeIds });
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

module.exports = { generateMenu, pickForWheel, filterPool };
