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

// 直接按页内已知状态写勾选（免整文档回读，单次往返，页面侧乐观更新）
async function updateBought(menuId, itemIndex, bought) {
  const key = `shopping_list.${itemIndex}.bought`;
  await db().collection('menus').doc(menuId).update({ data: { [key]: bought } });
}

module.exports = { addMenu, getMenu, listMenusGroupedByDate, updateBought, formatDateKey };
