const { listMenusGroupedByDate } = require('../../services/menus');

const TYPE_ZH = { meat: '荤', veg: '素', staple: '主食', soup: '汤', drink: '饮' };

function todayLabel(dateStr) {
  const now = new Date();
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (dateStr === today) return '今天';
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (dateStr === yesterday) return '昨天';
  return dateStr.slice(5).replace('-', '月') + '日';
}

Page({
  data: {
    groups: [],
    loading: true,
    typeZh: TYPE_ZH,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.load();
  },

  async load() {
    try {
      const groups = await listMenusGroupedByDate();
      this.setData({
        groups: groups.map((g) => ({
          ...g,
          label: todayLabel(g.date),
        })),
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  create() {
    wx.navigateTo({ url: '/pages/menu/create' });
  },

  openDetail(e) {
    wx.navigateTo({ url: `/pages/menu/detail?id=${e.currentTarget.dataset.id}` });
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },
});
