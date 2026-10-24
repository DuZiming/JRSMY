// 菜单数据访问层
const { formatDateKey } = require('../utils/date');

function db() {
  return wx.cloud.database();
}

async function addMenu(doc) {
  const res = await db().collection('menus').add({
    data: { ...doc, created_at: db().serverDate() },
  });
  return res._id;
}

async function getMenu(id) {
  const res = await db().collection('menus').doc(id).get();
  return res.data;
}

// 按天分组的历史（_openid + date 倒序索引查询后内存分组）
async function listMenusGroupedByDate() {
  const res = await db()
    .collection('menus')
    .orderBy('date', 'desc')
    .orderBy('created_at', 'desc')
    .limit(100)
    .get();
  const groups = [];
  const byDate = {};
  res.data.forEach((m) => {
    if (!byDate[m.date]) {
      byDate[m.date] = { date: m.date, menus: [] };
      groups.push(byDate[m.date]);
    }
    byDate[m.date].menus.push(m);
  });
  return groups;
}

async function toggleBought(menuId, itemIndex) {
  const menu = await getMenu(menuId);
  const key = `shopping_list.${itemIndex}.bought`;
  const current = menu.shopping_list[itemIndex].bought;
  await db().collection('menus').doc(menuId).update({
    data: { [key]: !current },
  });
  return !current;
}

module.exports = { addMenu, getMenu, listMenusGroupedByDate, toggleBought, formatDateKey };
