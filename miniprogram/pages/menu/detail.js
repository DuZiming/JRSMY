const { buildMenuDoc } = require('../../utils/shoppingList');
const { addMenu, getMenu, toggleBought } = require('../../services/menus');

const TYPE_ZH = { meat: '荤', veg: '素', staple: '主食', soup: '汤', drink: '饮' };

Page({
  data: {
    menu: null,
    typeZh: TYPE_ZH,
    saving: false,
  },

  onLoad(options) {
    if (options && options.confirm === '1') {
      this.createFromPending();
    } else if (options.id) {
      this.loadMenu(options.id);
    }
  },

  // 从生成页的确认结果落库并展示
  async createFromPending() {
    const pending = wx.getStorageSync('pending_menu');
    if (!pending || !pending.picks || !pending.picks.length) {
      wx.showToast({ title: '没有待确认的菜单', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    wx.removeStorageSync('pending_menu');
    this.setData({ saving: true });
    try {
      const doc = buildMenuDoc(pending);
      const id = await addMenu(doc);
      this.setData({ menu: { _id: id, ...doc } });
    } catch (e) {
      wx.showToast({ title: e.message || '保存菜单失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
    } finally {
      this.setData({ saving: false });
    }
  },

  async loadMenu(id) {
    try {
      const menu = await getMenu(id);
      this.setData({ menu });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async toggle(e) {
    const { index } = e.currentTarget.dataset;
    try {
      const bought = await toggleBought(this.data.menu._id, index);
      this.setData({ [`menu.shopping_list[${index}].bought`]: bought });
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },
});
